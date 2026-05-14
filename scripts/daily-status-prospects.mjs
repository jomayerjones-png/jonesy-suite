/**
 * daily-status-prospects.mjs
 * Runs every weekday at 8am EST via GitHub Actions.
 * Identifies 3 senior sponsor prospects for Status newsletter,
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
  'tech or AI': [
    'Google', 'Microsoft', 'Meta', 'Apple', 'Amazon', 'Nvidia', 'Adobe', 'Salesforce',
    'LinkedIn', 'Netflix', 'Spotify', 'Stripe', 'Coinbase', 'Palantir', 'Snowflake',
    'Databricks', 'OpenAI', 'Anthropic', 'Perplexity AI', 'Scale AI', 'Cohere',
    'Oracle', 'Cisco', 'IBM', 'Samsung Electronics', 'Uber', 'Airbnb', 'DoorDash',
    'Pinterest', 'Reddit', 'Substack', 'beehiiv', 'Figma', 'Canva', 'Notion', 'Zoom',
  ],
  'finance, consulting, or professional services': [
    'JPMorgan Chase', 'Goldman Sachs', 'Morgan Stanley', 'BlackRock', 'Blackstone',
    'Fidelity Investments', 'American Express', 'Mastercard', 'Visa', 'Capital One',
    'UBS', 'Citi', 'Bank of America', 'Charles Schwab', 'Bridgewater Associates',
    'McKinsey & Company', 'BCG', 'Bain & Company', 'Deloitte', 'Accenture',
    'PwC', 'EY', 'KPMG', 'Edelman', 'Weber Shandwick',
  ],
  'media, entertainment, or Hollywood': [
    'Disney', 'Warner Bros. Discovery', 'Paramount Global', 'Universal Pictures',
    'Netflix', 'Amazon MGM Studios', 'Apple TV+', 'Hulu', 'HBO',
    'CAA', 'WME', 'UTA', 'IMG', 'Endeavor',
    'Condé Nast', 'Hearst', 'Meredith', 'The Atlantic', 'Axios',
    'Puck', 'Vox Media', 'iHeartMedia', 'Spotify', 'SiriusXM',
    'Variety', 'Hollywood Reporter', 'Deadline', 'The Wrap',
  ],
};

const CATEGORIES = [
  'tech or AI',
  'finance, consulting, or professional services',
  'media, entertainment, or Hollywood',
];

// ── Exclusion list ────────────────────────────────────────────────

async function getExclusionList() {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [clientsRes, prospectsRes] = await Promise.all([
    supabase.from('status_clients').select('data'),
    supabase.from('status_daily_prospects').select('company').gte('date', cutoff),
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

// ── Prompt ────────────────────────────────────────────────────────

function buildSystemPrompt(category, companyPool, newsletterContext) {
  const newsletterSection = newsletterContext ? `\n\nNEWSLETTER INTELLIGENCE — "Headlines by Abe Burns" (last 14 days):\n${newsletterContext}\n\nUse the above to: 1) prioritise companies/people mentioned, 2) use the specific story as the WHY if from last 90 days.` : '';
  return `You are the Head of Partnerships at Status — the essential daily media intelligence newsletter for America's media, Hollywood, and tech decision-makers. Founded by Oliver Darcy (former CNN senior media reporter). 110,000+ subscribers, 40% daily open rate, growing 10% every month. Widely cited by the NYT, WSJ, CNN, Variety, Bloomberg. The direct line to media's power brokers.

Status sponsorship products:
- Solo Newsletter Sponsorship: one brand, one edition, 110K+ readers, 40% open rate
- Branded Content: native editorial in the Status voice
- Event Sponsorship: Power Players Podcast, Breaking the Status Quo Awards, Insiders event series
- Podcast: flagship Status podcast to the same power-player audience

A strong Status sponsor is a brand that:
- Wants direct, targeted access to America's media, entertainment, and tech decision-makers
- Is making a move right now: launch, relaunch, rebrand, campaign, new market, leadership hire
- Has a CMO, VP Marketing, or Head of Partnerships who understands earned reach and quality audiences — not just impressions

TARGET: Find 1 senior decision-maker (CMO, VP Marketing, SVP Brand, Head of Partnerships, SVP Communications, or equivalent) at a brand in the ${category} sector.

COMPANY POOL — choose the company with the STRONGEST timing rationale right now:
${companyPool.join(', ')}

RESEARCH STEPS — use web search for all of these:
1. Scan the pool for companies with a recent campaign, launch, rebrand, leadership hire, or cultural moment in the last 6 months. Pick the one with the best "why now" story.
2. Search "[company] CMO 2025" or "[company] VP Marketing" or "[company] Head of Partnerships" to find the current decision-maker. Verify they are still in role via LinkedIn or recent press.
3. Search for the contact's email in public sources: speaker bios, press releases, conference agendas (IAB, Cannes Lions, Advertising Week, SXSW). If not verifiable, return "" — never guess.
4. Search "[company] [campaign/launch/moment name]" to find the specific detail for the WHY field.

EMAIL RULES:
- If found in a public source → email_confidence "verified"
- If not found → email "" and email_confidence "estimated"

WHY FIELD RULES:
- One sentence, present tense, specific: name a campaign, launch, product, partnership, or exec quote
- MUST be from within the last 90 days (February 2025 or later). DO NOT reference 2024 or earlier.
- If the company appeared in the Headlines newsletter context, use that story as the WHY
- No generics ("strong values", "great audience fit")
- Example: "Your 'Open to More' B2B campaign this spring — targeting CFOs and decision-makers — maps directly to the Status audience that reads us every morning."

EMAIL TEMPLATE:
Subject: Status — [Company]
Hi [First Name]
I'm reaching out from Status — the daily media intelligence newsletter founded by Oliver Darcy, read by the decision-makers driving American media, Hollywood, and tech.
We have 110,000+ subscribers and a 40% daily open rate — and our readers are the people your brand needs in the room: studio chiefs, newsroom leaders, tech executives, and Washington power players.
[Company] has been on our list. [WHY — the specific sentence from the why field.]
We'd love to talk about a sponsorship that puts your brand directly in front of this audience. Solo newsletter, branded content, events — or a combination.
Would you have 20 minutes this week?
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

    const userMessage = `Today is ${today}. Find 1 real senior contact for Status's sponsorship pipeline.
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

  const { error } = await supabase.from('status_daily_prospects').insert(rows);
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
