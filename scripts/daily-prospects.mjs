/**
 * daily-prospects.mjs
 * Runs every weekday at 8am EST via GitHub Actions.
 * Identifies 3 senior prospects, drafts LIFE pitch emails, inserts into Supabase.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pTeNDh39W3EjsJSkate0Kg_hbt1eq_4';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY');
  process.exit(1);
}
if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY — add it to GitHub secrets and the workflow env block');
  process.exit(1);
}

// Anon client for reads (exclusion list)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Service role client for inserts — bypasses RLS entirely
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function getExclusionList() {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [clientsRes, prospectsRes] = await Promise.all([
    supabase.from('clients').select('data'),
    supabase.from('daily_prospects').select('company').gte('date', cutoff),
  ]);

  const pipelineCompanies = (clientsRes.data ?? [])
    .map((r) => r.data?.company)
    .filter(Boolean);

  const recentProspects = (prospectsRes.data ?? [])
    .map((r) => r.company)
    .filter(Boolean);

  const all = [...new Set([...pipelineCompanies, ...recentProspects])];
  console.log(`Exclusion list: ${all.length} companies`);
  return all;
}

const SYSTEM_PROMPT = `You are a BD researcher for Jo Mayer Jones at Jonesy & Co, building the founding partner pipeline for LIFE magazine — relaunching September 2026 as a quarterly large-format magazine with Karlie Kloss and Josh Kushner as Publishers. First issue: "Where Are We Now?" — America under construction.

Find 3 real senior contacts (CMO, Chief Brand Officer, VP Marketing or equivalent) at culturally ambitious brands in luxury, auto, finance, fashion, tech, aviation, or consumer goods. Use web search to verify each contact is current and find a specific WHY.

Draft each email using this template:
Subject: LIFE — [Company]
Hi [First Name]
LIFE, one of America's most iconic media brands, is undergoing a ground-up rebuild — reimagined as a quarterly large-format magazine and cultural platform launching this September with Karlie Kloss and Josh Kushner as Publishers.
The first issue is "Where Are We Now?" — a portrait of an America under construction, told through the engineers, scientists, policymakers, and artists at the frontier.
[Company] has been on our list from the start. [ONE specific researched sentence: a real recent campaign, brand move, or cultural moment that makes them a natural LIFE founding partner.]
We're speaking with a small number of founding partners — creative collaboration, not a media buy.
Can we jump on a call over the next couple of weeks?
Warm regards, Jo

Return ONLY a JSON object (not an array), no prose:
{"name":"","title":"","company":"","email":"","email_confidence":"estimated","why":"","draft_subject":"","draft_body":""}
Rules: email_confidence="verified" only if confirmed in a public source. Return exactly 1 object.`;

async function callClaudeWithRetry(userMessage) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
      return response;
    } catch (err) {
      if (err.status === 429 && attempt < 3) {
        console.log(`Rate limited — waiting 65s before retry (attempt ${attempt}/3)...`);
        await new Promise(r => setTimeout(r, 65_000));
        continue;
      }
      throw err;
    }
  }
}

function extractProspect(response) {
  const allText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  if (!allText.trim()) throw new Error('No text response from Claude');

  let jsonStr = null;
  const fenceMatch = allText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1];
  } else {
    const objMatch = allText.match(/\{[^{}]*"name"[\s\S]*?\}/);
    if (objMatch) jsonStr = objMatch[0];
  }

  if (!jsonStr) throw new Error(`No JSON object found.\nRaw: ${allText.slice(0, 300)}`);

  const sanitized = jsonStr.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(sanitized);
}

async function generateProspects(exclusionList) {
  const exclusionNote = exclusionList.length > 0
    ? `\nDO NOT suggest any of these companies:\n${exclusionList.join(', ')}`
    : '';

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const prospects = [];

  for (let i = 1; i <= 3; i++) {
    const alreadyFound = prospects.map(p => p.company).join(', ');
    const skipNote = alreadyFound ? `\nAlso skip these already found today: ${alreadyFound}` : '';

    const userMessage = `Today is ${today}. Find 1 real senior contact for LIFE magazine's advertising partner pipeline.
Use web search to verify the contact and write a specific, researched WHY.${exclusionNote}${skipNote}

Return the JSON object only.`;

    console.log(`Calling Claude API for prospect ${i}/3...`);
    const response = await callClaudeWithRetry(userMessage);
    console.log('Raw response:', response.content.filter(b => b.type === 'text').map(b => b.text).join('').slice(0, 150), '...');

    const prospect = extractProspect(response);
    prospects.push(prospect);
    console.log(`  ✓ ${prospect.name} @ ${prospect.company}`);

    if (i < 3) {
      console.log('Waiting 65s before next prospect...');
      await new Promise(r => setTimeout(r, 65_000));
    }
  }

  return prospects;
}

async function insertProspects(prospects) {
  const today = new Date().toISOString().split('T')[0];

  const rows = prospects.map((p) => ({
    id: randomUUID(),
    date: today,
    name: p.name,
    title: p.title ?? '',
    company: p.company,
    email: p.email ?? '',
    email_confidence: p.email_confidence ?? 'estimated',
    why: p.why,
    draft_subject: p.draft_subject,
    draft_body: p.draft_body,
    status: 'pending',
  }));

  const { error } = await supabaseAdmin.from('daily_prospects').insert(rows);
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);

  console.log(`Inserted ${rows.length} prospects for ${today}:`);
  rows.forEach((r) => console.log(`  • ${r.name} (${r.title}) @ ${r.company}`));
}

async function main() {
  try {
    const exclusionList = await getExclusionList();
    const prospects = await generateProspects(exclusionList);
    await insertProspects(prospects);
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    if (err.code) console.error('Error code:', err.code);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
