import { useState, useEffect, useRef } from 'react';
import { fetchTodayProspects, updateProspectStatus, fetchAllClients, supabase } from '../../lib/supabase';
import type { DailyProspect } from '../../lib/supabase';

interface ImportedContact {
  name: string;
  title: string;
  company: string;
  email: string;
}

const LIFE_API_KEY = 'life_suite_intel_api_key';

// Curated company pools — Time Top 100 AI, Fast Company Most Innovative, luxury/finance/auto lists
const COMPANY_POOLS: Record<string, string[]> = {
  'tech or AI': [
    'Google', 'Microsoft', 'Meta', 'Nvidia', 'Apple', 'Adobe', 'Salesforce', 'IBM',
    'Intel', 'AMD', 'Qualcomm', 'Anthropic', 'OpenAI', 'xAI', 'Perplexity AI',
    'Scale AI', 'Runway', 'Cohere', 'Databricks', 'Palantir', 'Snowflake', 'Stripe',
    'Coinbase', 'LinkedIn', 'Uber', 'Airbnb', 'Pinterest', 'Snap', 'Figma', 'Canva',
    'Oracle', 'Cisco', 'Dell Technologies', 'Samsung Electronics',
  ],
  'luxury or fashion': [
    'LVMH', 'Louis Vuitton', 'Christian Dior', 'Hermès', 'Chanel', 'Kering', 'Gucci',
    'Saint Laurent', 'Bottega Veneta', 'Balenciaga', 'Richemont', 'Cartier',
    'Van Cleef & Arpels', 'Rolex', 'Prada', 'Burberry', 'Ralph Lauren',
    'Tapestry', 'Coach', 'Tiffany & Co.', 'Bulgari', 'Moncler',
    'Brunello Cucinelli', 'Ermenegildo Zegna', 'Loewe', 'Celine', 'Valentino',
    'Net-a-Porter', 'Saks Fifth Avenue', 'Neiman Marcus',
    'lululemon', 'Alo Yoga', 'Patagonia', "Arc'teryx",
  ],
  'finance, automotive, or media': [
    'JPMorgan Chase', 'Goldman Sachs', 'Morgan Stanley', 'American Express',
    'Mastercard', 'Visa', 'BlackRock', 'Capital One', 'Fidelity Investments',
    'UBS', 'Citi', 'Bank of America', 'Charles Schwab', 'Vanguard',
    'Porsche', 'Ferrari', 'Bentley', 'Rolls-Royce', 'Aston Martin',
    'BMW', 'Mercedes-Benz', 'Audi', 'Lamborghini', 'Tesla', 'Rivian', 'Cadillac',
    'Condé Nast', 'Hearst', 'Bloomberg', 'The Atlantic', 'Vox Media',
    'Disney', 'Warner Bros Discovery', 'Netflix', 'Spotify',
  ],
};

const PROSPECT_CATEGORIES = ['tech or AI', 'luxury or fashion', 'finance, automotive, or media'];

// Titles that indicate marketing/brand decision-makers worth outreaching
const SENIOR_TITLE_RE = /\b(cmo|ceo|cfo|cto|coo|cpo|cro|cco|cdo|chief|president|managing director|managing partner|svp|evp|vp |vice president|head of|director|partner|principal|founder|co.?founder)\b/i;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += line[i]; }
  }
  result.push(current);
  return result.map(s => s.trim().replace(/^"|"$/g, ''));
}

function parseContactsCSV(text: string): ImportedContact[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headerLine = lines[0].replace(/^﻿/, ''); // strip BOM
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase());

  const firstIdx = headers.findIndex(h => h === 'first name');
  const lastIdx  = headers.findIndex(h => h === 'last name');
  const nameIdx  = headers.findIndex(h => h === 'name');
  const emailIdx = headers.findIndex(h => h.includes('email'));
  const compIdx  = headers.findIndex(h => h === 'company' || h === 'organization');
  const titleIdx = headers.findIndex(h => h === 'position' || h === 'title' || h === 'job title');

  if (compIdx === -1) return [];

  const contacts: ImportedContact[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;
    const firstName = firstIdx >= 0 ? (cols[firstIdx] ?? '') : '';
    const lastName  = lastIdx  >= 0 ? (cols[lastIdx]  ?? '') : '';
    const name = nameIdx >= 0 ? (cols[nameIdx] ?? '') : `${firstName} ${lastName}`.trim();
    const email   = emailIdx >= 0 ? (cols[emailIdx] ?? '') : '';
    const company = compIdx  >= 0 ? (cols[compIdx]  ?? '') : '';
    const title   = titleIdx >= 0 ? (cols[titleIdx] ?? '') : '';
    if (!name || !company) continue;
    if (!SENIOR_TITLE_RE.test(title)) continue;
    contacts.push({ name, title, company, email });
  }
  return contacts;
}

