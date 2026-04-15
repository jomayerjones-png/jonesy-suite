/**
 * daily-prospects.mjs
 * Runs every weekday at 8am EST via GitHub Actions.
 * Identifies 3 senior prospects, drafts LIFE pitch emails, inserts into Supabase.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.LIFE_SUPABASE_SERVICE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing LIFE_SUPABASE_SERVICE_KEY');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY');
  process.exit(1);
}

// Service role client bypasses RLS — safe for server-side only
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
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

const SYSTEM_PROMPT = `You are a senior business development researcher working for Jo Mayer Jones at Jonesy & Co.
You are helping build the advertising partner pipeline for LIFE magazine — the iconic American brand being relaunched
as a quarterly large-format magazine and cultural platform. Publishers: Karlie Kloss and Josh Kushner. Launch: September 2026.
First issue: "Where Are We Now?" — a portrait of America under construction, told through engineers, scientists, policymakers, and artists.

Your job: identify 3 real, senior decision-makers at well-funded companies who would be a natural founding advertising partner for LIFE.
Use web search to verify: the person exists, their title is current, and there is a specific, researched reason WHY their brand fits LIFE right now.

TARGET PROFILE:
- Title: CMO, Chief Brand Officer, VP Marketing, SVP Partnerships, VP Brand, Global Marketing Director (C-suite or VP level minimum)
- Company: well-funded brand in luxury, automotive, finance, fashion, tech, aviation, consumer goods, or a fast-growing challenger brand
- The company must have genuine cultural ambition — not just a transactional advertiser
- Prioritise brands that have recently made bold brand moves, launched campaigns about American identity/progress/optimism, or are entering a new cultural moment

EMAIL TEMPLATE TO USE (Option 1 style — adapt the WHY paragraph per company):
Subject: LIFE — [Company Name]

Hi [First Name]

LIFE, one of America's most iconic media brands, is undergoing a ground-up rebuild — reimagined as a quarterly large-format magazine and cultural platform launching this September with Karlie Kloss and Josh Kushner as Publishers.

The first issue is "Where Are We Now?" — a portrait of an America under construction. Across sectors, breakthroughs are no longer theoretical; they are deployed, funded, and scaled. We'll sit with the engineers, scientists, policymakers, and artists at the frontier. It is, at its core, a story of American progress, told through the people living it.

[COMPANY] has been on our list from the start. [PERSONALIZED WHY — one specific, researched sentence referencing a real recent campaign, brand positioning move, cultural commitment, or market moment that makes this company a natural LIFE founding partner. Be concrete and specific, not generic.]

We're in conversation with a very small number of founding partners. The model prioritises depth over reach and is designed for creative collaboration rather than a media buy.

Can we jump on a call over the next couple of weeks to discuss?

Warm regards,
Jo

OUTPUT FORMAT — respond with a JSON array only, no prose, no markdown fences:
[
  {
    "name": "First Last",
    "title": "CMO",
    "company": "Company Name",
    "email": "firstname.lastname@company.com",
    "email_confidence": "estimated",
    "why": "One specific sentence explaining why this company is a natural LIFE founding partner right now.",
    "draft_subject": "LIFE — Company Name",
    "draft_body": "Full email body text (no subject line, just the body starting with Hi [Name])"
  }
]

Rules:
- email_confidence: use "verified" if you found the email confirmed in a public source, otherwise "estimated"
- draft_body: use the exact template above, substituting the real name and personalized WHY paragraph
- The WHY sentence must be concrete and researched — reference something real and specific
- Do not include companies from the exclusion list
- Return exactly 3 prospects`;

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
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Extract the final text block (after tool use rounds)
  const textBlocks = response.content.filter((b) => b.type === 'text');
  if (textBlocks.length === 0) {
    throw new Error('No text response from Claude');
  }

  const raw = textBlocks[textBlocks.length - 1].text.trim();
  console.log('Raw response:', raw.slice(0, 200), '...');

  // Strategy 1: extract from inside a ```json ... ``` code fence
  let jsonStr = null;
  const fenceMatch = raw.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1];
  } else {
    // Strategy 2: find a JSON array of objects specifically (avoids matching prose like [Note: ...])
    const arrayMatch = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) jsonStr = arrayMatch[0];
  }

  if (!jsonStr) {
    throw new Error(`No JSON array found in response.\nRaw: ${raw.slice(0, 500)}`);
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
