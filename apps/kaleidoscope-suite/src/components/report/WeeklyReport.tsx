import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Client,
  PIPELINE_STAGES,
  PipelineStage,
  STAGE_CONFIG,
  formatCurrency,
  daysSince,
  isStale,
  generateId,
} from '../../types';

interface WeeklyReportProps {
  clients: Client[];
  companyName: string;
}

const STORAGE_KEY_REPORT = 'kaleidoscope_suite_weekly_report';
const STORAGE_KEY_ARCHIVES = 'kaleidoscope_suite_report_archives';
const INTEL_API_KEY = 'kaleidoscope_suite_intel_api_key';

interface ReportNotes {
  pipelineUpdates: string;
  meetings: string;
  actions: string;
  nextFocus: string;
}

const EMPTY_NOTES: ReportNotes = {
  pipelineUpdates: '',
  meetings: '',
  actions: '',
  nextFocus: '',
};

interface ArchivedStats {
  totalValue: number;
  activeValue: number;
  closedValue: number;
  avgDeal: number;
  clientCount: number;
  newThisWeek: number;
  contactedThisWeek: number;
  staleCount: number;
  byStage: Record<PipelineStage, { count: number; value: number }>;
  topClients: Array<{ name: string; company: string; stage: PipelineStage; value: number; stale: boolean }>;
  staleClients: Array<{ name: string; company: string; stage: PipelineStage; value: number; days: number; lastContact: string }>;
  newClients: Array<{ name: string; company: string; stage: PipelineStage; value: number }>;
}

interface ArchivedReport {
  id: string;
  weekLabel: string;
  savedAt: string;
  companyName: string;
  notes: ReportNotes;
  stats: ArchivedStats;
}

const PRINT_STYLE = `
@media print {
  @page { margin: 0.8cm; size: A4; }
  body { background: white !important; font-size: 8.5pt; line-height: 1.3; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #111 !important; }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .card { box-shadow: none !important; border: 1px solid #d1d5db !important; break-inside: avoid; padding: 8px 12px !important; margin-bottom: 3px !important; }
  .metric-card { box-shadow: none !important; border: 1px solid #d1d5db !important; padding: 6px 10px !important; }
  .print-compact > * + * { margin-top: 4px !important; }
  h1 { font-size: 14pt !important; }
  h2 { font-size: 9.5pt !important; font-weight: 700 !important; }
  h3 { font-size: 8.5pt !important; }
  h1, h2, h3 { page-break-after: avoid; }
  .print-header { padding: 10px 14px !important; background-color: #1a1a1a !important; }
  .print-accent { background: #7C3AED !important; }
  .print-metrics { gap: 6px !important; margin-bottom: 6px !important; }
  .print-stage-bar { height: 14px !important; }
  .print-stage-row { gap: 6px !important; }
  .print-stage-row + .print-stage-row { margin-top: 2px !important; }
}
`;