function buildProspectSystemPrompt(category: string, companyPool: string[]): string {
  return `You are a BD researcher for Jo Mayer Jones at LIFE magazine — relaunching September 2026 as a quarterly large-format magazine with Karlie Kloss and Josh Kushner as Publishers. Founding partners contribute $500K for a year-long creative partnership.

Find 1 real senior marketing decision-maker (CMO, Chief Brand Officer, VP Marketing, SVP Partnerships, or equivalent) at a ${category} brand from this curated list:
${companyPool.join(', ')}

Pick the company you're most confident about — where you have accurate knowledge of the current marketing leadership from your training data (press releases, interviews, LinkedIn, news from 2023–2025).

CONTACT QUALITY:
- Use your knowledge of this brand's confirmed marketing leadership
- Common corporate email formats: firstname.lastname@company.com · firstname@company.com · f.lastname@company.com
- Set email_confidence "verified" only if you recall this email appearing in a press release, speaker bio, or news article
- Set "estimated" if you're inferring the format
- Provide the most senior person who would make a media partnership decision

WHY: Write one specific sentence about a real recent campaign, sponsorship, cultural commitment, or brand positioning that makes this company a natural LIFE founding partner. Be specific — name the actual campaign or initiative.

Draft the email:
Subject: LIFE — [Company]
Hi [First Name]
LIFE is relaunching this September as a quarterly large-format magazine with Karlie Kloss and Josh Kushner as Publishers. First issue: "Where Are We Now?" — America under construction.
[Company] has been on our list from the start. [One specific, researched reason this brand is a natural LIFE founding partner.]
We're speaking with a small number of founding partners — creative collaboration, not a media buy. Can we jump on a call?
Warm regards, Jo

Return ONLY this JSON (no other text):
{"name":"","title":"","company":"","email":"","email_confidence":"estimated","why":"","draft_subject":"","draft_body":""}`;
}

async function fetchOneProspect(apiKey: string, excludeCompanies: string[], category: string): Promise<DailyProspect> {
  const lowerExclusions = excludeCompanies.map(c => c.toLowerCase());
  const pool = (COMPANY_POOLS[category] ?? []).filter(c => !lowerExclusions.includes(c.toLowerCase()));
  const activePool = pool.length >= 5 ? pool : (COMPANY_POOLS[category] ?? []);

  const excludeNote = excludeCompanies.length > 0
    ? `\nDO NOT suggest any of these companies (already in pipeline or generated today): ${excludeCompanies.join(', ')}`
    : '';

  // 45s timeout — enough for Haiku, short enough to fail fast
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

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
        system: buildProspectSystemPrompt(category, activePool),
        messages: [{ role: 'user', content: `Find 1 real senior contact from the company pool for LIFE magazine's founding partner pipeline. Pick the company you're most confident about.${excludeNote}\nReturn the JSON object only — no other text.` }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as { name?: string })?.name === 'AbortError') throw new Error('Request timed out — try again.');
    throw err;
  }
  clearTimeout(timeoutId);

  if (response.status === 429) {
    await new Promise(r => setTimeout(r, 30_000));
    return fetchOneProspect(apiKey, excludeCompanies, category);
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `API error ${response.status}`);
  }

  const data = await response.json() as { content: { type: string; text?: string }[] };
  const text = data.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim();
  if (!text) throw new Error('Empty response from Claude — try again.');

  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const objMatch = text.match(/\{[\s\S]*?"name"[\s\S]*?\}/);
  const jsonStr = fenceMatch?.[1] ?? objMatch?.[0];
  if (!jsonStr) throw new Error(`Could not parse prospect data — model returned unexpected format.`);

  let p: { name: string; title: string; company: string; email: string; email_confidence: string; why: string; draft_subject: string; draft_body: string };
  try {
    p = JSON.parse(jsonStr.replace(/,\s*([}\]])/g, '$1'));
  } catch {
    throw new Error('Invalid JSON from Claude — try again.');
  }

  if (!p.name || !p.company) throw new Error('Incomplete prospect data — try again.');

  const today = new Date().toISOString().split('T')[0];
  const row: DailyProspect = {
    id: crypto.randomUUID(),
    date: today,
    name: p.name,
    title: p.title ?? '',
    company: p.company,
    email: p.email ?? '',
    email_confidence: p.email_confidence ?? 'estimated',
    why: p.why ?? '',
    draft_subject: p.draft_subject ?? `LIFE — ${p.company}`,
    draft_body: p.draft_body ?? '',
    status: 'pending',
  };

  const { error } = await supabase.from('daily_prospects').insert(row);
  if (error) console.warn('[Roadmap] Supabase save failed (showing anyway):', error.message);
  return row;
}

