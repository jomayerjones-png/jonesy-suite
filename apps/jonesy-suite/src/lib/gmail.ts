import type { Client } from '../types';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export const gmailEnabled = Boolean(GOOGLE_CLIENT_ID);

// ── Token storage ─────────────────────────────────────────
const LS_TOKEN  = 'jonesy_gmail_token';
const LS_EXPIRY = 'jonesy_gmail_expiry';
export const LS_LAST_SYNC = 'jonesy_gmail_last_sync';

function saveToken(token: string, expiresIn: number) {
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_EXPIRY, String(Date.now() + expiresIn * 1000));
}

export function getStoredToken(): string | null {
  const token  = localStorage.getItem(LS_TOKEN);
  const expiry = localStorage.getItem(LS_EXPIRY);
  if (!token || !expiry) return null;
  if (Date.now() > Number(expiry) - 60_000) return null; // treat as expired 1 min early
  return token;
}

export function clearGmailToken() {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_EXPIRY);
}

// ── GIS initialisation ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenClient: any = null;

export function initGmailClient(onToken: (token: string) => void) {
  if (!GOOGLE_CLIENT_ID) return;

  const tryInit = () => {
    if (typeof google === 'undefined' || !google?.accounts?.oauth2) {
      setTimeout(tryInit, 300);
      return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GMAIL_SCOPE,
      callback: (res: { access_token: string; expires_in: number; error?: string }) => {
        if (!res.error) {
          saveToken(res.access_token, res.expires_in);
          onToken(res.access_token);
        }
      },
    });
  };
  tryInit();
}

export function requestGmailAccess() {
  tokenClient?.requestAccessToken({ prompt: '' });
}

// ── Gmail API helpers ─────────────────────────────────────
export interface EmailSummary {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;   // raw RFC 2822 Date header value
  isoDate: string; // YYYY-MM-DD
  snippet: string;
}

function extractEmail(header: string): string {
  // "Name <email@example.com>" → "email@example.com"
  const match = header.match(/<([^>]+)>/);
  return (match ? match[1] : header).toLowerCase().trim();
}

function parseDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch { /* ignore */ }
  return new Date().toISOString().split('T')[0];
}

async function gmailGet(accessToken: string, path: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${path}`);
  return res.json();
}

export async function fetchRecentEmails(accessToken: string): Promise<EmailSummary[]> {
  // Fetch message IDs for the last 60 days
  const list = await gmailGet(accessToken, 'messages?maxResults=200&q=newer_than:60d');
  const messages: { id: string }[] = list.messages ?? [];
  if (!messages.length) return [];

  const results: EmailSummary[] = [];
  // Fetch metadata in parallel batches of 10
  for (let i = 0; i < Math.min(messages.length, 150); i += 10) {
    const batch = messages.slice(i, i + 10);
    const fetched = await Promise.all(
      batch.map(({ id }) =>
        gmailGet(
          accessToken,
          `messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`
        ).catch(() => null)
      )
    );
    for (const msg of fetched) {
      if (!msg?.payload?.headers) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const h = (name: string) => (msg.payload.headers as any[]).find((x: any) => x.name === name)?.value ?? '';
      const rawDate = h('Date');
      results.push({
        id: msg.id,
        from: h('From'),
        to: h('To'),
        subject: h('Subject'),
        date: rawDate,
        isoDate: parseDate(rawDate),
        snippet: msg.snippet ?? '',
      });
    }
  }
  return results;
}

// ── Match emails → contacts ───────────────────────────────
export interface ContactEmailUpdate {
  id: string;
  lastContact: string; // YYYY-MM-DD — most recent email involving this contact
  emailCount: number;
}

export function matchEmailsToContacts(
  emails: EmailSummary[],
  contacts: Client[]
): ContactEmailUpdate[] {
  const contactsWithEmail = contacts.filter(c => c.email?.trim());
  const updates: ContactEmailUpdate[] = [];

  for (const contact of contactsWithEmail) {
    const addr = contact.email.toLowerCase().trim();
    const matches = emails.filter(e =>
      extractEmail(e.from) === addr ||
      e.to.split(',').map(t => extractEmail(t)).includes(addr)
    );
    if (!matches.length) continue;

    // Most recent first
    const sorted = [...matches].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    updates.push({
      id: contact.id,
      lastContact: sorted[0].isoDate,
      emailCount: matches.length,
    });
  }

  return updates;
}
