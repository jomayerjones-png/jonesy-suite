/**
 * fetch-newsletter.mjs
 * Fetches "Headlines by Abe Burns" newsletter emails from Gmail (last 90 days)
 * and stores extracted content in Supabase newsletter_cache table.
 * Run before daily prospect scripts so they can use newsletter stories as leads.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL     = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
const SUPABASE_ANON    = 'sb_publishable_pTeNDh39W3EjsJSkate0Kg_hbt1eq_4';
const CLIENT_ID        = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET    = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN    = process.env.GMAIL_REFRESH_TOKEN;
const NEWSLETTER_FROM  = 'abe.burns@81740910.mailchimpapp.com';

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });

// ── Gmail OAuth ───────────────────────────────────────────────────

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Gmail API helpers ─────────────────────────────────────────────

async function gmailGet(path, token) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail API ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

function decodeBody(payload) {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }
  const parts = payload.parts ?? [];
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    // nested multipart
    for (const nested of part.parts ?? []) {
      if (nested.mimeType === 'text/html' && nested.body?.data) {
        return Buffer.from(nested.body.data, 'base64url').toString('utf-8');
      }
    }
  }
  // fallback: plain text
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
  }
  return '';
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, '\n\n')
    .trim();
}

function getHeader(headers, name) {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

// ── Supabase helpers ──────────────────────────────────────────────

async function getExistingIds() {
  const { data } = await supabase.from('newsletter_cache').select('id');
  return new Set((data ?? []).map(r => r.id));
}

async function saveEntry(entry) {
  const { error } = await supabase.from('newsletter_cache').upsert(entry, { onConflict: 'id' });
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching Gmail access token...');
  const token = await getAccessToken();

  console.log('Searching for newsletter emails (last 90 days)...');
  const search = await gmailGet(
    `/users/me/messages?q=from:${NEWSLETTER_FROM}+newer_than:90d&maxResults=30`,
    token
  );

  const messages = search.messages ?? [];
  if (messages.length === 0) {
    console.log('No newsletter emails found.');
    return;
  }
  console.log(`Found ${messages.length} newsletter emails.`);

  const existingIds = await getExistingIds();
  let saved = 0;

  for (const { id } of messages) {
    if (existingIds.has(id)) {
      console.log(`  skip ${id} (already cached)`);
      continue;
    }

    const msg = await gmailGet(`/users/me/messages/${id}?format=full`, token);
    const headers = msg.payload?.headers ?? [];
    const subject  = getHeader(headers, 'subject');
    const dateStr  = getHeader(headers, 'date');
    const sentDate = dateStr ? new Date(dateStr).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const rawHtml = decodeBody(msg.payload ?? {});
    const content = stripHtml(rawHtml);

    if (content.length < 100) {
      console.log(`  skip ${id} (body too short)`);
      continue;
    }

    // Truncate to 8000 chars — enough context without blowing prompt limits
    const truncated = content.length > 8000 ? content.slice(0, 8000) + '...[truncated]' : content;

    await saveEntry({
      id,
      source: 'headlines-abe-burns',
      subject,
      sent_date: sentDate,
      content: truncated,
    });

    console.log(`  ✓ saved "${subject}" (${sentDate})`);
    saved++;

    // Polite delay to avoid Gmail rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`Done. ${saved} new entries saved, ${messages.length - saved} already cached.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
