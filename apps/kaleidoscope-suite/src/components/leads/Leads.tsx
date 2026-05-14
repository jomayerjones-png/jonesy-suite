import { useState, useEffect, useRef } from 'react';
import { fetchTodayKaleidoscopeProspects, updateKaleidoscopeProspectStatus, KaleidoscopeDailyProspect, supabase } from '../../lib/supabase';

interface LeadsProps {
  onAddToEngaged: (prospect: KaleidoscopeDailyProspect) => void;
}

// ── AI Prospect Generation ───────────────────────────────────────

const COMPANY_POOLS: Record<string, string[]> = {
  'tech or AI': [
    'Google', 'Microsoft', 'Meta', 'Apple', 'Amazon', 'Nvidia', 'Adobe', 'Salesforce',
    'IBM', 'Samsung Electronics', 'Intel', 'Qualcomm', 'OpenAI', 'Anthropic', 'Databricks',
    'Palantir', 'Snowflake', 'Cisco', 'Oracle', 'Figma', 'Canva', 'Notion', 'Stripe',
    'Uber', 'Airbnb', 'Reddit', 'LinkedIn', 'Pinterest', 'Substack', 'beehiiv',
  ],
  'pharma, biotech, or health': [
    'Pfizer', 'Johnson & Johnson', 'Moderna', 'AbbVie', 'Merck', 'Eli Lilly', 'Roche',
    'Novartis', 'AstraZeneca', 'Bristol-Myers Squibb', 'Amgen', 'Gilead Sciences',
    'Regeneron', 'Biogen', 'Illumina', '23andMe', 'Genentech', 'Bayer', 'GSK',
    'Thermo Fisher Scientific', 'Abbott', 'Medtronic', 'Hologic', 'Exact Sciences',
  ],
  'finance, consumer, or media': [
    'JPMorgan Chase', 'Goldman Sachs', 'Morgan Stanley', 'BlackRock', 'Fidelity Investments',
    'American Express', 'Mastercard', 'Visa', 'Capital One', 'Charles Schwab',
    'Patagonia', 'LVMH', 'Rolex', 'BMW', 'Mercedes-Benz', 'Porsche', 'Tesla',
    'Condé Nast', 'The Atlantic', 'Bloomberg', 'WIRED', 'National Geographic',
    'Disney', 'Warner Bros. Discovery', 'Paramount Global', 'iHeartMedia', 'SiriusXM',
  ],
};

const CATEGORIES = [
  'tech or AI',
  'pharma, biotech, or health',
  'finance, consumer, or media',
];

function buildOneProspectPrompt(category: string, pool: string[]): string {
  return `You are the Head of Partnerships at Kaleidoscope — a premium podcast studio and iHeart's flagship science and technology network. "The National Geographic of podcasting." Founded by Oz Woloshyn and Mangesh Hattikudur. 1 million monthly listeners. $5M Series A (2025).

Shows: The Builders with Walter Isaacson (Q4 2026), Two Percent with Michael Easter (Q2 2026), TechStuff with Oz Woloshyn (100M+ downloads), No Such Thing as a Fish (Apple's Best Podcast 2025), Shell Game with Evan Ratliff (Apple's #1 Tech Podcast), Inventors with Simone Giertz (Q3 2026), Superhuman with Chris Gayomali (Q3 2026), How to Live Forever, De-Extinction (Q4 2026).

Sponsorship products:
- Custom Partnerships: co-produced original shows or series built around a brand's narrative (WIRED, The Atlantic, Bloomberg — Webby finalist, Google + aiEDU)
- Creative Sponsorship: host-read, deeply integrated show sponsorship — one brand per show
- Events + Live Activation: live shows and brand activations tied to Kaleidoscope talent

Find 1 senior decision-maker (CMO, VP Marketing, SVP Brand, Head of Partnerships, or equivalent) at a ${category} brand from this pool:
${pool.join(', ')}

Pick the company with the strongest "why Kaleidoscope, why now" rationale. Use your knowledge of recent campaigns, launches, rebrands, or cultural moments from 2024–2025.

WHY: One sentence, present tense, specific — name a real campaign, launch, or brand moment. No generics.
Example: "Your 'Year of AI' campaign positions perfectly alongside The Builders with Walter Isaacson — reaching the founders and investors shaping the next decade."

Draft email:
Subject: Kaleidoscope — [Company]
Hi [First Name]
I'm reaching out from Kaleidoscope — iHeart's flagship science and technology podcast network. 1 million monthly listeners, Apple's Best Podcast 2025, and The Builders with Walter Isaacson launching this autumn. "The National Geographic of podcasting."
We produce deeply reported audio at the intersection of science, technology, discovery, and human ambition.
[Company] has been on our list from the start. [WHY sentence.]
We're building our founding partner roster now and speaking with a small number of brands who want to be part of something built for the long term. I'd love to share what that looks like.
Would you have time for a call over the next couple of weeks?
Warm regards,
Johanna

Return ONLY valid JSON (no prose, no markdown):
{"name":"","title":"","company":"","email":"","email_confidence":"estimated","why":"","draft_subject":"","draft_body":""}`;
}

