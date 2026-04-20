/**
 * daily-prospects.mjs
 * Runs every weekday at 8am EST via GitHub Actions.
 * Identifies 3 senior prospects (1 tech/AI, 1 luxury/fashion, 1 finance/auto/media),
 * uses web search to verify contacts and find emails, then inserts into Supabase.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = 'https://jqlzpdeuqocgvrzxyptu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pTeNDh39W3EjsJSkate0Kg_hbt1eq_4';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const supabaseAdmin = supabase;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ── Curated company pools by category ────────────────────────────
// Sources: Time Top 100 Most Influential AI Companies, Fast Company Most Innovative,
// Fortune 500 cultural/prestige brands, Adweek Power List advertisers

const COMPANY_POOLS = {
  'tech or AI': [
    'Google', 'Microsoft', 'Meta', 'Nvidia', 'Apple', 'Adobe', 'Salesforce', 'IBM',
    'Intel', 'AMD', 'Qualcomm', 'Anthropic', 'OpenAI', 'xAI', 'Perplexity AI',
    'Scale AI', 'Runway', 'Cohere', 'Databricks', 'Palantir', 'Snowflake', 'Stripe',
    'Coinbase', 'LinkedIn', 'Uber', 'Airbnb', 'Pinterest', 'Snap', 'Figma', 'Canva',
    'Oracle', 'Cisco', 'Dell Technologies', 'HP', 'Lenovo', 'Samsung Electronics',
    'Spotify', 'Netflix', 'Amazon',
  ],
  'luxury or fashion': [
    'LVMH', 'Louis Vuitton', 'Christian Dior', 'Hermès', 'Chanel', 'Kering', 'Gucci',
    'Saint Laurent', 'Bottega Veneta', 'Balenciaga', 'Richemont', 'Cartier',
    'Van Cleef & Arpels', 'Rolex', 'Prada', 'Miu Miu', 'Burberry', 'Ralph Lauren',
    'Tapestry', 'Coach', 'Kate Spade', 'Tiffany & Co.', 'Bulgari', 'Moncler',
    'Brunello Cucinelli', 'Ermenegildo Zegna', 'Tod\'s', 'Loewe', 'Celine',
    'Valentino', 'Versace', 'Dolce & Gabbana', 'Loro Piana', 'Tom Ford',
    'Net-a-Porter', 'Farfetch', 'Saks Fifth Avenue', 'Neiman Marcus',
    'lululemon', 'Alo Yoga', 'Vuori', 'Patagonia', 'Arc\'teryx',
  ],
  'finance, automotive, or media': [
    'JPMorgan Chase', 'Goldman Sachs', 'Morgan Stanley', 'American Express',
    'Mastercard', 'Visa', 'BlackRock', 'Capital One', 'Fidelity Investments',
    'UBS', 'Citi', 'Bank of America', 'Charles Schwab', 'Vanguard',
    'Bridgewater Associates', 'Two Sigma', 'Citadel',
    'Porsche', 'Ferrari', 'Bentley', 'Rolls-Royce', 'Aston Martin',
    'BMW', 'Mercedes-Benz', 'Audi', 'Lamborghini', 'McLaren',
    'Tesla', 'Rivian', 'Lucid Motors', 'Cadillac',
    'Condé Nast', 'Hearst', 'Bloomberg', 'The Atlantic', 'Vox Media',
    'Disney', 'Warner Bros Discovery', 'NBCUniversal', 'Apple TV+',
    'Substack', 'beehiiv', 'The New York Times', 'Washington Post',
  ],
};

const CATEGORIES = [
  'tech or AI',
  'luxury or fashion',
  'finance, automotive, or media',
];

// ── Helpers ───────────────────────────────────────────────────────

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

function buildSystemPrompt(category, companyPool) {
  return `You are a BD researcher for Jo Mayer Jones at LIFE magazine — relaunching September 2026 as a quarterly large-format magazine with Karlie Kloss and Josh Kushner as Publishers. First issue: "Where Are We Now?" — America under construction. Founding partners contribute $500K for a year-long creative partnership.

TARGET: Find 1 senior marketing decision-maker (CMO, Chief Brand Officer, VP Marketing, SVP Partnerships, or equivalent) at a brand in the ${category} sector.

COMPANY POOL — pick one you think is a strong LIFE founding partner fit:
${companyPool.join(', ')}

RESEARCH STEPS (use web search for each):
1. Search "[chosen company] CMO 2025" or "[chosen company] Chief Marketing Officer" to identify the current decision-maker
2. Verify the person is still in role — check LinkedIn, recent press releases, company news from 2024–2025
3. Search for their email: check company press releases, speaker bios at conferences, journalism bylines, or company website footer
4. Search "[company name] campaign 2024 2025" or "[company name] brand strategy" to find a specific recent move that connects them to LIFE's editorial world

EMAIL CONFIDENCE RULES:
- Set "verified" ONLY if you found the email in a public source (press release, speaker bio, company website)
- Set "estimated" if you're inferring the format from the company's known email pattern (e.g. firstname.lastname@company.com)
- Common corporate email formats: firstname.lastname@company.com · firstname@company.com · f.lastname@company.com

EMAIL TEMPLATE to draft:
Subject: LIFE — [Company]
Hi [First Name]
LIFE, one of America's most iconic media brands, is undergoing a ground-up rebuild — reimagined as a quarterly large-format magazine and cultural platform launching this September with Karlie Kloss and Josh Kushner as Publishers.
The first issue is "Where Are We Now?" — a portrait of an America under construction, told through the engineers, scientists, policymakers, and artists at the frontier.
[Company] has been on our list from the start. [ONE specific researched sentence: a real recent campaign, brand move, or cultural moment that makes them a natural LIFE founding partner.]
We're speaking with a small number of founding partners — creative collaboration, not a media buy.
Can we jump on a call over the next couple of weeks?
Warm regards, Jo

Return ONLY a JSON object (no prose, no markdown fences):
{"name":"","title":"","company":"","email":"","email_confidence":"verified or estimated","why":"","draft_subject":"","draft_body":""}
Return exactly 1 object.`;
}

// ── API ───────────────────────────────────────────────────────────

async function callClaudeWithRetry(systemPrompt, userMessage) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: systemPrompt,
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
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const prospects = [];

  for (let i = 0; i < CATEGORIES.length; i++) {
    const category = CATEGORIES[i];
    const alreadyFound = prospects.map(p => p.company).join(', ');
    const skipNote = alreadyFound ? `\nAlso skip these already found today: ${alreadyFound}` : '';

    // Filter pool to remove excluded companies
    const lowerExclusions = [...exclusionList, ...prospects.map(p => p.company)].map(c => c.toLowerCase());
    const pool = COMPANY_POOLS[category].filter(c => !lowerExclusions.includes(c.toLowerCase()));

    const systemPrompt = buildSystemPrompt(category, pool.length > 0 ? pool : COMPANY_POOLS[category]);

    const userMessage = `Today is ${today}. Find 1 real senior contact for LIFE magazine's founding partner pipeline.
Category: ${category}
Use web search to verify the contact is current and find their email.${exclusionList.length > 0 ? `\nDO NOT suggest any of these companies: ${exclusionList.join(', ')}` : ''}${skipNote}

Return the JSON object only.`;

    console.log(`Calling Claude API for prospect ${i + 1}/3 (${category})...`);
    const response = await callClaudeWithRetry(systemPrompt, userMessage);
    console.log('Raw response:', response.content.filter(b => b.type === 'text').map(b => b.text).join('').slice(0, 150), '...');

    const prospect = extractProspect(response);
    prospects.push(prospect);
    console.log(`  ✓ ${prospect.name} @ ${prospect.company} [${prospect.email_confidence}]`);

    if (i < CATEGORIES.length - 1) {
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
  rows.forEach((r) => console.log(`  • ${r.name} (${r.title}) @ ${r.company} — ${r.email} [${r.email_confidence}]`));
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
