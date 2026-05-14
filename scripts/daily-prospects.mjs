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
    'Anthropic', 'OpenAI', 'xAI', 'Perplexity AI', 'Scale AI', 'Runway', 'Cohere',
    'Databricks', 'Palantir', 'Snowflake', 'Stripe', 'Coinbase', 'LinkedIn',
    'Uber', 'Airbnb', 'Pinterest', 'Figma', 'Canva', 'Oracle', 'Cisco',
    'Samsung Electronics', 'Spotify', 'Netflix', 'Amazon', 'Instacart', 'DoorDash',
    'Reddit', 'Substack', 'beehiiv', 'Arc Browser', 'Notion', 'Slack', 'Zoom',
  ],
  'luxury, fashion, or consumer lifestyle': [
    'LVMH', 'Louis Vuitton', 'Christian Dior', 'Hermès', 'Chanel', 'Kering', 'Gucci',
    'Saint Laurent', 'Bottega Veneta', 'Richemont', 'Cartier', 'Rolex', 'Prada',
    'Burberry', 'Ralph Lauren', 'Tiffany & Co.', 'Bulgari', 'Moncler',
    'Brunello Cucinelli', 'Loro Piana', 'Tom Ford', 'Valentino', 'Loewe',
    'Net-a-Porter', 'Saks Fifth Avenue', 'Neiman Marcus', 'Bergdorf Goodman',
    'lululemon', 'Alo Yoga', 'Vuori', 'Arc\'teryx', 'Patagonia',
    'Estée Lauder', 'NARS', 'Charlotte Tilbury', 'Aesop', 'Byredo',
    'Williams-Sonoma', 'RH (Restoration Hardware)', 'Sonos', 'Bang & Olufsen',
  ],
  'finance, hospitality, or automotive': [
    'JPMorgan Chase', 'Goldman Sachs', 'Morgan Stanley', 'American Express',
    'Mastercard', 'Visa', 'BlackRock', 'Capital One', 'Fidelity Investments',
    'UBS', 'Citi', 'Bank of America', 'Charles Schwab', 'Bridgewater Associates',
    'Aman Resorts', 'Four Seasons', 'Rosewood Hotels', 'Belmond', 'Six Senses',
    'Marriott Bonvoy', 'Hilton', 'Mandarin Oriental', 'Park Hyatt', 'The Peninsula',
    'Porsche', 'Ferrari', 'Bentley', 'Rolls-Royce', 'Aston Martin',
    'BMW', 'Mercedes-Benz', 'Audi', 'Lamborghini', 'McLaren', 'Cadillac',
    'Delta Air Lines', 'United Airlines', 'American Airlines', 'Emirates', 'Lufthansa',
    'NetJets', 'Wheels Up',
  ],
};

const CATEGORIES = [
  'tech or AI',
  'luxury, fashion, or consumer lifestyle',
  'finance, hospitality, or automotive',
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
  return all;
}

function buildSystemPrompt(category, companyPool, newsletterContext) {
  const newsletterSection = newsletterContext ? `
NEWSLETTER INTELLIGENCE — "Headlines by Abe Burns" (last 14 days):
${newsletterContext}

Use the above newsletter content to:
1. Identify companies, campaigns, leadership moves, or brand moments mentioned — these are PRIORITY picks
2. Find the specific person named in connection with a company story — pitch them directly
3. Use the headline/story as the WHY if it's from the last 90 days

` : '';

  return `You are a chief revenue officer advising Jo Mayer Jones at LIFE magazine — relaunching September 2026 as a quarterly large-format magazine with Karlie Kloss and Josh Kushner as Publishers. First issue: "Where Are We Now?" — America under construction. Founding partners contribute $500K for a year-long creative partnership (not an ad buy — a cultural co-authorship).

LIFE's editorial pillars: American progress, culture, science, technology, people at the frontier. The brand's power is prestige + longevity + cultural legitimacy at a moment when most media has none.

A good LIFE founding partner is a brand that:
- Is making a cultural or strategic bet right now (launch, rebrand, new market, new leadership, IPO, milestone)
- Wants to be associated with quality, depth, and American optimism — not impressions
- Has a CMO or brand leader who thinks like an editor, not a media buyer

TARGET: Find 1 senior decision-maker (CMO, Chief Brand Officer, VP Marketing, SVP Brand Partnerships, or equivalent) at a brand in the ${category} sector.

COMPANY POOL — choose the company with the STRONGEST timing rationale right now:
${companyPool.join(', ')}

RESEARCH STEPS — use web search for all of these:
1. Scan the pool for companies with a recent launch, rebrand, campaign, leadership hire, cultural moment, or market expansion in the last 6 months. Pick the one with the best "why now" story.
2. Search "[company] CMO 2025" or "[company] Chief Marketing Officer" to find the current decision-maker. Verify they are still in role via LinkedIn or recent press (2024–2025).
3. Search for the contact's email in public sources: speaker bios at marketing conferences (Cannes Lions, ANA, SXSW), press releases quoting them, company newsroom bylines.
4. Search "[company] [campaign/launch/moment name]" to get the specific detail you'll use in the WHY.

EMAIL RULES:
- If you find the email in a public source → set email_confidence "verified"
- If you cannot find it in a public source → return email as "" (empty string) and email_confidence as "estimated". DO NOT guess or infer. Blank is correct.

WHY FIELD RULES:
- Must reference a SPECIFIC, NAMED thing: a campaign name, launch date, product name, exec quote, award, partnership, or cultural moment
- MUST be from within the last 90 days (February 2025 or later). DO NOT reference campaigns or moments from 2024 or earlier.
- If the company appeared in the Headlines newsletter context above, use that story as the WHY
- Generic statements ("known for quality", "strong brand values") are NOT acceptable
- Format: one sentence, present tense, specific noun. Example: "Your 'Crafted for Life' rebrand this spring — repositioning [Company] from performance to cultural longevity — maps directly to what LIFE is building."

EMAIL TEMPLATE:
Subject: LIFE — [Company]
Hi [First Name]
LIFE, one of America's most iconic media brands, is undergoing a ground-up rebuild — reimagined as a quarterly large-format magazine and cultural platform launching this September with Karlie Kloss and Josh Kushner as Publishers.
The first issue is "Where Are We Now?" — a portrait of an America under construction, told through the engineers, scientists, policymakers, and artists at the frontier.
[Company] has been on our list from the start. [WHY — the specific sentence from the why field above.]
We're speaking with a small number of founding partners — creative collaboration, not a media buy.
Can we jump on a call over the next couple of weeks?
Warm regards, Jo

Return ONLY a JSON object (no prose, no markdown fences):
{"name":"","title":"","company":"","email":"","email_confidence":"verified or estimated","why":"","draft_subject":"","draft_body":""}
Return exactly 1 object.${newsletterSection}`;
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

async function generateProspects(exclusionList, newsletterContext) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const prospects = [];

  for (let i = 0; i < CATEGORIES.length; i++) {
    const category = CATEGORIES[i];
    const alreadyFound = prospects.map(p => p.company).join(', ');
    const skipNote = alreadyFound ? `\nAlso skip these already found today: ${alreadyFound}` : '';

    // Filter pool to remove excluded companies
    const lowerExclusions = [...exclusionList, ...prospects.map(p => p.company)].map(c => c.toLowerCase());
    const pool = COMPANY_POOLS[category].filter(c => !lowerExclusions.includes(c.toLowerCase()));

    const systemPrompt = buildSystemPrompt(category, pool.length > 0 ? pool : COMPANY_POOLS[category], newsletterContext);

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
