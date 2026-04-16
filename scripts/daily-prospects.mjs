/**
 * daily-prospects.mjs
 * Runs every weekday at 8am EST via GitHub Actions.
 * Identifies 3 senior prospects, drafts LIFE pitch emails, inserts into Supabase.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL  = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
// Same publishable key already used in the app — daily_prospects RLS allows anon inserts
const SUPABASE_KEY  = 'sb_publishable_pTeNDh39W3EjsJSkate0Kg_hbt1eq_4';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function getExclusionList() {
  const today = new Date().toISOString().split('T')[0];
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

Return ONLY a JSON array, no prose:
[{"name":"","title":"","company":"","email":"","email_confidence":"estimated","why":"","draft_subject":"","draft_body":""}]
Rules: email_confidence="verified" only if confirmed in a public source. Return exactly 3 objects.`;

async function generateProspects(exclusionList) {
  const exclusionNote = exclusionList.length > 0
    ? `\n\nDO NOT suggest any of these companies (already in pipeline or recently contacted):\n${exclusionList.join(', ')}`
    : '';

  const userMessage = `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Find 3 real senior contacts for LIFE magazine's advertising partner pipeline.
Use web search to verify each contact and build a specific, researched WHY for each.${exclusionNote}

Return the JSON array only.`;

  console.log('Calling Claude API with web_search...');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Concatenate all text blocks — Claude sometimes emits JSON in an earlier block
  const allText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  if (!allText.trim()) {
    throw new Error('No text response from Claude');
  }

  console.log('Raw response:', allText.slice(0, 200), '...');

  // Strategy 1: extract from inside a ```json ... ``` code fence
  let jsonStr = null;
  const fenceMatch = allText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1];
  } else {
    // Strategy 2: find a JSON array of objects specifically (avoids matching prose like [Note: ...])
    const arrayMatch = allText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) jsonStr = arrayMatch[0];
  }

  if (!jsonStr) {
    throw new Error(`No JSON array found in response.\nRaw: ${allText.slice(0, 500)}`);
  }

  let prospects;
  try {
    prospects = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e.message}\nExtracted: ${jsonStr.slice(0, 200)}`);
  }

  if (!Array.isArray(prospects) || prospects.length !== 3) {
    throw new Error(`Expected 3 prospects, got ${Array.isArray(prospects) ? prospects.length : 'non-array'}`);
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

  const { error } = await supabase.from('daily_prospects').insert(rows);
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
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