async function fetchOneKaleidoscopeProspect(
  apiKey: string,
  excludeCompanies: string[],
  category: string,
): Promise<KaleidoscopeDailyProspect> {
  const lower = excludeCompanies.map(c => c.toLowerCase());
  const pool = (COMPANY_POOLS[category] ?? []).filter(c => !lower.includes(c.toLowerCase()));
  const activePool = pool.length >= 5 ? pool : (COMPANY_POOLS[category] ?? []);

  const excludeNote = excludeCompanies.length > 0
    ? `\nDO NOT suggest any of these companies: ${excludeCompanies.join(', ')}`
    : '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: buildOneProspectPrompt(category, activePool),
        messages: [{ role: 'user', content: `Find 1 real senior contact for Kaleidoscope's sponsorship pipeline. Pick the company you're most confident about.${excludeNote}\nReturn the JSON object only.` }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if ((err as { name?: string })?.name === 'AbortError') throw new Error('Request timed out — try again.');
    throw err;
  }
  clearTimeout(timeout);

  if (response.status === 429) {
    await new Promise(r => setTimeout(r, 30_000));
    return fetchOneKaleidoscopeProspect(apiKey, excludeCompanies, category);
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `API error ${response.status}`);
  }

  const data = await response.json() as { content: { type: string; text?: string }[] };
  const text = data.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim();
  const fence = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const obj   = text.match(/\{[\s\S]*?"name"[\s\S]*?\}/);
  const jsonStr = fence?.[1] ?? obj?.[0];
  if (!jsonStr) throw new Error('Could not parse response — try again.');

  let p: { name: string; title: string; company: string; email: string; email_confidence: string; why: string; draft_subject: string; draft_body: string };
  try { p = JSON.parse(jsonStr.replace(/,\s*([}\]])/g, '$1')); }
  catch { throw new Error('Invalid JSON from Claude — try again.'); }

  if (!p.name || !p.company) throw new Error('Incomplete data — try again.');

  const today = new Date().toISOString().split('T')[0];
  const row: KaleidoscopeDailyProspect = {
    id: crypto.randomUUID(),
    date: today,
    name: p.name,
    title: p.title ?? '',
    company: p.company,
    email: p.email ?? '',
    email_confidence: p.email_confidence ?? 'estimated',
    why: p.why ?? '',
    draft_subject: p.draft_subject ?? `Kaleidoscope — ${p.company}`,
    draft_body: p.draft_body ?? '',
    status: 'pending',
  };

  supabase.from('kaleidoscope_daily_prospects').insert(row).then(({ error }) => {
    if (error) console.warn('[Leads] Supabase save failed (showing anyway):', error.message);
  });

  return row;
}

// ── CSV Prospect (generated from upload) ─────────────────────────

interface CsvContact {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  extra: string;
}

type GenStatus = 'idle' | 'generating' | 'done' | 'error';

interface GeneratedProspect {
  contact: CsvContact;
  status: GenStatus;
  why: string;
  draft_subject: string;
  draft_body: string;
  error?: string;
  added: boolean;
}