// ── Data ─────────────────────────────────────────────────────────
const WEEKS_INIT = [
  { id: 1, label: 'W/C 16 Mar', theme: 'Foundations', phase: 'now' as const, milestones: ['Materials locked and ready', 'Positioning defined', 'Packaging built', 'Pipeline seeded'] },
  { id: 2, label: 'W/C 23 Mar', theme: 'Market', phase: 'now' as const, milestones: ['Meetings underway', 'Feedback gathered', 'Pipeline developed further'] },
  { id: 3, label: 'W/C 30 Mar', theme: 'Proposals', phase: 'april' as const, milestones: ['Proposals generated', 'Opportunities in active discussion'] },
  { id: 4, label: 'W/C 6 Apr', theme: 'Proposals', phase: 'april' as const, milestones: ['Proposals refined and submitted', 'Follow-up conversations active'] },
  { id: 5, label: 'W/C 13 Apr', theme: 'Proposals', phase: 'april' as const, milestones: ['Pipeline pressure applied', 'Decisions being sought'] },
  { id: 6, label: 'W/C 20 Apr', theme: 'Deal Moment', phase: 'dinner' as const, milestones: ['Relationships deepened', 'Deals crystallising'] },
  { id: 7, label: 'W/C 28 Apr', theme: 'Close', phase: 'may' as const, milestones: ['Final negotiations', 'Agreements confirmed', 'Deals closed by 1 May'] },
  { id: 8, label: 'W/C 4 May', theme: 'Production Sprint', phase: 'may' as const, milestones: ['Production window opens — 6 weeks to 22 Jun', 'Large campaigns briefed and kicked off', 'Creative execution begins'] },
  { id: 9, label: 'W/C 11 May', theme: 'Production Sprint', phase: 'may' as const, milestones: ['Content and assets in progress', 'Client reviews scheduled', 'Campaign delivery tracked'] },
  { id: 10, label: 'W/C 18 May', theme: 'Production Sprint', phase: 'may' as const, milestones: ['Final approvals sought', 'Print-ready materials signed off', 'Campaigns can stretch into Issue 2 if needed'] },
  { id: 11, label: 'W/C 25 May', theme: 'Launch Prep', phase: 'june' as const, milestones: ['Press and distribution prep', 'Launch comms ready', 'Issue 1 clients: first-issue placement confirmed'] },
];

const PHASE_GROUPS: Partial<Record<Phase, string>> = {
  now: 'March — Foundations',
  april: 'April — Proposals & Pipeline',
  dinner: 'Dinner, 23 April',
  may: 'May — Deals Close · Production Sprint Begins',
  june: 'June — Launch Prep',
};

function parseWeekLabel(label: string): Date | null {
  const m = label.match(/W\/C\s+(\d+)\s+(\w+)/i);
  if (!m) return null;
  const d = new Date(`${m[2]} ${m[1]} 2026`);
  return isNaN(d.getTime()) ? null : d;
}

const CLOSERS_INIT = [
  { id: 1, category: 'PR & Marketing', items: ['PR and marketing plans confirmed for Issue 1', 'Partner visibility commitments defined', 'Editorial calendar shared with key partners'] },
  { id: 2, category: 'Launch Event & Q4 Activations', items: ['Launch event format confirmed', 'Q4 activation options presented to partners', 'Partner presence at launch event defined'] },
  { id: 3, category: 'Decision on Next Issues', items: ['Decision on next 2–3 issue themes', 'Forward-planning commitments offered to partners', 'Multi-issue packages available for discussion'] },
  { id: 4, category: 'Partner Activation Framework', items: ['Post-sale activation process agreed', 'Delivery ownership and contacts confirmed', 'Reporting and measurement approach aligned'] },
];