function EditableSection({
  title,
  placeholder,
  value,
  onChange,
  printLabel,
}: {
  title: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  printLabel?: string;
}) {
  const lines = value.split('\n').filter(l => l.trim());

  return (
    <div className="card p-4">
      <div className="no-print">
        <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-2">{title}</h2>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 bg-brand-light border border-brand-cream-dark rounded-lg text-sm text-brand-dark placeholder-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] resize-y transition-all duration-150 font-sans leading-relaxed"
        />
        <p className="text-xs text-brand-dark/30 mt-1">One item per line</p>
      </div>
      {lines.length > 0 && (
        <div className="print-only hidden">
          <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 pb-0.5 border-b border-gray-200">{printLabel ?? title}</h2>
          <ul className="space-y-0.5">
            {lines.map((line, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-800 leading-snug">
                <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NotesReadOnly({ title, value }: { title: string; value: string }) {
  const lines = value.split('\n').filter(l => l.trim());
  if (lines.length === 0) return null;
  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-2 pb-1.5 border-b border-brand-cream">{title}</h2>
      <ul className="space-y-1">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-1.5 text-sm text-brand-dark/80">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-[#7C3AED] flex-shrink-0" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionWrapper({
  title,
  hidden,
  onToggle,
  children,
}: {
  title: string;
  hidden: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (hidden) {
    return (
      <div className="no-print flex items-center gap-2 px-4 py-2 bg-brand-light/50 border border-dashed border-brand-cream rounded-lg cursor-pointer hover:border-brand-cream-dark transition-colors" onClick={onToggle}>
        <span className="text-xs text-brand-dark/30 flex-1">{title}</span>
        <span className="text-xs text-brand-dark/40">Show</span>
      </div>
    );
  }
  return (
    <div className="relative group">
      <button
        onClick={onToggle}
        className="no-print absolute top-2.5 right-2.5 z-10 text-xs text-brand-dark/20 group-hover:text-brand-dark/50 hover:!text-brand-dark transition-colors px-1.5 py-0.5 rounded"
        title="Hide section from PDF"
      >
        Hide
      </button>
      {children}
    </div>
  );
}

function ArchivedReportView({
  archive,
  onClose,
}: {
  archive: ArchivedReport;
  onClose: () => void;
}) {
  const maxCount = Math.max(...PIPELINE_STAGES.map(s => archive.stats.byStage[s]?.count ?? 0), 1);
  const savedDate = new Date(archive.savedAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 bg-brand-light overflow-auto">
      <style>{PRINT_STYLE}</style>
      <div className="no-print bg-white border-b border-brand-cream px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="btn-secondary flex items-center gap-1.5 text-sm">
            ← Back to Reports
          </button>
          <div className="w-px h-5 bg-brand-cream" />
          <div>
            <p className="text-sm font-semibold text-brand-dark">Week of {archive.weekLabel}</p>
            <p className="text-xs text-brand-dark/40">Saved {savedDate}</p>
          </div>
        </div>
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
          Download PDF
        </button>
      </div>
      <div className="p-5">
        <div className="max-w-4xl mx-auto space-y-4 print-compact">
          <div className="card overflow-hidden">
            <div className="bg-brand-dark px-6 py-4 print-header">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="bg-[#7C3AED] px-2 py-0.5"><span className="font-mono font-bold text-white text-xs tracking-tight leading-none">K⟡</span></div>
                    <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Weekly Business Report</p>
                  </div>
                  <h1 className="font-display text-2xl font-bold text-white">{archive.companyName}</h1>
                  <p className="text-white/50 text-xs mt-0.5">Saved {savedDate}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-[#7C3AED]/70 text-xs font-medium uppercase tracking-widest mb-0.5">Week of</p>
                  <p className="text-white font-medium text-sm">{archive.weekLabel}</p>
                  <p className="text-white/50 text-xs mt-0.5">{archive.stats.clientCount} clients</p>
                </div>
              </div>
            </div>
            <div className="h-0.5 bg-[#7C3AED] print-accent" />
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Pipeline Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print-metrics mb-4">
              {[
                { label: 'Total Pipeline', value: formatCurrency(archive.stats.totalValue), color: 'text-brand-dark' },
                { label: 'Active Value', value: formatCurrency(archive.stats.activeValue), color: 'text-[#7C3AED]' },
                { label: 'Closed Value', value: formatCurrency(archive.stats.closedValue), color: 'text-emerald-600' },
                { label: 'Avg. Deal Size', value: formatCurrency(archive.stats.avgDeal), color: 'text-brand-dark' },
              ].map(m => (
                <div key={m.label} className="metric-card">
                  <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">{m.label}</p>
                  <p className={`font-display text-xl font-bold ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 print-metrics mb-4">
              {[
                { label: 'New', value: archive.stats.newThisWeek, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                { label: 'Contacted', value: archive.stats.contactedThisWeek, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                { label: 'Stale (7d+)', value: archive.stats.staleCount, color: archive.stats.staleCount > 0 ? 'text-amber-700' : 'text-emerald-600', bg: archive.stats.staleCount > 0 ? 'bg-amber-50' : 'bg-emerald-50', border: archive.stats.staleCount > 0 ? 'border-amber-100' : 'border-emerald-100' },
              ].map(item => (
                <div key={item.label} className={`rounded-lg px-3 py-2 text-center ${item.bg} border ${item.border}`}>
                  <p className={`font-display text-xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-brand-dark/60 font-medium">{item.label}</p>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-brand-dark/60 uppercase tracking-wider mb-2">Stage Breakdown</h3>
              <div className="space-y-1.5">
                {PIPELINE_STAGES.map(stage => {
                  const s = archive.stats.byStage[stage] ?? { count: 0, value: 0 };
                  const cfg = STAGE_CONFIG[stage];
                  return (
                    <div key={stage} className="flex items-center gap-3 print-stage-row">
                      <div className="w-28 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          <span className="text-xs font-medium text-brand-dark">{stage}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="h-4 print-stage-bar bg-brand-light rounded-full overflow-hidden">
                          <div
                            className={`h-full ${cfg.dot} rounded-full transition-all duration-500 flex items-center justify-end pr-1.5`}
                            style={{ width: `${Math.max((s.count / maxCount) * 100, 4)}%` }}
                          >
                            {s.count > 0 && <span className="text-white text-xs font-bold leading-none">{s.count}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="w-20 text-right flex-shrink-0">
                        <span className="text-xs font-semibold text-[#7C3AED]">{formatCurrency(s.value)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {archive.notes.pipelineUpdates && <NotesReadOnly title="Pipeline Updates" value={archive.notes.pipelineUpdates} />}
          {archive.stats.topClients.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Top Opportunities</h2>
              <div className="space-y-1.5">
                {archive.stats.topClients.map((client, i) => {
                  const cfg = STAGE_CONFIG[client.stage];
                  return (
                    <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${client.stale ? 'bg-amber-50 border border-amber-100' : 'bg-brand-light'}`}>
                      <span className="w-5 h-5 rounded-full bg-[#7C3AED]/20 text-[#7C3AED] font-bold text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs text-brand-dark truncate">{client.name} <span className="font-normal text-brand-dark/50">— {client.company}</span></p>
                      </div>
                      <span className={`stage-badge text-xs ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{client.stage}</span>
                      <span className="font-bold text-[#7C3AED] text-xs flex-shrink-0">{formatCurrency(client.value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {archive.notes.meetings && <NotesReadOnly title="Meetings & Calls" value={archive.notes.meetings} />}
          {archive.notes.actions && <NotesReadOnly title="Actions Completed" value={archive.notes.actions} />}
          {archive.notes.nextFocus && <NotesReadOnly title="Next Week's Focus" value={archive.notes.nextFocus} />}
          <div className="text-center py-2 border-t border-brand-cream">
            <p className="text-xs text-brand-dark/30">{archive.companyName} · Week of {archive.weekLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WeeklyReport({ clients, companyName }: WeeklyReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const [notes, setNotes] = useState<ReportNotes>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REPORT);
      if (stored) return { ...EMPTY_NOTES, ...JSON.parse(stored) };
    } catch { /* fall through */ }
    return EMPTY_NOTES;
  });

  const [archives, setArchives] = useState<ArchivedReport[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ARCHIVES);
      if (stored) return JSON.parse(stored) as ArchivedReport[];
    } catch { /* fall through */ }
    return [];
  });

  const [showArchives, setShowArchives] = useState(false);
  const [viewingArchive, setViewingArchive] = useState<ArchivedReport | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy Text');
  const [saveLabel, setSaveLabel] = useState('Save Report');
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setHiddenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const [apiKey, setApiKey] = useState(() => localStorage.getItem(INTEL_API_KEY) ?? '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REPORT, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ARCHIVES, JSON.stringify(archives));
  }, [archives]);

  useEffect(() => {
    if (apiKey) localStorage.setItem(INTEL_API_KEY, apiKey);
  }, [apiKey]);

  const setNote = (key: keyof ReportNotes) => (value: string) =>
    setNotes(prev => ({ ...prev, [key]: value }));

  const weekStartStr = useMemo(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const staleClients = clients.filter(c => isStale(c.lastContact));
    const newThisWeek = clients.filter(c => new Date(c.createdAt).getTime() >= oneWeekAgo);
    const contactedThisWeek = clients.filter(c => new Date(c.lastContact).getTime() >= oneWeekAgo);
    const byStage: Record<PipelineStage, Client[]> = {
      Prospect: [], Engaged: [], 'Meeting Set': [], 'Proposal Sent': [], Feedback: [], Close: [],
    };
    clients.forEach(c => byStage[c.stage].push(c));
    const totalValue = clients.reduce((s, c) => s + c.value, 0);
    const closedValue = byStage.Close.reduce((s, c) => s + c.value, 0);
    const activeValue = clients.filter(c => c.stage !== 'Close').reduce((s, c) => s + c.value, 0);
    const avgDeal = clients.length > 0 ? totalValue / clients.length : 0;
    const topClients = [...clients].sort((a, b) => b.value - a.value).slice(0, 5);
    return {
      staleClients, newThisWeek, contactedThisWeek, byStage,
      totalValue, closedValue, activeValue, avgDeal, topClients,
    };
  }, [clients]);

  // WoW: compare to most recently saved archive
  const prevStats = archives.length > 0 ? archives[0].stats : null;

  function fmtDelta(curr: number, prev: number | undefined): { text: string; positive: boolean } | null {
    if (prev === undefined || prev === null) return null;
    const diff = curr - prev;
    if (Math.abs(diff) < 1) return null;
    const sign = diff > 0 ? '+' : '';
    return { text: `${sign}${formatCurrency(diff)}`, positive: diff > 0 };
  }

  function fmtCountDelta(curr: number, prev: number | undefined): { text: string; positive: boolean } | null {
    if (prev === undefined || prev === null) return null;
    const diff = curr - prev;
    if (diff === 0) return null;
    return { text: diff > 0 ? `+${diff}` : `${diff}`, positive: diff > 0 };
  }

  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const weekEnd = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const saveToArchive = () => {
    const byStageSnapshot: Record<PipelineStage, { count: number; value: number }> = {
      Prospect: { count: 0, value: 0 }, Engaged: { count: 0, value: 0 }, 'Meeting Set': { count: 0, value: 0 },
      'Proposal Sent': { count: 0, value: 0 }, Feedback: { count: 0, value: 0 }, Close: { count: 0, value: 0 },
    };
    PIPELINE_STAGES.forEach(s => {
      byStageSnapshot[s] = {
        count: stats.byStage[s].length,
        value: stats.byStage[s].reduce((sum, c) => sum + c.value, 0),
      };
    });
    const archive: ArchivedReport = {
      id: generateId(),
      weekLabel,
      savedAt: new Date().toISOString(),
      companyName,
      notes: { ...notes },
      stats: {
        totalValue: stats.totalValue,
        activeValue: stats.activeValue,
        closedValue: stats.closedValue,
        avgDeal: stats.avgDeal,
        clientCount: clients.length,
        newThisWeek: stats.newThisWeek.length,
        contactedThisWeek: stats.contactedThisWeek.length,
        staleCount: stats.staleClients.length,
        byStage: byStageSnapshot,
        topClients: stats.topClients.map(c => ({
          name: c.name, company: c.company, stage: c.stage, value: c.value,
          stale: isStale(c.lastContact),
        })),
        staleClients: stats.staleClients.map(c => ({
          name: c.name, company: c.company, stage: c.stage, value: c.value,
          days: daysSince(c.lastContact), lastContact: c.lastContact,
        })),
        newClients: stats.newThisWeek.map(c => ({
          name: c.name, company: c.company, stage: c.stage, value: c.value,
        })),
      },
    };
    setArchives(prev => [archive, ...prev]);
    setSaveLabel('✓ Saved!');
    setTimeout(() => setSaveLabel('Save Report'), 2500);
  };

  const deleteArchive = (id: string) => {
    setArchives(prev => prev.filter(a => a.id !== id));
  };

  const generateDraft = async () => {
    const key = apiKey.trim();
    if (!key) { setShowApiKeyInput(true); return; }
    setGenerating(true);
    setGenerateError('');

    const stageMovements = clients.flatMap(c =>
      (c.stageHistory ?? [])
        .filter(e => e.date >= weekStartStr)
        .map(e => `${c.name} @ ${c.company} → ${e.stage}`)
    );

    const newClientsList = stats.newThisWeek.map(c =>
      `${c.name} @ ${c.company} (${c.stage}, ${formatCurrency(c.value)})`
    );

    const topList = stats.topClients.map((c, i) =>
      `${i + 1}. ${c.name} @ ${c.company} — ${c.stage} — ${formatCurrency(c.value)}`
    );

    const prevS = prevStats;
    const deltaTotal = prevS ? stats.totalValue - prevS.totalValue : null;
    const deltaActive = prevS ? stats.activeValue - prevS.activeValue : null;
    const deltaCount = prevS ? clients.length - prevS.clientCount : null;

    const prompt = `Write a weekly commercial update FROM Johanna Mayer-Jones (fractional CRO at Jonesy & Co, building the Kaleidoscope sponsorship pipeline) TO Oz Woloshyn and Mangesh Hattikudur (co-founders of Kaleidoscope).

This is a founder update — direct, confident, no fluff. Write like a sharp operator giving the founders exactly what they need to know. First-person ("I"), addressed to Oz and Mangesh implicitly. Short punchy bullets, specific names and companies, honest about what's moving and what's stuck.

Kaleidoscope context: premium podcast studio, "the National Geographic of podcasting." iHeart's flagship science and technology network. 1M monthly listeners. Shows include The Builders with Walter Isaacson, Two Percent with Michael Easter, TechStuff with Oz Woloshyn, No Such Thing (Apple's Best Podcast 2025), Shell Game with Evan Ratliff, Superhuman, Inventors with Simone Giertz. Three sponsorship products: Custom Partnerships (co-produced original shows), Creative Sponsorship (host-read show integration), Events + Live Activation. Target sponsors: tech, pharma/biotech, financial services, consumer brands. $12M pipeline target.

WEEK: ${weekLabel}

PIPELINE NUMBERS:
- Total pipeline: ${formatCurrency(stats.totalValue)}${deltaTotal !== null ? ` (${deltaTotal >= 0 ? '+' : ''}${formatCurrency(deltaTotal)} vs last week)` : ''}
- Active value: ${formatCurrency(stats.activeValue)}${deltaActive !== null ? ` (${deltaActive >= 0 ? '+' : ''}${formatCurrency(deltaActive)} vs last week)` : ''}
- Closed: ${formatCurrency(stats.closedValue)} across ${stats.byStage.Close.length} deals
- Total sponsors in pipeline: ${clients.length}${deltaCount !== null ? ` (${deltaCount >= 0 ? '+' : ''}${deltaCount} vs last week)` : ''}
- Contacted this week: ${stats.contactedThisWeek.length}

TOP OPPORTUNITIES:
${topList.length > 0 ? topList.join('\n') : 'None yet'}

STAGE MOVEMENTS THIS WEEK:
${stageMovements.length > 0 ? stageMovements.join('\n') : 'No stage changes recorded'}

NEW SPONSORS ADDED:
${newClientsList.length > 0 ? newClientsList.join('\n') : 'None this week'}

---
Return a JSON object with exactly these four fields. Each value is a string with bullet points separated by newlines — write the text directly, no dash/bullet prefix. First-person voice throughout.

"pipelineUpdates" — 3–5 bullets: what moved, numbers vs last week, what's stuck. Name specific sponsors and which show/product they're tied to.

"meetings" — 3–5 bullets on calls and meetings this week, what came out of each. If no data: "No meetings logged this week — I'll add notes to pipeline cards going forward."

"actions" — 3–5 bullets: outreach sent, proposals delivered, follow-ups made, intros activated (Freston, Coles, Wong advisory network where relevant).

"nextFocus" — 3–5 bullets: priorities next week. Which deal to close, who to chase, what The Builders with Walter Isaacson or other upcoming launches create urgency for. Sharp and specific.

Return only the JSON. No prose, no markdown fences.`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `API error ${resp.status}`);
      }

      const data = await resp.json() as { content: { type: string; text?: string }[] };
      const text = data.content.find(b => b.type === 'text')?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON returned from Claude');
      const draft = JSON.parse(jsonMatch[0]) as Partial<ReportNotes>;

      setNotes(prev => ({
        pipelineUpdates: draft.pipelineUpdates || prev.pipelineUpdates,
        meetings: draft.meetings || prev.meetings,
        actions: draft.actions || prev.actions,
        nextFocus: draft.nextFocus || prev.nextFocus,
      }));
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!reportRef.current) return;
    await navigator.clipboard.writeText(reportRef.current.innerText);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy Text'), 2000);
  };

  const maxCount = Math.max(...PIPELINE_STAGES.map(s => stats.byStage[s].length), 1);

  if (viewingArchive) {
    return (
      <ArchivedReportView
        archive={viewingArchive}
        onClose={() => setViewingArchive(null)}
      />
    );
  }

  return (
    <>
      <style>{PRINT_STYLE}</style>

      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="bg-white border-b border-brand-cream px-6 py-3 flex items-center justify-between no-print">
          <div>
            <h1 className="font-display text-lg font-semibold text-brand-dark">Weekly Report</h1>
            <p className="text-xs text-brand-dark/50 mt-0.5">
              {showArchives ? `${archives.length} saved report${archives.length !== 1 ? 's' : ''}` : `Week of ${weekLabel}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!showArchives && (
              <>
                {/* AI Generate Draft */}
                <button
                  onClick={generateDraft}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-brand-dark text-white hover:bg-brand-dark/90 disabled:opacity-50 transition-all border border-brand-dark"
                >
                  {generating ? (
                    <><span className="animate-spin text-xs">⟳</span> Generating…</>
                  ) : (
                    <>✦ Generate Draft</>
                  )}
                </button>
                <button onClick={handleCopy} className="btn-secondary text-sm">
                  {copyLabel}
                </button>
                <button
                  onClick={saveToArchive}
                  className={`btn-secondary text-sm flex items-center gap-1.5 ${saveLabel.startsWith('✓') ? 'text-emerald-600 border-emerald-300 bg-emerald-50' : ''}`}
                >
                  {saveLabel}
                </button>
                <button onClick={() => window.print()} className="btn-primary text-sm">
                  Download PDF
                </button>
              </>
            )}
            <button
              onClick={() => setShowArchives(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                showArchives
                  ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                  : 'bg-white text-brand-dark/60 border-brand-cream hover:text-brand-dark'
              }`}
            >
              Archives {archives.length > 0 && (
                <span className={`rounded-full px-1.5 text-xs ${showArchives ? 'bg-white/20 text-white' : 'bg-[#7C3AED]/10 text-[#7C3AED]'}`}>
                  {archives.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* API key inline input */}
        {showApiKeyInput && !generating && (
          <div className="no-print bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
            <span className="text-xs text-amber-800 font-medium flex-shrink-0">Anthropic API Key</span>
            <input
              type="password"
              className="flex-1 px-3 py-1.5 text-xs border border-amber-300 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="sk-ant-api03-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              autoFocus
            />
            <button
              onClick={() => { setShowApiKeyInput(false); generateDraft(); }}
              className="px-3 py-1.5 text-xs font-semibold bg-brand-dark text-white rounded-lg hover:bg-brand-dark/90"
            >
              Generate
            </button>
            <button onClick={() => setShowApiKeyInput(false)} className="text-xs text-amber-700 hover:text-amber-900">Cancel</button>
          </div>
        )}

        {generateError && (
          <div className="no-print bg-red-50 border-b border-red-200 px-6 py-2 flex items-center justify-between">
            <p className="text-xs text-red-700">{generateError}</p>
            <button onClick={() => setGenerateError('')} className="text-xs text-red-500 hover:text-red-700 ml-4">✕</button>
          </div>
        )}

        {/* Archives panel */}
        {showArchives ? (
          <div className="flex-1 overflow-auto p-5">
            <div className="max-w-3xl mx-auto">
              {archives.length === 0 ? (
                <div className="text-center py-16 text-brand-dark/40">
                  <p className="font-medium text-brand-dark/50 mb-1">No saved reports yet</p>
                  <p className="text-sm">Save a report to archive it here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {archives.map(archive => {
                    const saved = new Date(archive.savedAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    });
                    return (
                      <div key={archive.id} className="card p-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-brand-dark">Week of {archive.weekLabel}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-brand-dark/40">{saved}</span>
                            <span className="text-xs text-brand-dark/20">·</span>
                            <span className="text-xs text-[#7C3AED] font-medium">{formatCurrency(archive.stats.totalValue)}</span>
                            <span className="text-xs text-brand-dark/20">·</span>
                            <span className="text-xs text-brand-dark/50">{archive.stats.clientCount} clients</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => setViewingArchive(archive)} className="btn-primary py-1.5 px-3 text-sm">View</button>
                          <button
                            onClick={() => deleteArchive(archive.id)}
                            className="text-brand-dark/30 hover:text-red-500 transition-colors text-sm px-2 py-1.5"
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Current report */
          <div className="flex-1 overflow-auto p-5">
            <div ref={reportRef} className="max-w-4xl mx-auto space-y-4 print-compact">

              {/* Report header */}
              <div className="card overflow-hidden">
                <div className="bg-brand-dark px-6 py-4 print-header">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="bg-[#7C3AED] px-2 py-0.5"><span className="font-mono font-bold text-white text-xs tracking-tight leading-none">K⟡</span></div>
                        <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Weekly Business Report</p>
                      </div>
                      <h1 className="font-display text-2xl font-bold text-white">{companyName}</h1>
                      <p className="text-white/50 text-xs mt-0.5">{reportDate}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[#7C3AED]/70 text-xs font-medium uppercase tracking-widest mb-0.5">Week of</p>
                      <p className="text-white font-medium text-sm">{weekLabel}</p>
                      <p className="text-white/50 text-xs mt-0.5">{clients.length} active sponsors</p>
                    </div>
                  </div>
                </div>
                <div className="h-0.5 bg-[#7C3AED] print-accent" />
              </div>

              {/* Pipeline Metrics */}
              <SectionWrapper title="Pipeline Metrics" hidden={!!hiddenSections.metrics} onToggle={() => toggleSection('metrics')}>
              <div className="card p-4">
                <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Pipeline Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print-metrics mb-4">
                  {(() => {
                    const metricsData = [
                      { label: 'Total Pipeline', value: formatCurrency(stats.totalValue), delta: fmtDelta(stats.totalValue, prevStats?.totalValue), color: 'text-brand-dark' },
                      { label: 'Active Value', value: formatCurrency(stats.activeValue), delta: fmtDelta(stats.activeValue, prevStats?.activeValue), color: 'text-[#7C3AED]' },
                      { label: 'Closed Value', value: formatCurrency(stats.closedValue), delta: fmtDelta(stats.closedValue, prevStats?.closedValue), color: 'text-emerald-600' },
                      { label: 'Avg. Deal', value: formatCurrency(stats.avgDeal), delta: null, color: 'text-brand-dark' },
                    ];
                    return metricsData.map(m => (
                      <div key={m.label} className="metric-card">
                        <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">{m.label}</p>
                        <p className={`font-display text-xl font-bold ${m.color}`}>{m.value}</p>
                        {m.delta && (
                          <p className={`text-xs font-medium mt-0.5 ${m.delta.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                            {m.delta.text} {m.delta.positive ? '↑' : '↓'} WoW
                          </p>
                        )}
                      </div>
                    ));
                  })()}
                </div>
                <div className="grid grid-cols-3 gap-3 print-metrics mb-4">
                  {[
                    { label: 'New', value: stats.newThisWeek.length, delta: fmtCountDelta(stats.newThisWeek.length, prevStats?.newThisWeek), color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'Contacted', value: stats.contactedThisWeek.length, delta: fmtCountDelta(stats.contactedThisWeek.length, prevStats?.contactedThisWeek), color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                    { label: 'Stale (7d+)', value: stats.staleClients.length, delta: fmtCountDelta(stats.staleClients.length, prevStats?.staleCount), color: stats.staleClients.length > 0 ? 'text-amber-700' : 'text-emerald-600', bg: stats.staleClients.length > 0 ? 'bg-amber-50' : 'bg-emerald-50', border: stats.staleClients.length > 0 ? 'border-amber-100' : 'border-emerald-100' },
                  ].map(item => (
                    <div key={item.label} className={`rounded-lg px-3 py-2 text-center ${item.bg} border ${item.border}`}>
                      <p className={`font-display text-xl font-bold ${item.color}`}>{item.value}</p>
                      <p className="text-xs text-brand-dark/60 font-medium">{item.label}</p>
                      {item.delta && (
                        <p className={`text-xs font-medium ${item.delta.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                          {item.delta.text} WoW
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-brand-dark/60 uppercase tracking-wider mb-2">Stage Breakdown</h3>
                  <div className="space-y-1.5">
                    {PIPELINE_STAGES.map(stage => {
                      const stageClients = stats.byStage[stage];
                      const value = stageClients.reduce((s, c) => s + c.value, 0);
                      const cfg = STAGE_CONFIG[stage];
                      const prevCount = prevStats?.byStage[stage]?.count;
                      const delta = fmtCountDelta(stageClients.length, prevCount);
                      return (
                        <div key={stage} className="flex items-center gap-3 print-stage-row">
                          <div className="w-28 flex-shrink-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              <span className="text-xs font-medium text-brand-dark">{stage}</span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="h-4 print-stage-bar bg-brand-light rounded-full overflow-hidden">
                              <div
                                className={`h-full ${cfg.dot} rounded-full transition-all duration-500 flex items-center justify-end pr-1.5`}
                                style={{ width: `${Math.max((stageClients.length / maxCount) * 100, 4)}%` }}
                              >
                                {stageClients.length > 0 && <span className="text-white text-xs font-bold leading-none">{stageClients.length}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="w-20 text-right flex-shrink-0 flex items-center justify-end gap-1">
                            {delta && (
                              <span className={`text-xs font-medium ${delta.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                                {delta.text}
                              </span>
                            )}
                            <span className="text-xs font-semibold text-[#7C3AED]">{formatCurrency(value)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              </SectionWrapper>

              <SectionWrapper title="Pipeline Updates" hidden={!!hiddenSections.pipelineUpdates} onToggle={() => toggleSection('pipelineUpdates')}>
              <EditableSection
                title="Pipeline Updates"
                placeholder={`e.g.\nNetflix follow-up sent — awaiting CMO response\nPodcast sponsorship pitch to Google delivered — positive signal\nNew intro to Paramount via Oliver`}
                value={notes.pipelineUpdates}
                onChange={setNote('pipelineUpdates')}
              />
              </SectionWrapper>

              {stats.topClients.length > 0 && (
                <SectionWrapper title="Top Opportunities" hidden={!!hiddenSections.topOpportunities} onToggle={() => toggleSection('topOpportunities')}>
                <div className="card p-4">
                  <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Top Opportunities</h2>
                  <div className="space-y-1.5">
                    {stats.topClients.map((client, i) => {
                      const cfg = STAGE_CONFIG[client.stage];
                      return (
                        <div key={client.id} className="flex items-center gap-3 p-2 rounded-lg bg-brand-light">
                          <span className="w-5 h-5 rounded-full bg-[#7C3AED]/20 text-[#7C3AED] font-bold text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs text-brand-dark truncate">
                              {client.name} <span className="font-normal text-brand-dark/50">— {client.company}</span>
                            </p>
                          </div>
                          <span className={`stage-badge text-xs ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{client.stage}</span>
                          <span className="font-bold text-[#7C3AED] text-xs flex-shrink-0">{formatCurrency(client.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </SectionWrapper>
              )}


              <SectionWrapper title="Meetings & Calls" hidden={!!hiddenSections.meetings} onToggle={() => toggleSection('meetings')}>
              <EditableSection
                title="Meetings & Calls"
                placeholder={`e.g.\nNetflix — Lisa Kim — sponsor briefing call (Mon)\nGoogle partnerships — intro call via Oliver referral (Wed)\nInternal sync — pipeline review (Thu)`}
                value={notes.meetings}
                onChange={setNote('meetings')}
              />
              </SectionWrapper>

              <SectionWrapper title="Actions Completed" hidden={!!hiddenSections.actions} onToggle={() => toggleSection('actions')}>
              <EditableSection
                title="Actions Completed"
                placeholder={`e.g.\nSent revised sponsor proposal to Meta with solo newsletter + events bundle\nFollowed up with Goldman Sachs on Q3 decision\nOnboarded Amazon to Status rate card and audience deck`}
                value={notes.actions}
                onChange={setNote('actions')}
              />
              </SectionWrapper>

              <SectionWrapper title="Next Week's Focus" hidden={!!hiddenSections.nextFocus} onToggle={() => toggleSection('nextFocus')}>
              <EditableSection
                title="Next Week's Focus"
                placeholder={`e.g.\nClose Netflix deal — final sign-off this week\nPush Google to proposal stage — send deck by Tuesday\nNew outreach: Apple, Spotify, Paramount`}
                value={notes.nextFocus}
                onChange={setNote('nextFocus')}
              />
              </SectionWrapper>

              <div className="text-center py-2 border-t border-brand-cream">
                <p className="text-xs text-brand-dark/30">
                  {companyName} · {reportDate}
                </p>
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
}