// ── CSV parsing ───────────────────────────────────────────────────

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = parseRow(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

function detectCol(headers: string[], patterns: string[]): string | null {
  for (const h of headers) {
    if (patterns.some(p => h.toLowerCase().includes(p))) return h;
  }
  return null;
}

function mapContacts(headers: string[], rows: Record<string, string>[]): CsvContact[] {
  const nameCol    = detectCol(headers, ['name', 'contact', 'person', 'full']);
  const titleCol   = detectCol(headers, ['title', 'role', 'position', 'job']);
  const companyCol = detectCol(headers, ['company', 'organization', 'employer', 'brand', 'account', 'firm']);
  const emailCol   = detectCol(headers, ['email', 'e-mail', 'mail']);

  const usedCols = new Set([nameCol, titleCol, companyCol, emailCol].filter(Boolean));
  const extraCols = headers.filter(h => !usedCols.has(h));

  return rows.map((row, i) => {
    const extra = extraCols.map(c => row[c] ? `${c}: ${row[c]}` : '').filter(Boolean).join(' | ');
    return {
      id: `csv-${Date.now()}-${i}`,
      name: (nameCol ? row[nameCol] : '') || '',
      title: (titleCol ? row[titleCol] : '') || '',
      company: (companyCol ? row[companyCol] : '') || '',
      email: (emailCol ? row[emailCol] : '') || '',
      extra,
    };
  }).filter(c => c.name || c.company);
}

// ── Claude call ───────────────────────────────────────────────────

const KALEIDOSCOPE_CONTEXT = `Kaleidoscope is a premium podcast studio and iHeart's flagship science and technology network — "the National Geographic of podcasting." Founded by Oz Woloshyn and Mangesh Hattikudur. 1 million monthly listeners. $5M Series A (2025).

Shows: The Builders with Walter Isaacson (Q4 2026), Two Percent with Michael Easter (Q2 2026), TechStuff with Oz Woloshyn (100M+ downloads), No Such Thing as a Fish (Apple's Best Podcast 2025), Shell Game with Evan Ratliff (Apple's #1 Tech Podcast), Inventors with Simone Giertz (Q3 2026), Superhuman with Chris Gayomali (Q3 2026), How to Live Forever, De-Extinction (Q4 2026).

Sponsorship products:
- Custom Partnerships: co-produced original shows or series built around a brand's narrative (WIRED, The Atlantic, Bloomberg — Webby finalist, Google + aiEDU)
- Creative Sponsorship: host-read, deeply integrated show sponsorship — one brand per show
- Events + Live Activation: live shows and brand activations tied to Kaleidoscope talent

Brand values: Inspiration · Entertainment · Optimism · Wonder
Tagline: "Illuminating the Frontiers of Discovery"`;

const API_KEY_STORAGE = 'kaleidoscope_suite_intel_api_key';

async function generateForContact(contact: CsvContact, apiKey: string): Promise<{ why: string; draft_subject: string; draft_body: string }> {
  const systemPrompt = `You are the Head of Partnerships at Kaleidoscope, writing personalized sponsorship outreach.

${KALEIDOSCOPE_CONTEXT}

Given a contact's details, write:
1. A WHY sentence — one specific, present-tense sentence connecting this brand to a specific Kaleidoscope show or the Kaleidoscope audience. Name a real campaign, product launch, or brand positioning move. No generics.
2. A draft email using this template:

Subject: Kaleidoscope — [Company]
Hi [First Name]

Kaleidoscope is iHeart's flagship science and technology podcast network — 1 million monthly listeners, Apple's Best Podcast 2025, and The Builders with Walter Isaacson launching this autumn. "The National Geographic of podcasting."

We produce deeply reported audio at the intersection of science, technology, discovery, and human ambition.

[Company] has been on our list from the start. [WHY sentence here — specific show alignment or audience rationale.]

We're building our founding partner roster now and speaking with a small number of brands who want to be part of something built for the long term. I'd love to share what that looks like.

Would you have time for a call over the next couple of weeks?

Warm regards,
Johanna

Return ONLY a JSON object:
{"why":"","draft_subject":"","draft_body":""}`;

  const userMessage = `Contact: ${contact.name}${contact.title ? `, ${contact.title}` : ''} at ${contact.company}${contact.email ? ` <${contact.email}>` : ''}${contact.extra ? `\nAdditional context: ${contact.extra}` : ''}

Write the WHY and draft email. Return JSON only.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? `HTTP ${response.status}`);
  }

  const data = await response.json() as { content: { type: string; text?: string }[] };
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');

  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const objMatch = text.match(/\{[\s\S]*?"why"[\s\S]*?\}/);
  const jsonStr = fenceMatch?.[1] ?? objMatch?.[0] ?? null;
  if (!jsonStr) throw new Error('No JSON in response');

  return JSON.parse(jsonStr.replace(/,\s*([}\]])/g, '$1'));
}

// ── Shared card components ────────────────────────────────────────

function ProspectCard({
  prospect,
  onAdd,
}: {
  prospect: KaleidoscopeDailyProspect;
  onAdd: (p: KaleidoscopeDailyProspect) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const added = prospect.status === 'added';

  const copyEmail = async () => {
    await navigator.clipboard.writeText(`Subject: ${prospect.draft_subject}\n\n${prospect.draft_body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`card p-4 transition-all ${added ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-brand-dark">{prospect.name}</span>
            {prospect.email_confidence === 'verified' && (
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">verified email</span>
            )}
          </div>
          <p className="text-xs text-brand-dark/60 mt-0.5">{prospect.title} · {prospect.company}</p>
          {prospect.email && <p className="text-xs text-brand-dark/40 mt-0.5 font-mono">{prospect.email}</p>}
        </div>
        {added && (
          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex-shrink-0">✓ Added</span>
        )}
      </div>
      <p className="mt-2.5 text-xs text-[#7C3AED] italic leading-relaxed">{prospect.why}</p>
      <div className="mt-3">
        <button onClick={() => setExpanded(v => !v)} className="text-xs text-brand-dark/50 hover:text-brand-dark flex items-center gap-1 transition-colors">
          <span>{expanded ? '▾' : '▸'}</span>
          <span>{expanded ? 'Hide email draft' : 'View email draft'}</span>
        </button>
        {expanded && (
          <div className="mt-2 bg-brand-light border border-brand-cream rounded-lg p-3">
            <p className="text-xs font-semibold text-brand-dark mb-1">Subject: {prospect.draft_subject}</p>
            <pre className="text-xs text-brand-dark/70 whitespace-pre-wrap font-sans leading-relaxed">{prospect.draft_body}</pre>
          </div>
        )}
      </div>
      {!added && (
        <div className="mt-3 flex items-center gap-2">
          <button onClick={copyEmail} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-cream bg-white text-brand-dark/70 hover:text-brand-dark hover:border-brand-cream-dark transition-all">
            {copied ? '✓ Copied' : '⎘ Copy Email'}
          </button>
          <button onClick={() => onAdd(prospect)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all">
            + Add to Pipeline
          </button>
        </div>
      )}
    </div>
  );
}

function GeneratedCard({
  item,
  onAdd,
  onCopy,
}: {
  item: GeneratedProspect;
  onAdd: (item: GeneratedProspect) => void;
  onCopy: (item: GeneratedProspect) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    onCopy(item);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (item.status === 'generating') {
    return (
      <div className="card p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-brand-dark/50">Generating for {item.contact.name} @ {item.contact.company}…</span>
        </div>
        <div className="h-3 bg-brand-cream rounded w-full mb-1.5" />
        <div className="h-3 bg-brand-cream rounded w-4/5" />
      </div>
    );
  }

  if (item.status === 'error') {
    return (
      <div className="card p-4 border-red-200">
        <p className="text-xs font-semibold text-brand-dark">{item.contact.name} · {item.contact.company}</p>
        <p className="text-xs text-red-600 mt-1">Error: {item.error}</p>
      </div>
    );
  }

  if (item.status === 'idle') {
    return (
      <div className="card p-4 opacity-50">
        <p className="text-xs text-brand-dark/60">{item.contact.name} · {item.contact.title} · {item.contact.company}</p>
      </div>
    );
  }

  return (
    <div className={`card p-4 transition-all ${item.added ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-brand-dark">{item.contact.name}</span>
          <p className="text-xs text-brand-dark/60 mt-0.5">{item.contact.title} · {item.contact.company}</p>
          {item.contact.email && <p className="text-xs text-brand-dark/40 mt-0.5 font-mono">{item.contact.email}</p>}
        </div>
        {item.added && (
          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex-shrink-0">✓ Added</span>
        )}
      </div>
      <p className="mt-2.5 text-xs text-[#7C3AED] italic leading-relaxed">{item.why}</p>
      <div className="mt-3">
        <button onClick={() => setExpanded(v => !v)} className="text-xs text-brand-dark/50 hover:text-brand-dark flex items-center gap-1 transition-colors">
          <span>{expanded ? '▾' : '▸'}</span>
          <span>{expanded ? 'Hide email draft' : 'View email draft'}</span>
        </button>
        {expanded && (
          <div className="mt-2 bg-brand-light border border-brand-cream rounded-lg p-3">
            <p className="text-xs font-semibold text-brand-dark mb-1">Subject: {item.draft_subject}</p>
            <pre className="text-xs text-brand-dark/70 whitespace-pre-wrap font-sans leading-relaxed">{item.draft_body}</pre>
          </div>
        )}
      </div>
      {!item.added && (
        <div className="mt-3 flex items-center gap-2">
          <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-cream bg-white text-brand-dark/70 hover:text-brand-dark hover:border-brand-cream-dark transition-all">
            {copied ? '✓ Copied' : '⎘ Copy Email'}
          </button>
          <button onClick={() => onAdd(item)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all">
            + Add to Pipeline
          </button>
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="h-4 bg-brand-cream rounded w-2/3 mb-2" />
      <div className="h-3 bg-brand-cream rounded w-1/2 mb-3" />
      <div className="h-3 bg-brand-cream rounded w-full mb-1.5" />
      <div className="h-3 bg-brand-cream rounded w-4/5" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function Leads({ onAddToEngaged }: LeadsProps) {
  const [tab, setTab] = useState<'daily' | 'upload'>('daily');

  // Daily prospects
  const [prospects, setProspects] = useState<KaleidoscopeDailyProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(0);
  const [generateError, setGenerateError] = useState('');

  // Upload state
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? '');
  const [showKey, setShowKey] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [contacts, setContacts] = useState<CsvContact[]>([]);
  const [generated, setGenerated] = useState<GeneratedProspect[]>([]);
  const [csvGenerating, setCsvGenerating] = useState(false);
  const [parseError, setParseError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (apiKey) localStorage.setItem(API_KEY_STORAGE, apiKey);
  }, [apiKey]);

  useEffect(() => {
    fetchTodayKaleidoscopeProspects()
      .then(data => setProspects(data))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load prospects'))
      .finally(() => setLoading(false));
  }, []);

  const handleGenerateNew = async () => {
    const key = apiKey.trim() || localStorage.getItem(API_KEY_STORAGE)?.trim();
    if (!key) { setGenerateError('Enter your Anthropic API key in the Upload Contacts tab first.'); return; }
    setGenerateError('');
    const existing = await fetchTodayKaleidoscopeProspects().catch(() => prospects);
    const excluded = existing.map(p => p.company);
    for (let i = 1; i <= 3; i++) {
      if (i > 1) await new Promise(r => setTimeout(r, 1500));
      setGenerating(i);
      try {
        const p = await fetchOneKaleidoscopeProspect(key, excluded, CATEGORIES[i - 1]);
        excluded.push(p.company);
        setProspects(prev => [...prev, p]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setGenerateError(`Prospect ${i} failed: ${msg}`);
      }
    }
    setGenerating(0);
  };

  const handleAdd = async (prospect: KaleidoscopeDailyProspect) => {
    onAddToEngaged(prospect);
    setProspects(prev => prev.map(p => p.id === prospect.id ? { ...p, status: 'added' } : p));
    updateKaleidoscopeProspectStatus(prospect.id, 'added').catch(() => {});
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setCsvText(text);
      applyParse(text);
    };
    reader.readAsText(file);
  };

  const applyParse = (text: string) => {
    setParseError('');
    setGenerated([]);
    const { headers, rows } = parseCsv(text);
    if (rows.length === 0) { setParseError('No data rows found. Make sure the CSV has a header row.'); return; }
    const mapped = mapContacts(headers, rows);
    if (mapped.length === 0) { setParseError('Could not detect name or company columns.'); return; }
    setContacts(mapped);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) { setParseError('Enter your Anthropic API key first.'); return; }
    if (contacts.length === 0) return;

    abortRef.current = false;
    setCsvGenerating(true);

    const initial: GeneratedProspect[] = contacts.map(c => ({
      contact: c, status: 'idle', why: '', draft_subject: '', draft_body: '', added: false,
    }));
    setGenerated(initial);

    for (let i = 0; i < contacts.length; i++) {
      if (abortRef.current) break;

      setGenerated(prev => prev.map((g, idx) => idx === i ? { ...g, status: 'generating' } : g));

      try {
        const result = await generateForContact(contacts[i], apiKey.trim());
        setGenerated(prev => prev.map((g, idx) =>
          idx === i ? { ...g, status: 'done', why: result.why, draft_subject: result.draft_subject, draft_body: result.draft_body } : g
        ));
      } catch (err) {
        setGenerated(prev => prev.map((g, idx) =>
          idx === i ? { ...g, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' } : g
        ));
      }
    }

    setCsvGenerating(false);
  };

  const handleAddGenerated = (item: GeneratedProspect) => {
    const prospect: KaleidoscopeDailyProspect = {
      id: item.contact.id,
      date: new Date().toISOString().split('T')[0],
      name: item.contact.name,
      title: item.contact.title,
      company: item.contact.company,
      email: item.contact.email,
      email_confidence: 'estimated',
      why: item.why,
      draft_subject: item.draft_subject,
      draft_body: item.draft_body,
      status: 'added',
    };
    onAddToEngaged(prospect);
    setGenerated(prev => prev.map(g => g.contact.id === item.contact.id ? { ...g, added: true } : g));
  };

  const handleCopyGenerated = async (item: GeneratedProspect) => {
    await navigator.clipboard.writeText(`Subject: ${item.draft_subject}\n\n${item.draft_body}`);
  };

  const doneCount = generated.filter(g => g.status === 'done').length;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold text-brand-dark">Leads</h1>
            <p className="text-xs text-brand-dark/50 mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-1 bg-brand-light border border-brand-cream rounded-lg p-1">
            <button
              onClick={() => setTab('daily')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${tab === 'daily' ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-dark/50 hover:text-brand-dark'}`}
            >
              Today's AI Prospects
            </button>
            <button
              onClick={() => setTab('upload')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${tab === 'upload' ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-dark/50 hover:text-brand-dark'}`}
            >
              Upload Contacts
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* ── Daily tab ── */}
          {tab === 'daily' && (
            <>
              <div className="bg-brand-dark rounded-xl px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="bg-[#7C3AED] px-2 py-0.5 flex-shrink-0">
                        <span className="font-mono font-bold text-white text-xs tracking-tight leading-none">K⟡</span>
                      </div>
                      <span className="text-white/40 text-xs font-medium uppercase tracking-widest">Daily Prospect Briefing</span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">
                      3 senior contacts — one from tech/AI, one from pharma/biotech, one from finance/media. Specific show alignment, draft email ready to send.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    {generating > 0 && (
                      <span className="text-xs text-white/40 animate-pulse">{generating}/3…</span>
                    )}
                    {!loading && (
                      <button
                        onClick={handleGenerateNew}
                        disabled={generating > 0}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {generating > 0 ? 'Generating…' : prospects.length > 0 ? '+ More' : 'Generate'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {generateError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                  <p className="text-xs text-red-700">{generateError}</p>
                  <button onClick={() => setGenerateError('')} className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Could not load prospects</p>
                  <p className="text-xs text-red-600 font-mono break-all">{error}</p>
                </div>
              )}

              {loading ? (
                <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
              ) : (
                <>
                  {prospects.map(p => <ProspectCard key={p.id} prospect={p} onAdd={handleAdd} />)}
                  {generating > 0 && Array.from({ length: Math.max(0, 4 - generating) }).map((_, i) => (
                    <SkeletonCard key={`skel-${i}`} />
                  ))}
                  {prospects.length === 0 && generating === 0 && !error && (
                    <div className="text-center py-12">
                      <p className="text-brand-dark/50 font-medium mb-1">No prospects yet today</p>
                      <p className="text-sm text-brand-dark/35 mb-4">Enter your API key in the Upload tab, then hit Generate.</p>
                      <button
                        onClick={handleGenerateNew}
                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all"
                      >
                        Generate Today's Prospects
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Upload tab ── */}
          {tab === 'upload' && (
            <>
              <div className="bg-brand-dark rounded-xl px-5 py-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="bg-[#7C3AED] px-2 py-0.5 flex-shrink-0">
                    <span className="font-mono font-bold text-white text-xs tracking-tight leading-none">K⟡</span>
                  </div>
                  <span className="text-white/40 text-xs font-medium uppercase tracking-widest">Upload &amp; Generate</span>
                </div>
                <p className="text-white text-sm leading-relaxed">
                  Upload a CSV of contacts. Claude writes a personalized Kaleidoscope pitch for each — specific show alignment, WHY sentence, draft email ready to copy.
                </p>
              </div>

              {/* API Key */}
              <div className="bg-brand-light border border-brand-cream rounded-xl p-4 space-y-2">
                <label className="text-xs font-semibold text-brand-dark uppercase tracking-wider">Anthropic API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="w-full px-3 py-2 bg-white border border-brand-cream rounded-lg text-xs font-mono text-brand-dark placeholder-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-ant-api03-…"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-brand-dark/40 hover:text-brand-dark px-1.5 py-0.5 rounded"
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-xs text-brand-dark/40">Shared with Proposal AI — enter once, works across both tabs.</p>
              </div>

              {/* CSV Upload */}
              <div
                className="border-2 border-dashed border-brand-cream rounded-xl p-6 text-center cursor-pointer hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/5 transition-all"
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <p className="text-sm font-medium text-brand-dark/60">Drop CSV here or click to upload</p>
                <p className="text-xs text-brand-dark/35 mt-1">Needs columns: name, title, company — email optional</p>
              </div>

              {/* Or paste */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">Or paste CSV</label>
                <textarea
                  className="w-full px-3 py-2 bg-white border border-brand-cream rounded-lg text-xs font-mono text-brand-dark placeholder-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] resize-y"
                  rows={5}
                  placeholder={"name,title,company,email\nJane Smith,CMO,Acme Corp,jane@acme.com"}
                  value={csvText}
                  onChange={e => { setCsvText(e.target.value); applyParse(e.target.value); }}
                />
              </div>

              {parseError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-700">{parseError}</p>
                </div>
              )}

              {/* Contact preview */}
              {contacts.length > 0 && generated.length === 0 && (
                <div className="card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-dark">{contacts.length} contact{contacts.length !== 1 ? 's' : ''} detected</p>
                    <button
                      onClick={handleGenerate}
                      disabled={csvGenerating || !apiKey.trim()}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Generate Emails →
                    </button>
                  </div>
                  <div className="divide-y divide-brand-cream">
                    {contacts.map(c => (
                      <div key={c.id} className="py-2">
                        <p className="text-xs font-medium text-brand-dark">{c.name}</p>
                        <p className="text-xs text-brand-dark/50">{c.title}{c.title && c.company ? ' · ' : ''}{c.company}{c.email ? ` · ${c.email}` : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generation results */}
              {generated.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">
                      {csvGenerating ? `Generating… ${doneCount}/${contacts.length}` : `${doneCount} email${doneCount !== 1 ? 's' : ''} generated`}
                    </p>
                    {csvGenerating ? (
                      <button onClick={() => { abortRef.current = true; setCsvGenerating(false); }} className="text-xs text-red-500 hover:text-red-700">Stop</button>
                    ) : (
                      <button onClick={() => { setGenerated([]); setContacts([]); setCsvText(''); }} className="text-xs text-brand-dark/40 hover:text-brand-dark">Clear &amp; start over</button>
                    )}
                  </div>
                  {generated.map(item => (
                    <GeneratedCard key={item.contact.id} item={item} onAdd={handleAddGenerated} onCopy={handleCopyGenerated} />
                  ))}
                </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
