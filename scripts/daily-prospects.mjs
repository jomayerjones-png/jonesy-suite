/**
 * daily-prospects.mjs
 *
 * Runs every weekday morning via GitHub Actions (8am EST / 13:00 UTC).
 * Uses Claude (claude-opus-4-6 + web_search) to identify 3 real senior contacts,
 * draft personalised LIFE pitch emails, and insert them into the Supabase
 * daily_prospects table so the life-suite Roadmap tab can display them.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY         — from console.anthropic.com
 *   LIFE_SUPABASE_SERVICE_KEY — from Supabase → Settings → API → service_role key
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
const SUPABASE_KEY  = process.env.LIFE_SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL         = 'claude-opus-4-6';

if (!SUPABASE_KEY) { console.error('Missing LIFE_SUPABASE_SERVICE_KEY'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const today = () => new Date().toISOString().split('T')[0];

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function fetchExclusionList() {
  // Companies already in the pipeline
  const { data: clientRows } = await supabase.from('clients').select('data');
  const pipelineCompanies = (clientRows ?? [])
    .map(r => r.data?.company)
    .filter(Boolean)
    .map(c => c.toLowerCase().trim());

  // Companies already prospected in the last 14 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const { data: prospectRows } = await supabase
    .from('daily_prospects')
    .select('company')
    .gte('date', cutoff.toISOString().split('T')[0]);
  const recentProspects = (prospectRows ?? []).map(r => r.company?.toLowerCase().trim()).filter(Boolean);

  return [...new Set([...pipelineCompanies, ...recentProspects])];
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(exclusionList) {
  const excluded = exclusionList.slice(0, 60).join(', ');

  return `You are a business development researcher for LIFE magazine. Your job is to find 3 real, senior brand/marketing decision-makers at major companies who would be compelling founding advertising partners for LIFE's relaunch.

ABOUT LIFE:
- LIFE is one of America's most iconic media brands, undergoing a ground-up rebuild
- Relaunching as a quarterly large-format magazine and cultural platform, September 2026
- Publishers: Karlie Kloss and Josh Kushner
- First issue: "Where Are We Now?" — a portrait of America under construction
- Editorial approach: depth over volume, optimism over outrage, perspective over reaction
- Partnership model: small cohort of founding partners, creative collaboration not media buy

TARGET PROSPECT PROFILE:
- Senior decision-maker: CMO, VP Marketing, Chief Brand Officer, SVP Brand, SVP Partnerships, SVP Marketing
- At well-known, well-funded companies with a brand story that aligns with LIFE's values
- Industries to draw from: luxury goods, financial services, automotive, consumer technology, fashion/apparel, hospitality, aviation, healthcare/wellness, media, beauty, food & beverage, retail
- Also consider: fast-growing challenger brands punching above their weight culturally
- NOT startups with no marketing budget — real companies that could commit $750K–$2.5M
- Companies that value depth, culture, storytelling, American heritage, or optimism

DO NOT include companies from this exclusion list (already in pipeline or recently prospected):
${excluded}

YOUR TASK:
Use web search to find 3 real prospects. For each one:
1. Search for the company + "CMO" or "Chief Marketing Officer" or "VP Marketing" to find the real person's name and title
2. Confirm the contact is currently in the role (check LinkedIn data, company press releases, recent news)
3. Identify a SPECIFIC, RESEARCHED reason WHY this company is a natural fit for LIFE right now — a recent campaign, a brand repositioning, a cultural moment they've leaned into, a values alignment that is not generic
4. Construct the most likely professional email address (firstname.lastname@company.com or similar)
5. Draft a personalised email using the template below

EMAIL TEMPLATE (use this structure exactly, fill in [BRACKETS]):
---
Subject: LIFE — [Company Name]

Hi [First Name]

LIFE, one of America's most iconic media brands, is undergoing a ground-up rebuild — reimagined as a quarterly large-format magazine and cultural platform launching this September with Karlie Kloss and Josh Kushner as Publishers.

The first issue is "Where Are We Now?" — a portrait of an America under construction. We'll sit with the engineers, scientists, policymakers, and artists at the frontier to understand how far their work has moved from concept to condition. It is, at its core, a story of American progress, told through the eyes of the people living it.

[COMPANY] has been on our list from the start. [PERSONALIZED WHY — one or two specific, researched sentences about why this company is a natural fit: reference a real recent campaign, brand commitment, cultural move, or values alignment. Be specific and concrete, not generic.]

We're in conversation with a very small number of founding partners. The model prioritises depth over reach and is designed for creative collaboration rather than a media buy.

Can we jump on a call over the next couple of weeks to discuss?

Warm regards,
Jo
---

OUTPUT FORMAT:
Return ONLY a valid JSON array with exactly 3 objects. No explanation, no markdown fences, just raw JSON:
[
  {
    "name": "First Last",
    "title": "CMO",
    "company": "Company Name",
    "email": "first.last@company.com",
    "email_confidence": "estimated",
    "why": "One specific sentence explaining why this company is a natural LIFE founding partner.",
    "draft_subject": "LIFE — Company Name",
    "draft_body": "Hi First\\n\\nLIFE, one of America's most iconic..."
  }
]

email_confidence should be "verified" if you found it explicitly stated, or "estimated" if constructed from pattern.`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[daily-prospects] Starting for ${today()}`);

  // 1. Check if we've already run today
  const { data: existing } = await supabase
    .from('daily_prospects')
    .select('id')
    .eq('date', today());
  if (existing && existing.length >= 3) {
    console.log(`[daily-prospects] Already have ${existing.length} prospects for today. Skipping.`);
    process.exit(0);
  }

  // 2. Build exclusion list
  console.log('[daily-prospects] Fetching exclusion list…');
  const exclusionList = await fetchExclusionList();
  console.log(`[daily-prospects] Excluding ${exclusionList.length} companies`);

  // 3. Call Claude with web_search
  console.log('[daily-prospects] Calling Claude API…');
  const prompt = buildPrompt(exclusionList);

  let rawResponse = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract text from the final response (may follow tool use blocks)
  for (const block of response.content) {
    if (block.type === 'text') {
      rawResponse += block.text;
    }
  }
  inputTokens  = response.usage?.input_tokens  ?? 0;
  outputTokens = response.usage?.output_tokens ?? 0;

  // Handle multi-turn tool use: Claude may need to respond to search results
  // The SDK handles the agentic loop — if stop_reason is tool_use, continue
  let currentResponse = response;
  const messages = [{ role: 'user', content: prompt }];

  while (currentResponse.stop_reason === 'tool_use') {
    // Collect tool results
    const toolResults = [];
    for (const block of currentResponse.content) {
      if (block.type === 'tool_use') {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: '{}', // web_search handles its own results internally
        });
      }
    }

    messages.push({ role: 'assistant', content: currentResponse.content });
    messages.push({ role: 'user', content: toolResults });

    currentResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
    });

    rawResponse = '';
    for (const block of currentResponse.content) {
      if (block.type === 'text') rawResponse += block.text;
    }
    inputTokens  += currentResponse.usage?.input_tokens  ?? 0;
    outputTokens += currentResponse.usage?.output_tokens ?? 0;
  }

  console.log(`[daily-prospects] Claude responded (${inputTokens} in / ${outputTokens} out tokens)`);
  console.log('[daily-prospects] Raw response:\n', rawResponse.slice(0, 500));

  // 4. Parse JSON
  let prospects;
  try {
    // Strip any accidental markdown fences
    const cleaned = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    prospects = JSON.parse(cleaned);
    if (!Array.isArray(prospects) || prospects.length < 1) throw new Error('Expected array');
  } catch (err) {
    console.error('[daily-prospects] Failed to parse JSON:', err.message);
    console.error('[daily-prospects] Raw was:', rawResponse);
    process.exit(1);
  }

  // 5. Validate and insert
  const rows = prospects.slice(0, 3).map(p => ({
    id:               generateId(),
    date:             today(),
    name:             String(p.name   || '').trim(),
    title:            String(p.title  || '').trim(),
    company:          String(p.company || '').trim(),
    email:            String(p.email  || '').trim(),
    email_confidence: String(p.email_confidence || 'estimated'),
    why:              String(p.why    || '').trim(),
    draft_subject:    String(p.draft_subject || '').trim(),
    draft_body:       String(p.draft_body    || '').trim(),
    status:           'pending',
  }));

  for (const row of rows) {
    if (!row.name || !row.company || !row.why || !row.draft_body) {
      console.error('[daily-prospects] Incomplete row:', row);
      process.exit(1);
    }
  }

  const { error } = await supabase.from('daily_prospects').insert(rows);
  if (error) {
    console.error('[daily-prospects] Supabase insert error:', error);
    process.exit(1);
  }

  console.log(`[daily-prospects] Inserted ${rows.length} prospects:`);
  rows.forEach(r => console.log(`  • ${r.name} (${r.title}) @ ${r.company} — ${r.email}`));
  console.log('[daily-prospects] Done.');
}

main().catch(err => {
  console.error('[daily-prospects] Fatal error:', err);
  process.exit(1);
});