type Phase = 'now' | 'april' | 'dinner' | 'may' | 'june';

const PHASE_DOT: Record<Phase, string> = {
  now: 'bg-blue-500',
  april: 'bg-amber-500',
  dinner: 'bg-brand-gold',
  may: 'bg-emerald-500',
  june: 'bg-violet-500',
};

// ── Editable text ─────────────────────────────────────────────────
function Editable({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [on, setOn] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => { setOn(false); onChange(draft); };
  if (on) return (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setOn(false); } }}
      className={`border-b-2 border-brand-gold outline-none bg-transparent font-inherit w-full ${className}`}
    />
  );
  return (
    <span
      onClick={() => { setDraft(value); setOn(true); }}
      title="Click to edit"
      className={`cursor-text hover:opacity-70 transition-opacity ${className}`}
    >
      {value}
    </span>
  );
}

// ── Prospect card ────────────────────────────────────────────────
function ProspectCard({
  prospect,
  onAdd,
  onSkip,
}: {
  prospect: DailyProspect;
  onAdd: (p: DailyProspect) => void;
  onSkip: (p: DailyProspect) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDone = prospect.status === 'added';

  const copyEmail = () => {
    const text = `Subject: ${prospect.draft_subject}\n\n${prospect.draft_body}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isDone) {
    return (
      <div className="bg-white border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <span className="text-emerald-600 text-sm">✓</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-dark">{prospect.name}</p>
          <p className="text-xs text-gray-400">{prospect.company} · Added to Pipeline</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-sm font-bold text-brand-dark leading-tight">{prospect.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{prospect.title} · {prospect.company}</p>
          </div>
          {prospect.email_confidence === 'verified' ? (
            <span className="flex-shrink-0 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              verified
            </span>
          ) : (
            <span className="flex-shrink-0 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              estimated
            </span>
          )}
        </div>
        {/* WHY */}
        <p className="text-xs text-[#E8002D] leading-relaxed italic">{prospect.why}</p>
        {/* Email address */}
        <p className="text-[11px] text-gray-400 mt-1.5">{prospect.email}</p>
      </div>

      {/* Email preview toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-2 text-left text-[11px] font-medium text-gray-400 hover:text-gray-600 border-t border-gray-100 flex items-center justify-between transition-colors"
      >
        <span>Draft email</span>
        <span className="text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100 bg-gray-50">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-3 mb-1">
            Subject
          </p>
          <p className="text-xs text-brand-dark mb-2">{prospect.draft_subject}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Body
          </p>
          <pre className="text-xs text-brand-dark whitespace-pre-wrap leading-relaxed font-sans">
            {prospect.draft_body}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 pt-3 flex gap-2 border-t border-gray-100">
        <button
          onClick={() => onSkip(prospect)}
          className="py-1.5 px-3 text-xs font-medium border border-gray-200 rounded-lg text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-all"
          title="Skip this prospect"
        >
          ✕
        </button>
        <button
          onClick={copyEmail}
          className="flex-1 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:border-gray-400 hover:text-brand-dark transition-all"
        >
          {copied ? 'Copied ✓' : 'Copy Email'}
        </button>
        <button
          onClick={() => onAdd(prospect)}
          className="flex-1 py-1.5 text-xs font-semibold rounded-lg text-white transition-all"
          style={{ backgroundColor: '#E8002D' }}
        >
          Add to Pipeline
        </button>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
type RoadmapView = 'roadmap' | 'close';

export default function Roadmap({
  companyName: _companyName,
  onAddToEngaged,
}: {
  companyName: string;
  onAddToEngaged: (prospect: DailyProspect) => void;
}) {
  const [weeks, setWeeks] = useState(WEEKS_INIT);
  const [closers, setClosers] = useState(CLOSERS_INIT);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [subView, setSubView] = useState<RoadmapView>('roadmap');

  // ── Daily prospects ───────────────────────────────────────────
  const [prospects, setProspects] = useState<DailyProspect[]>([]);
  const [prospectsLoading, setProspectsLoading] = useState(true);
  const [prospectsError, setProspectsError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(0); // 0 = idle, 1/2/3 = which prospect

  // ── CSV import ────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importedContacts, setImportedContacts] = useState<ImportedContact[]>([]);
  const [importingContact, setImportingContact] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const loadProspects = () => {
    setProspectsLoading(true);
    setProspectsError(null);
    fetchTodayProspects()
      .then(data => setProspects(data.filter(p => p.status !== 'added' && p.status !== 'skipped')))
      .catch(err => setProspectsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setProspectsLoading(false));
  };

  useEffect(() => { loadProspects(); }, []);

  const handleAddToEngaged = (prospect: DailyProspect) => {
    onAddToEngaged(prospect);
    updateProspectStatus(prospect.id, 'added').catch(() => {});
    setProspects(prev => prev.map(p => p.id === prospect.id ? { ...p, status: 'added' } : p));
  };

  const handleSkip = (prospect: DailyProspect) => {
    updateProspectStatus(prospect.id, 'skipped').catch(() => {});
    setProspects(prev => prev.filter(p => p.id !== prospect.id));
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError(null);
    const text = await file.text();
    const parsed = parseContactsCSV(text);
    if (parsed.length === 0) {
      setImportError('No senior contacts found. Make sure the CSV has Company and Position columns with decision-maker titles (CMO, VP, Head of, etc.).');
      setShowImport(true);
      setImportedContacts([]);
      return;
    }
    const clients = await fetchAllClients().catch(() => []);
    const pipelineCompanies = new Set(clients.map(c => c.company.toLowerCase()));
    const filtered = parsed.filter(c => !pipelineCompanies.has(c.company.toLowerCase()));
    setImportedContacts(filtered);
    setShowImport(true);
  };

  const handleUseContact = async (contact: ImportedContact) => {
    const apiKey = localStorage.getItem(LIFE_API_KEY);
    if (!apiKey) { setImportError('No API key — enter it in the Proposal Generator tab first.'); return; }
    setImportingContact(contact.name);
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          system: `You are a BD researcher for Jo Mayer Jones at LIFE magazine — relaunching September 2026 as a quarterly large-format magazine with Karlie Kloss and Josh Kushner as Publishers. Founding partners contribute $500K for a year-long creative partnership.

Write personalized outreach for the given contact. Return ONLY valid JSON:
{"why":"one specific sentence about why this company is a natural LIFE founding partner (name a real campaign or brand initiative)","draft_subject":"LIFE — [Company]","draft_body":"Hi [First Name]\\nLIFE is relaunching this September as a quarterly large-format magazine with Karlie Kloss and Josh Kushner as Publishers. First issue: \\"Where Are We Now?\\" — America under construction.\\n[Company] has been on our list from the start. [specific reason].\\nWe're speaking with a small number of founding partners — creative collaboration, not a media buy. Can we jump on a call?\\nWarm regards, Jo"}`,
          messages: [{ role: 'user', content: `Contact: ${contact.name}, ${contact.title} at ${contact.company}${contact.email ? ` (${contact.email})` : ''}. Write the outreach JSON.` }],
        }),
      });
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json() as { content: { type: string; text?: string }[] };
      const raw = data.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim();
      const match = raw.match(/\{[\s\S]*?"why"[\s\S]*?\}/);
      const parsed = JSON.parse(match?.[0] ?? raw) as { why: string; draft_subject: string; draft_body: string };
      const prospect: DailyProspect = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        name: contact.name,
        title: contact.title,
        company: contact.company,
        email: contact.email,
        email_confidence: contact.email ? 'verified' : 'estimated',
        why: parsed.why,
        draft_subject: parsed.draft_subject,
        draft_body: parsed.draft_body,
        status: 'pending',
      };
      setProspects(prev => [...prev, prospect]);
      setImportedContacts(prev => prev.filter(c => c.name !== contact.name || c.company !== contact.company));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to generate prospect — try again.');
    } finally {
      setImportingContact(null);
    }
  };

  const handleGenerateNew = async () => {
    const apiKey = localStorage.getItem(LIFE_API_KEY);
    if (!apiKey) {
      setGenerateError('No API key found — enter your Anthropic API key in the Proposal Generator tab first.');
      return;
    }
    setGenerateError(null);
    const pipelineClients = await fetchAllClients().catch(() => []);
    const excluded = [
      ...prospects.map(p => p.company),
      ...pipelineClients.map(c => c.company).filter(Boolean),
    ];
    let anySucceeded = false;
    for (let i = 1; i <= 3; i++) {
      if (i > 1) await new Promise(r => setTimeout(r, 2000));
      setGenerating(i);
      try {
        const category = PROSPECT_CATEGORIES[i - 1];
        const prospect = await fetchOneProspect(apiKey, excluded, category);
        excluded.push(prospect.company);
        setProspects(prev => [...prev, prospect]);
        anySucceeded = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Roadmap] Generate failed for slot', i, ':', msg);
        // Show error but keep trying remaining slots
        setGenerateError(`Slot ${i} failed: ${msg}${i < 3 ? ' — continuing…' : ''}`);
      }
    }
    setGenerating(0);
    if (anySucceeded) setGenerateError(null);
  };

  // week mutations
  const setWLabel = (id: number, v: string) => setWeeks(ws => ws.map(w => w.id === id ? { ...w, label: v } : w));
  const setWTheme = (id: number, v: string) => setWeeks(ws => ws.map(w => w.id === id ? { ...w, theme: v } : w));
  const setWMs = (id: number, mi: number, v: string) => setWeeks(ws => ws.map(w => w.id === id ? { ...w, milestones: w.milestones.map((m, i) => i === mi ? v : m) } : w));
  const addWM = (id: number) => setWeeks(ws => ws.map(w => w.id === id ? { ...w, milestones: [...w.milestones, 'New milestone'] } : w));
  const delWM = (id: number, mi: number) => setWeeks(ws => ws.map(w => w.id === id ? { ...w, milestones: w.milestones.filter((_, i) => i !== mi) } : w));

  // closer mutations
  const setCat = (cid: number, v: string) => setClosers(cs => cs.map(c => c.id === cid ? { ...c, category: v } : c));
  const setCItem = (cid: number, ii: number, v: string) => setClosers(cs => cs.map(c => c.id === cid ? { ...c, items: c.items.map((it, i) => i === ii ? v : it) } : c));
  const addCI = (cid: number) => setClosers(cs => cs.map(c => c.id === cid ? { ...c, items: [...c.items, 'New item'] } : c));
  const delCI = (cid: number, ii: number) => setClosers(cs => cs.map(c => c.id === cid ? { ...c, items: c.items.filter((_, i) => i !== ii) } : c));
  const toggle = (k: string) => setChecked(p => ({ ...p, [k]: !p[k] }));

  const total = closers.reduce((a, c) => a + c.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { background: white !important; font-size: 10pt; }
          .no-print { display: none !important; }
          .print-only { display: flex !important; }
          print-color-adjust: exact; -webkit-print-color-adjust: exact;
        }
      `}</style>

      {/* Print-only LIFE header */}
      <div className="print-only hidden items-center justify-between mb-6 pb-4 border-b-2 border-gray-200">
        <div style={{ backgroundColor: '#E8002D', padding: '5px 12px', display: 'inline-block' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: 'white', fontSize: '22px', letterSpacing: '-1px', lineHeight: 1 }}>LIFE</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9pt', color: '#888' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Strategic Roadmap · March – June 2026</p>
          <p style={{ margin: 0 }}>{subView === 'roadmap' ? 'Week by Week' : 'Close by 1 May'}</p>
        </div>
      </div>

      {/* ══ TO DO TODAY ══ */}
      <div className="no-print mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase text-white" style={{ backgroundColor: '#E8002D' }}>
              To Do Today
            </div>
            <p className="text-xs text-gray-400">Reach out to 3 new prospects · move them to Engaged</p>
          </div>
          <div className="flex items-center gap-2">
            {generating > 0 && (
              <span className="text-xs text-gray-400 animate-pulse">Finding {generating}/3… (may take up to 90s)</span>
            )}
            <button
              onClick={() => csvInputRef.current?.click()}
              className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:border-gray-400 hover:text-brand-dark transition-all"
              title="Import from LinkedIn CSV or any contacts export"
            >
              Import CSV
            </button>
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{ position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden' }} onChange={handleCSVUpload} />
            <button
              onClick={handleGenerateNew}
              disabled={generating > 0 || prospectsLoading}
              className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:border-gray-400 hover:text-brand-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Get New
            </button>
            {!prospectsLoading && generating === 0 && (
              <button onClick={loadProspects} className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-1">
                ↻
              </button>
            )}
          </div>
        </div>

        {generateError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 flex items-start justify-between gap-3">
            <p className="text-xs text-red-700 font-mono leading-relaxed">{generateError}</p>
            <button onClick={() => setGenerateError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0 text-sm">✕</button>
          </div>
        )}

        {prospectsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-2.5 bg-gray-100 rounded w-1/2 mb-3" />
                <div className="h-2.5 bg-gray-100 rounded w-full mb-1.5" />
                <div className="h-2.5 bg-gray-100 rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : prospectsError && prospects.length === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-700 mb-1">Failed to load prospects</p>
              <p className="text-xs text-red-500 font-mono">{prospectsError}</p>
            </div>
            <button onClick={loadProspects} className="text-xs text-red-600 underline flex-shrink-0">Retry</button>
          </div>
        ) : prospects.length === 0 && generating === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-400">
              No prospects yet — click <strong>Get New</strong> to generate 3 now, or trigger the Daily Prospect Briefing workflow in GitHub Actions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {prospects.map(p => (
              <ProspectCard key={p.id} prospect={p} onAdd={handleAddToEngaged} onSkip={handleSkip} />
            ))}
            {generating > 0 && Array.from({ length: 4 - generating }).map((_, i) => (
              <div key={`gen-${i}`} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-2.5 bg-gray-100 rounded w-1/2 mb-3" />
                <div className="h-2.5 bg-gray-100 rounded w-full mb-1.5" />
                <div className="h-2.5 bg-gray-100 rounded w-4/5" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CSV Import Modal ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16 px-4" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-brand-dark">Import Contacts</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {importedContacts.length > 0
                    ? `${importedContacts.length} senior contact${importedContacts.length !== 1 ? 's' : ''} found — pick who to reach out to`
                    : 'LinkedIn: Settings → Data privacy → Get a copy of your data → Connections'}
                </p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            {importError && (
              <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs text-red-700">{importError}</p>
              </div>
            )}

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {importedContacts.length === 0 && !importError && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">No contacts to show.</p>
                  <button onClick={() => csvInputRef.current?.click()} className="mt-3 text-xs text-brand-red underline">Upload a different file</button>
                </div>
              )}
              {importedContacts.map((c, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-dark truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.title} · {c.company}</p>
                    {c.email && <p className="text-[11px] text-gray-400 truncate mt-0.5">{c.email}</p>}
                  </div>
                  <button
                    onClick={() => handleUseContact(c)}
                    disabled={importingContact !== null}
                    className="flex-shrink-0 text-xs font-medium bg-brand-dark text-white rounded-lg px-3 py-1.5 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {importingContact === c.name ? 'Writing…' : 'Use'}
                  </button>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-gray-100">
              <button onClick={() => csvInputRef.current?.click()} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Upload a different file
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-navigation tabs */}
      <div className="no-print flex items-center justify-between border-b border-gray-200 mb-8">
        <div className="flex gap-0">
          {([['roadmap', 'Week by Week'], ['close', 'Close by 1 May']] as [RoadmapView, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSubView(id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                subView === id
                  ? 'border-[#E8002D] text-brand-dark'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          className="btn-primary flex items-center gap-2 text-sm mb-0.5"
        >
          <span>⎙</span> Download PDF
        </button>
      </div>

      {/* Page title */}
      <div className="mb-7">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
          Strategic Roadmap · March – June 2026
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-dark">
          {subView === 'roadmap' ? 'The Road to Launch' : 'What We Must Finalise to Close Deals'}
        </h1>
        {subView === 'roadmap' && (
          <p className="mt-1.5 text-sm text-gray-500">
            Deals closed by 1 May · Magazine launch June 2026
          </p>
        )}
        {subView === 'close' && (
          <p className="mt-1.5 text-sm text-gray-500">
            Gate: <strong className="text-brand-gold">1 May 2026</strong> · All of the below must be resolved before contracts are signed.
          </p>
        )}
      </div>

      {/* ══ ROADMAP VIEW ══ */}
      {subView === 'roadmap' && (
        <>
          <div className="flex flex-col gap-0.5">
            {(() => {
              const weekCutoff = new Date();
              weekCutoff.setHours(0, 0, 0, 0);
              const day = weekCutoff.getDay();
              weekCutoff.setDate(weekCutoff.getDate() - (day === 0 ? 6 : day - 1));
              return weeks.filter(w => { const d = parseWeekLabel(w.label); return !d || d >= weekCutoff; });
            })().map((week, i, visible) => {
              const prevPhase = i > 0 ? visible[i - 1].phase : null;
              const isDinner = week.phase === 'dinner';
              const dotClass = PHASE_DOT[week.phase];
              return (
                <div key={week.id}>
                  {week.phase !== prevPhase && PHASE_GROUPS[week.phase] && (
                    <div className={`text-[10px] font-bold tracking-[0.15em] uppercase ${isDinner ? 'text-brand-gold' : 'text-gray-400'} ${i === 0 ? '' : 'mt-6'} mb-2`}>
                      {PHASE_GROUPS[week.phase]}
                    </div>
                  )}
                  <div className="flex items-stretch bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {/* Left: week label */}
                    <div className="w-[148px] flex-shrink-0 px-4 py-3.5 border-r border-gray-200 flex flex-col justify-center gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${dotClass} flex-shrink-0`} />
                        <Editable value={week.label} onChange={v => setWLabel(week.id, v)} className="text-xs font-bold text-brand-dark" />
                      </div>
                      <Editable value={week.theme} onChange={v => setWTheme(week.id, v)} className="text-[10px] text-gray-400 tracking-wide pl-4" />
                    </div>
                    {/* Right: milestones */}
                    <div className="flex-1 px-4 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                      {week.milestones.map((m, mi) => (
                        <div key={mi} className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                          <Editable value={m} onChange={v => setWMs(week.id, mi, v)} className="text-sm text-brand-dark" />
                          <span
                            onClick={() => delWM(week.id, mi)}
                            className="no-print text-gray-200 hover:text-brand-gold cursor-pointer text-[10px] select-none transition-colors"
                          >
                            ✕
                          </span>
                        </div>
                      ))}
                      <span
                        onClick={() => addWM(week.id)}
                        className="no-print text-[11px] text-gray-300 hover:text-brand-gold cursor-pointer select-none transition-colors"
                      >
                        + add
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Launch bar */}
          <div className="mt-7 bg-brand-gold rounded-lg px-6 py-5 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-white/60 tracking-widest uppercase mb-1">North Star</div>
              <div className="text-xl font-bold text-white tracking-tight">June 2026 — Magazine goes to print, Issue 1</div>
            </div>
            <span className="text-2xl text-white/30">✦</span>
          </div>

          <div className="mt-2.5 px-3.5 py-2.5 bg-white border border-gray-200 rounded-md text-xs text-gray-400">
            Custom programmes require 6 weeks production. Deals closed by 1 May enables delivery for Issue 1. Larger campaigns can stretch across Issues 1 & 2.
          </div>
        </>
      )}

      {/* ══ CLOSE BY MAY 1 VIEW ══ */}
      {subView === 'close' && (
        <>
          {/* Progress bar */}
          <div className="bg-white border border-gray-200 rounded-lg px-5 py-4 mb-6 flex items-center gap-5">
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-gray-400">Overall progress</span>
                <span className={`text-xs font-bold ${done === total ? 'text-emerald-500' : 'text-brand-gold'}`}>
                  {done} / {total} resolved
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${done === total ? 'bg-emerald-500' : 'bg-brand-gold'}`}
                  style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {closers.map(c => {
              const catDone = c.items.filter((_, ii) => checked[`${c.id}-${ii}`]).length;
              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <Editable value={c.category} onChange={v => setCat(c.id, v)} className="text-xs font-bold text-brand-dark" />
                    <span className={`text-[11px] font-semibold ${catDone === c.items.length ? 'text-emerald-500' : 'text-gray-400'}`}>
                      {catDone}/{c.items.length}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-2.5">
                    {c.items.map((item, ii) => {
                      const key = `${c.id}-${ii}`;
                      const isOn = !!checked[key];
                      return (
                        <div key={ii} className="flex items-start gap-2.5">
                          <div
                            onClick={() => toggle(key)}
                            className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 cursor-pointer flex items-center justify-center transition-all ${
                              isOn ? 'bg-brand-gold' : 'border-2 border-gray-300'
                            }`}
                          >
                            {isOn && <span className="text-white text-[9px] font-bold">✓</span>}
                          </div>
                          <Editable
                            value={item}
                            onChange={v => setCItem(c.id, ii, v)}
                            className={`text-sm flex-1 leading-relaxed ${isOn ? 'text-gray-300 line-through' : 'text-brand-dark'}`}
                          />
                          <span
                            onClick={() => delCI(c.id, ii)}
                            className="no-print text-gray-200 hover:text-brand-gold cursor-pointer text-[10px] select-none flex-shrink-0 transition-colors"
                          >
                            ✕
                          </span>
                        </div>
                      );
                    })}
                    <span
                      onClick={() => addCI(c.id)}
                      className="no-print text-[11px] text-gray-300 hover:text-brand-gold cursor-pointer select-none transition-colors"
                    >
                      + add
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
