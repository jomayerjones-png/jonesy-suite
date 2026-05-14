/**
 * daily-kaleidoscope-prospects.mjs
 * Runs every weekday at 8am EST via GitHub Actions.
 * Identifies 3 senior sponsor prospects for Kaleidoscope's podcast network,
 * verifies contacts via web search, then inserts into Supabase.
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

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ── Company pools by category ─────────────────────────────────────

const COMPANY_POOLS = {
  'technology or AI': [
    'Google', 'Microsoft', 'Meta', 'Apple', 'Amazon', 'Nvidia', 'Adobe', 'Salesforce',
    'IBM', 'Cisco', 'Intel', 'Qualcomm', 'SAP', 'Workday', 'ServiceNow', 'Snowflake',
    'Databricks', 'OpenAI', 'Anthropic', 'Cohere', 'Scale AI', 'Palantir',
    'LinkedIn', 'Uber', 'Airbnb', 'Stripe', 'Coinbase', 'Figma', 'Notion',
    'Oracle', 'Dell', 'HPE', 'Lenovo', 'Siemens', 'GE Vernova',
  ],
  'pharma, biotech, or life sciences': [
    'Pfizer', 'Merck', 'Johnson & Johnson', 'AbbVie', 'Eli Lilly', 'Bristol-Myers Squibb',
    'AstraZeneca', 'Novartis', 'Roche', 'Genentech', 'Moderna', 'BioNTech',
    'Regeneron', 'Vertex Pharmaceuticals', 'Biogen', 'Gilead Sciences', 'Amgen',
    'Illumina', '23andMe', 'Calico', 'Hims & Hers Health', 'GoodRx', 'Tempus',
    'CRISPR Therapeutics', 'Beam Therapeutics', 'Prime Medicine',
  ],
  'financial services, automotive, or premium consumer': [
    'JPMorgan Chase', 'Goldman Sachs', 'Morgan Stanley', 'BlackRock', 'Fidelity',
    'American Express', 'Mastercard', 'Visa', 'Capital One', 'Charles Schwab',
    'Tesla', 'Rivian', 'Lucid Motors', 'BMW', 'Mercedes-Benz', 'Audi', 'Porsche',
    'LVMH', 'Kering', 'Hermès', 'Rolex', 'Patagonia', 'REI', 'Arc\'teryx',
    'Peloton', 'Whoop', 'Garmin', 'DJI', 'GoPro', 'Sonos',
  ],
};

const CATEGORIES = [
  'technology or AI',
  'pharma, biotech, or life sciences',
  'financial services, automotive, or premium consumer',
];

// ── Exclusion list ────────────────────────────────────────────────

async function getExclusionList() {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [clientsRes, prospectsRes] = await Promise.all([
    supabase.from('kaleidoscope_clients').select('data'),
    supabase.from('kaleidoscope_daily_prospects').select('company').gte('date', cutoff),
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

async function loadNewsletterContext() {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data } = await supabase
    .from('newsletter_cache')
    .select('subject, sent_date, content')
    .gte('sent_date', cutoff)
    .order('sent_date', { ascending: false })
    .limit(5);
  if (!data || data.length === 0) return null;
  return data.map(r => `--- ${r.subject} (${r.sent_date}) ---\n${r.content.slice(0, 2000)}`).join('\n\n');
}

// ── Prompt ────────────────────────────────────────────────────────

function buildSystemPrompt(category, companyPool, newsletterContext) {
  const newsletterSection = newsletterContext ? `\n\nNEWSLETTER INTELLIGENCE — "Headlines by Abe Burns" (last 14 days):\n${newsletterContext}\n\nUse the above to: 1) prioritise companies/people mentioned, 2) use the specific story as the WHY if from last 90 days.` : '';
  return `You are the Head of Partnerships at Kaleidoscope — iHeart's flagship science and technology podcast network, "the National Geographic of podcasting." Founded by Oz Woloshyn (TechStuff, 100M+ downloads) and Mangesh Hattikudur. $5M Series A in 2025. 1 million monthly listeners. Advisory: Tom Freston (former Viacom CEO), Erin Coles (former Apple Podcasts), Robert Wong (Google Creative Lab).

THE SHOWS:
- The Builders with Walter Isaacson — Q4 2026, technology and innovation flagship
- Two Percent with Michael Easter — Q2 2026, the margins separating good from great
- TechStuff with Oz Woloshyn — 100M+ downloads, flagship evergreen tech
- No Such Thing as a Fish — Apple's Best Podcast 2025
- Shell Game with Evan Ratliff — Apple's #1 Tech Podcast
- Inventors with Simone Giertz — Q3 2026, the YouTube inventor sensation's first major podcast
- Superhuman with Chris Gayomali — Q3 2026, science of human optimization (ex-WIRED)
- How to Live Forever with Mangesh Hattikudur — longevity science
- De-Extinction — Q4 2026, bringing back lost species

COMMERCIAL PRODUCTS:
1. Custom Partnerships — co-produced original shows or series built around a brand's narrative (e.g., WIRED's "Uncanny Valley," The Atlantic's AI series, Bloomberg's "Levittown" — Webby Award finalist, Google + aiEDU)
2. Creative Sponsorship — host-read, deeply integrated show sponsorship, one brand per show
3. Events + Live Activation — live shows, brand activations tied to Kaleidoscope talent and shows

BRAND VALUES: Inspiration · Entertainment · Optimism · Wonder
Tagline: "Illuminating the Frontiers of Discovery"

A strong Kaleidoscope partner is a brand that:
- Wants association with curiosity, discovery, science, and human ambition — not clickbait
- Is aligned with the intellectual, high-income audience drawn to Kaleidoscope's shows
- Has something to say about the future — technology, health, exploration, innovation
- Would benefit from the credibility of Walter Isaacson, Simone Giertz, Michael Easter, or Evan Ratliff's audience

TARGET: Find 1 senior decision-maker (CMO, VP Marketing, SVP Brand Strategy, Head of Partnerships, Chief Brand Officer, or equivalent) at a brand in the ${category} sector.

COMPANY POOL — choose the company with the STRONGEST alignment to Kaleidoscope's shows and audience right now:
${companyPool.join(', ')}

RESEARCH STEPS — use web search for all of these:
1. Scan the pool for companies with a recent campaign, product launch, rebrand, leadership hire, or cultural/scientific moment in the last 6 months. Pick the one with the strongest "why Kaleidoscope, why now" story — ideally tied to a specific show.
2. Search "[company] CMO 2025" or "[company] VP Marketing" or "[company] Head of Partnerships" to find the current decision-maker. Verify they are still in role via LinkedIn or recent press.
3. Search for the contact's email in public sources: speaker bios, press releases, conference agendas (Cannes Lions, SXSW, CES, Advertising Week). If not verifiable, return "" — never guess.
4. Search "[company] [campaign/launch/moment]" to find the specific detail for the WHY field.

EMAIL RULES:
- If found in a public source → email_confidence "verified"
- If not found → email "" and email_confidence "estimated"

WHY FIELD RULES:
- One sentence, present tense, specific: name a campaign, product launch, partnership, or brand positioning move
- MUST be from within the last 90 days (February 2025 or later). DO NOT reference 2024 or earlier.
- If the company appeared in the Headlines newsletter context, use that story as the WHY
- Connect it to a specific Kaleidoscope show or the Kaleidoscope audience directly
- No generics ("values alignment", "great fit for podcasting")
- Example: "Your 'AI for Everyone' campaign this spring — and the way it positions [Company] as a technology educator — is exactly the space The Builders with Walter Isaacson is made for."

EMAIL TEMPLATE:
Subject: Kaleidoscope — [Company]
Hi [First Name]
LIFE's partner studio Kaleidoscope is iHeart's flagship science and technology podcast network — 1 million monthly listeners, Apple's Best Podcast 2025, and The Builders with Walter Isaacson launching this autumn.

We produce deeply reported audio at the intersection of science, technology, discovery, and human ambition. "The National Geographic of podcasting."

[Company] has been on our list from the start. [WHY — the specific sentence from the why field.]

We're building out our founding partner roster now and speaking with a small number of brands who want to be part of something built for the long term. I'd love to share what that looks like.

Would you have time for a call over the next couple of weeks?

Warm regards,
Johanna

Return ONLY a JSON object (no prose, no markdown fences):
{"name":"","title":"","company":"","email":"","email_confidence":"verified or estimated","why":"","draft_subject":"","draft_body":""}
Return exactly 1 object.${newsletterSection}`;
}

// ── API calls ─────────────────────────────────────────────────────

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

async function generateProspects(exclusionList, newsletterContext) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const prospects = [];

  for (let i = 0; i < CATEGORIES.length; i++) {
    const category = CATEGORIES[i];
    const alreadyFound = prospects.map(p => p.company).join(', ');
    const skipNote = alreadyFound ? `\nAlso skip these already found today: ${alreadyFound}` : '';

    const lowerExclusions = [...exclusionList, ...prospects.map(p => p.company)].map(c => c.toLowerCase());
    const pool = COMPANY_POOLS[category].filter(c => !lowerExclusions.includes(c.toLowerCase()));

    const systemPrompt = buildSystemPrompt(category, pool.length > 0 ? pool : COMPANY_POOLS[category], newsletterContext);

    const userMessage = `Today is ${today}. Find 1 real senior contact for Kaleidoscope's sponsorship pipeline.
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

  const { error } = await supabase.from('kaleidoscope_daily_prospects').insert(rows);
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);

  console.log(`Inserted ${rows.length} prospects for ${today}:`);
  rows.forEach((r) => console.log(`  • ${r.name} (${r.title}) @ ${r.company} — ${r.email || 'no email'} [${r.email_confidence}]`));
}

async function main() {
  try {
    const [exclusionList, newsletterContext] = await Promise.all([
      getExclusionList(),
      loadNewsletterContext(),
    ]);
    if (newsletterContext) console.log('Newsletter context loaded ✓');
    else console.log('No newsletter context (table empty or no recent issues)');
    const prospects = await generateProspects(exclusionList, newsletterContext);
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
