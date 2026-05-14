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

const STORAGE_KEY_REPORT = 'jonesy_suite_weekly_report';
const STORAGE_KEY_ARCHIVES = 'jonesy_suite_report_archives';
const STORAGE_KEY_PREV_SNAPSHOT = 'jonesy_suite_prev_snapshot';
const REPORT_API_KEY_STORAGE = 'jonesy_suite_intel_api_key';

const STALE_DAYS = 15;

interface ReportNotes {
  stageChanges: string;
  activity: string;
  materials: string;
  focusAhead: string;
}

const EMPTY_NOTES: ReportNotes = {
  stageChanges: '',
  activity: '',
  materials: '',
  focusAhead: '',
};

interface PipelineSnapshot {
  totalValue: number;
  activeValue: number;
  closedValue: number;
  clientCount: number;
  byStage: Record<PipelineStage, { count: number; value: number }>;
}

interface ArchivedStats extends PipelineSnapshot {
  avgDeal: number;
  staleCount: number;
  deals: Array<{ name: string; company: string; stage: PipelineStage; value: number; stale: boolean; daysSinceContact: number }>;
}

interface ArchivedReport {
  id: string;
  weekLabel: string;
  savedAt: string;
  companyName: string;
  notes: ReportNotes;
  stats: ArchivedStats;
  prevStats: PipelineSnapshot | null;
}

function delta(current: number, previous: number | undefined): string {
  if (previous === undefined || previous === null) return '';
  const diff = current - previous;
  if (diff === 0) return '';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${formatCurrency(diff)}`;
}

function deltaCount(current: number, previous: number | undefined): string {
  if (previous === undefined || previous === null) return '';
  const diff = current - previous;
  if (diff === 0) return '';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff}`;
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
  .print-header { padding: 10px 14px !important; background-color: #111827 !important; }
  .print-accent { background: #111827 !important; }
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
          className="w-full px-3 py-2 bg-brand-light border border-brand-cream-dark rounded-lg text-sm text-brand-dark placeholder-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold resize-y transition-all duration-150 font-sans leading-relaxed"
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
            <span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold flex-shrink-0" />
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

function DeltaBadge({ value }: { value: string }) {
  if (!value) return null;
  const isPositive = value.startsWith('+');
  return (
    <span className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
      {value}
    </span>
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
  const prev = archive.prevStats;

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

          {/* Header */}
          <div className="card overflow-hidden">
            <div className="bg-brand-dark px-6 py-4 print-header">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-brand-gold/70 text-xs font-medium uppercase tracking-widest mb-0.5">Partnership Update</p>
                  <h1 className="font-display text-2xl font-bold text-white">{archive.companyName}</h1>
                  <p className="text-white/50 text-xs mt-0.5">Saved {savedDate}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-brand-gold/70 text-xs font-medium uppercase tracking-widest mb-0.5">Week of</p>
                  <p className="text-white font-medium text-sm">{archive.weekLabel}</p>
                  <p className="text-white/50 text-xs mt-0.5">{archive.stats.clientCount} deals</p>
                </div>
              </div>
            </div>
            <div className="h-0.5 bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold-dark print-accent" />
          </div>

          {/* Pipeline Summary */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Pipeline Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print-metrics mb-4">
              {[
                { label: 'Total Pipeline', value: formatCurrency(archive.stats.totalValue), delta: delta(archive.stats.totalValue, prev?.totalValue) },
                { label: 'Active Value', value: formatCurrency(archive.stats.activeValue), delta: delta(archive.stats.activeValue, prev?.activeValue) },
                { label: 'Closed Value', value: formatCurrency(archive.stats.closedValue), delta: delta(archive.stats.closedValue, prev?.closedValue) },
                { label: 'Total Deals', value: String(archive.stats.clientCount), delta: deltaCount(archive.stats.clientCount, prev?.clientCount) },
              ].map(m => (
                <div key={m.label} className="metric-card">
                  <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">{m.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="font-display text-xl font-bold text-brand-dark">{m.value}</p>
                    <DeltaBadge value={m.delta} />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-brand-dark/60 uppercase tracking-wider mb-2">Stage Breakdown</h3>
              <div className="space-y-1.5">
                {PIPELINE_STAGES.map(stage => {
                  const s = archive.stats.byStage[stage] ?? { count: 0, value: 0 };
                  const prevS = prev?.byStage[stage];
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
                      <div className="w-24 text-right flex-shrink-0 flex items-center justify-end gap-1.5">
                        <span className="text-xs font-semibold text-brand-gold">{formatCurrency(s.value)}</span>
                        {prevS && <DeltaBadge value={deltaCount(s.count, prevS.count)} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {archive.notes.stageChanges && <NotesReadOnly title="Stage Changes" value={archive.notes.stageChanges} />}
          {archive.notes.activity && <NotesReadOnly title="Activity This Week" value={archive.notes.activity} />}

          {/* Deal overview */}
          {archive.stats.deals.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">All Deals</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-brand-cream">
                      <th className="text-left py-2 pr-3 font-semibold text-brand-dark/50 uppercase tracking-wider">Prospect</th>
                      <th className="text-left py-2 pr-3 font-semibold text-brand-dark/50 uppercase tracking-wider">Company</th>
                      <th className="text-left py-2 pr-3 font-semibold text-brand-dark/50 uppercase tracking-wider">Stage</th>
                      <th className="text-right py-2 pr-3 font-semibold text-brand-dark/50 uppercase tracking-wider">Value</th>
                      <th className="text-right py-2 font-semibold text-brand-dark/50 uppercase tracking-wider">Last Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archive.stats.deals.map((deal, i) => {
                      const cfg = STAGE_CONFIG[deal.stage];
                      return (
                        <tr key={i} className={`border-b border-brand-cream/50 ${deal.stale ? 'bg-amber-50' : ''}`}>
                          <td className="py-2 pr-3 font-semibold text-brand-dark">{deal.name}</td>
                          <td className="py-2 pr-3 text-brand-dark/60">{deal.company}</td>
                          <td className="py-2 pr-3"><span className={`stage-badge ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{deal.stage}</span></td>
                          <td className="py-2 pr-3 text-right font-bold text-brand-gold">{formatCurrency(deal.value)}</td>
                          <td className={`py-2 text-right ${deal.stale ? 'text-amber-600 font-medium' : 'text-brand-dark/50'}`}>{deal.daysSinceContact}d ago</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {archive.notes.materials && <NotesReadOnly title="New Materials" value={archive.notes.materials} />}
          {archive.notes.focusAhead && <NotesReadOnly title="Focus for Weeks Ahead" value={archive.notes.focusAhead} />}

          {/* Footer */}
          <div className="text-center py-2 border-t border-brand-cream">
            <p className="text-xs text-brand-dark/30">
              {archive.companyName} · Week of {archive.weekLabel} · Prepared by Jonesy&amp;Co
            </p>
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

  const [prevSnapshot, setPrevSnapshot] = useState<PipelineSnapshot | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PREV_SNAPSHOT);
      if (stored) return JSON.parse(stored) as PipelineSnapshot;
    } catch { /* fall through */ }
    return null;
  });

  const [showArchives, setShowArchives] = useState(false);
  const [viewingArchive, setViewingArchive] = useState<ArchivedReport | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy Text');
  const [saveLabel, setSaveLabel] = useState('Save Report');
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setHiddenSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REPORT, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ARCHIVES, JSON.stringify(archives));
  }, [archives]);

  const setNote = (key: keyof ReportNotes) => (value: string) =>
    setNotes(prev => ({ ...prev, [key]: value }));

  // ── AI Report Generation ────────────────────────────────────────
  const [reportApiKey, setReportApiKey] = useState(() => localStorage.getItem(REPORT_API_KEY_STORAGE) ?? '');
  const [showReportKey, setShowReportKey] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    if (reportApiKey) localStorage.setItem(REPORT_API_KEY_STORAGE, reportApiKey);
  }, [reportApiKey]);

  const handleGenerateReport = async () => {
    const key = reportApiKey.trim() || localStorage.getItem(REPORT_API_KEY_STORAGE)?.trim();
    if (!key) { setAiError('Enter your Anthropic API key to generate a report.'); return; }
    if (clients.length === 0) { setAiError('No deals in pipeline — add some first.'); return; }
    setAiError('');
    setAiGenerating(true);

    const dealSummary = clients.map(c =>
      `• ${c.company} (${c.name}) — ${c.stage}, ${formatCurrency(c.value)}, last contact ${daysSince(c.lastContact)}d ago${c.notes ? `, notes: ${c.notes}` : ''}`
    ).join('\n');

    const stageBreakdown = PIPELINE_STAGES.map(s => {
      const sc = clients.filter(c => c.stage === s);
      return sc.length > 0 ? `${s}: ${sc.length} deal${sc.length > 1 ? 's' : ''} (${formatCurrency(sc.reduce((sum, c) => sum + c.value, 0))})` : null;
    }).filter(Boolean).join(', ');

    const prompt = `You are writing a weekly partnership update report for ${companyName || 'our company'}. Jonesy&Co is a strategic partnerships consultancy helping brands build meaningful partnership programs.

Current pipeline: ${clients.length} deals, total value ${formatCurrency(clients.reduce((s, c) => s + c.value, 0))}.
Stage breakdown: ${stageBreakdown}

All deals:
${dealSummary}

Write 4 sections for the weekly report. Each section should be bullet points (one per line, no bullet characters — just plain text lines).

1. STAGE CHANGES — Note any deals that appear to be moving stages or stalling. Mention specific companies and where they are. If a deal hasn't been contacted in 15+ days, flag it.
2. ACTIVITY THIS WEEK — Write plausible partnership activity for this week based on the current stage of each active deal (meetings, follow-ups, proposals, etc.). Be specific with company names.
3. NEW MATERIALS — Suggest any decks, proposals, or materials that should be prepared based on current deal stages.
4. FOCUS FOR WEEKS AHEAD — Key priorities and next steps based on where deals currently sit.

Return ONLY valid JSON (no markdown, no prose):
{"stageChanges":"line1\\nline2","activity":"line1\\nline2","materials":"line1\\nline2","focusAhead":"line1\\nline2"}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err?.error?.message ?? `API error ${response.status}`);
      }

      const data = await response.json() as { content: { type: string; text?: string }[] };
      const text = data.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim();

      const fence = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const obj = text.match(/\{[\s\S]*?"stageChanges"[\s\S]*?\}/);
      const jsonStr = fence?.[1] ?? obj?.[0];
      if (!jsonStr) throw new Error('Could not parse AI response — try again.');

      const parsed = JSON.parse(jsonStr.replace(/,\s*([}\]])/g, '$1')) as ReportNotes;
      setNotes({
        stageChanges: parsed.stageChanges || '',
        activity: parsed.activity || '',
        materials: parsed.materials || '',
        focusAhead: parsed.focusAhead || '',
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Generation failed — try again.');
    } finally {
      setAiGenerating(false);
    }
  };

  const stats = useMemo(() => {
    const staleClients = clients.filter(c => isStale(c.lastContact, STALE_DAYS));
    const byStage: Record<PipelineStage, Client[]> = {
      Prospect: [], Engaged: [], 'Meeting Set': [], 'Proposal Sent': [], Feedback: [], 'Revised Proposal Sent': [], Close: [],
    };
    clients.forEach(c => byStage[c.stage]?.push(c));
    const totalValue = clients.reduce((s, c) => s + c.value, 0);
    const closedValue = byStage.Close.reduce((s, c) => s + c.value, 0);
    const activeValue = clients.filter(c => c.stage !== 'Close').reduce((s, c) => s + c.value, 0);
    const sortedDeals = [...clients].sort((a, b) => b.value - a.value);
    return {
      staleClients, byStage,
      totalValue, closedValue, activeValue, sortedDeals,
    };
  }, [clients]);

  const currentSnapshot: PipelineSnapshot = useMemo(() => {
    const byStage: Record<PipelineStage, { count: number; value: number }> = {
      Prospect: { count: 0, value: 0 }, Engaged: { count: 0, value: 0 }, 'Meeting Set': { count: 0, value: 0 },
      'Proposal Sent': { count: 0, value: 0 }, Feedback: { count: 0, value: 0 },
      'Revised Proposal Sent': { count: 0, value: 0 }, Close: { count: 0, value: 0 },
    };
    PIPELINE_STAGES.forEach(s => {
      byStage[s] = {
        count: stats.byStage[s].length,
        value: stats.byStage[s].reduce((sum, c) => sum + c.value, 0),
      };
    });
    return {
      totalValue: stats.totalValue,
      activeValue: stats.activeValue,
      closedValue: stats.closedValue,
      clientCount: clients.length,
      byStage,
    };
  }, [stats, clients.length]);

  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const maxCount = Math.max(...PIPELINE_STAGES.map(s => stats.byStage[s].length), 1);

  const saveToArchive = () => {
    const archive: ArchivedReport = {
      id: generateId(),
      weekLabel,
      savedAt: new Date().toISOString(),
      companyName,
      notes: { ...notes },
      stats: {
        ...currentSnapshot,
        avgDeal: clients.length > 0 ? stats.totalValue / clients.length : 0,
        staleCount: stats.staleClients.length,
        deals: stats.sortedDeals.map(c => ({
          name: c.name, company: c.company, stage: c.stage, value: c.value,
          stale: isStale(c.lastContact, STALE_DAYS),
          daysSinceContact: daysSince(c.lastContact),
        })),
      },
      prevStats: prevSnapshot,
    };
    setArchives(prev => [archive, ...prev]);
    setPrevSnapshot(currentSnapshot);
    localStorage.setItem(STORAGE_KEY_PREV_SNAPSHOT, JSON.stringify(currentSnapshot));
    setSaveLabel('✓ Saved!');
    setTimeout(() => setSaveLabel('Save Report'), 2500);
  };

  const deleteArchive = (id: string) => {
    setArchives(prev => prev.filter(a => a.id !== id));
  };

  const handleCopy = async () => {
    if (!reportRef.current) return;
    await navigator.clipboard.writeText(reportRef.current.innerText);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy Text'), 2000);
  };

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
            <h1 className="font-display text-lg font-semibold text-brand-dark">Partnership Update</h1>
            <p className="text-xs text-brand-dark/50 mt-0.5">
              {showArchives ? `${archives.length} saved report${archives.length !== 1 ? 's' : ''}` : `Week of ${weekLabel}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!showArchives && (
              <>
                <button
                  onClick={handleGenerateReport}
                  disabled={aiGenerating}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-brand-dark text-white hover:bg-brand-dark/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  {aiGenerating ? 'Generating…' : '✦ Generate Report'}
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
                  ? 'bg-brand-gold text-brand-dark border-brand-gold-dark'
                  : 'bg-white text-brand-dark/60 border-brand-cream hover:text-brand-dark'
              }`}
            >
              Archives {archives.length > 0 && (
                <span className={`rounded-full px-1.5 text-xs ${showArchives ? 'bg-brand-dark/20 text-brand-dark' : 'bg-brand-gold/20 text-brand-gold'}`}>
                  {archives.length}
                </span>
              )}
            </button>
          </div>
        </div>

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
                            <span className="text-xs text-brand-gold font-medium">{formatCurrency(archive.stats.totalValue)}</span>
                            <span className="text-xs text-brand-dark/20">·</span>
                            <span className="text-xs text-brand-dark/50">{archive.stats.clientCount} deals</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setViewingArchive(archive)}
                            className="btn-primary py-1.5 px-3 text-sm"
                          >
                            View
                          </button>
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
                      <p className="text-brand-gold/70 text-xs font-medium uppercase tracking-widest mb-0.5">Partnership Update</p>
                      <h1 className="font-display text-2xl font-bold text-white">{companyName}</h1>
                      <p className="text-white/50 text-xs mt-0.5">{reportDate}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-brand-gold/70 text-xs font-medium uppercase tracking-widest mb-0.5">Week of</p>
                      <p className="text-white font-medium text-sm">{weekLabel}</p>
                      <p className="text-white/50 text-xs mt-0.5">{clients.length} active deals</p>
                    </div>
                  </div>
                </div>
                <div className="h-0.5 bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold-dark print-accent" />
              </div>

              {/* AI Key + error — no-print */}
              {!reportApiKey.trim() && !localStorage.getItem(REPORT_API_KEY_STORAGE)?.trim() && (
                <div className="no-print bg-brand-light border border-brand-cream rounded-xl p-4 space-y-2">
                  <label className="text-xs font-semibold text-brand-dark uppercase tracking-wider">Anthropic API Key</label>
                  <div className="relative">
                    <input
                      type={showReportKey ? 'text' : 'password'}
                      className="w-full px-3 py-2 bg-white border border-brand-cream rounded-lg text-xs font-mono text-brand-dark placeholder-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold"
                      value={reportApiKey}
                      onChange={e => setReportApiKey(e.target.value)}
                      placeholder="sk-ant-api03-…"
                    />
                    <button type="button" onClick={() => setShowReportKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-brand-dark/40 hover:text-brand-dark px-1.5 py-0.5 rounded">
                      {showReportKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className="text-xs text-brand-dark/40">Required for AI report generation. Saved locally.</p>
                </div>
              )}
              {aiError && (
                <div className="no-print bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                  <p className="text-xs text-red-700">{aiError}</p>
                  <button onClick={() => setAiError('')} className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
                </div>
              )}
              {aiGenerating && (
                <div className="no-print bg-brand-dark/5 border border-brand-dark/10 rounded-xl px-4 py-3">
                  <p className="text-xs text-brand-dark font-medium animate-pulse">Analyzing pipeline and generating report…</p>
                </div>
              )}

              {/* Pipeline Summary with WoW deltas */}
              <SectionWrapper title="Pipeline Summary" hidden={!!hiddenSections.metrics} onToggle={() => toggleSection('metrics')}>
              <div className="card p-4">
                <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Pipeline Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print-metrics mb-4">
                  {[
                    { label: 'Total Pipeline', value: formatCurrency(stats.totalValue), delta: delta(stats.totalValue, prevSnapshot?.totalValue) },
                    { label: 'Active Value', value: formatCurrency(stats.activeValue), delta: delta(stats.activeValue, prevSnapshot?.activeValue) },
                    { label: 'Closed Value', value: formatCurrency(stats.closedValue), delta: delta(stats.closedValue, prevSnapshot?.closedValue) },
                    { label: 'Total Deals', value: String(clients.length), delta: deltaCount(clients.length, prevSnapshot?.clientCount) },
                  ].map(m => (
                    <div key={m.label} className="metric-card">
                      <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">{m.label}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="font-display text-xl font-bold text-brand-dark">{m.value}</p>
                        <DeltaBadge value={m.delta} />
                      </div>
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
                      const prevS = prevSnapshot?.byStage[stage];
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
                          <div className="w-24 text-right flex-shrink-0 flex items-center justify-end gap-1.5">
                            <span className="text-xs font-semibold text-brand-gold">{formatCurrency(value)}</span>
                            {prevS && <DeltaBadge value={deltaCount(stageClients.length, prevS.count)} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              </SectionWrapper>

              {/* Stage Changes — specific deal movements */}
              <SectionWrapper title="Stage Changes" hidden={!!hiddenSections.stageChanges} onToggle={() => toggleSection('stageChanges')}>
              <EditableSection
                title="Stage Changes"
                placeholder={`e.g.\nNike moved from Proposal Sent → Feedback — awaiting CMO sign-off\nSpotify advanced to Meeting Set — call confirmed for Apr 12\nAmex closed at $100K — 3-month activation deal`}
                value={notes.stageChanges}
                onChange={setNote('stageChanges')}
              />
              </SectionWrapper>

              {/* Activity this week */}
              <SectionWrapper title="Activity This Week" hidden={!!hiddenSections.activity} onToggle={() => toggleSection('activity')}>
              <EditableSection
                title="Activity This Week"
                placeholder={`e.g.\nCall with Sarah Chen — reviewed pipeline priorities (Tue)\nProposal sent to Nike — integrated campaign scope, $250K (Wed)\nIntro meeting with David Kim, American Express (Thu)`}
                value={notes.activity}
                onChange={setNote('activity')}
              />
              </SectionWrapper>

              {/* All Deals table */}
              {stats.sortedDeals.length > 0 && (
                <SectionWrapper title="All Deals" hidden={!!hiddenSections.deals} onToggle={() => toggleSection('deals')}>
                <div className="card p-4">
                  <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">All Deals</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-brand-cream">
                          <th className="text-left py-2 pr-3 font-semibold text-brand-dark/50 uppercase tracking-wider">Prospect</th>
                          <th className="text-left py-2 pr-3 font-semibold text-brand-dark/50 uppercase tracking-wider">Company</th>
                          <th className="text-left py-2 pr-3 font-semibold text-brand-dark/50 uppercase tracking-wider">Stage</th>
                          <th className="text-right py-2 pr-3 font-semibold text-brand-dark/50 uppercase tracking-wider">Value</th>
                          <th className="text-right py-2 font-semibold text-brand-dark/50 uppercase tracking-wider">Last Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.sortedDeals.map(client => {
                          const cfg = STAGE_CONFIG[client.stage];
                          const stale = isStale(client.lastContact, STALE_DAYS);
                          const days = daysSince(client.lastContact);
                          return (
                            <tr key={client.id} className={`border-b border-brand-cream/50 ${stale ? 'bg-amber-50' : ''}`}>
                              <td className="py-2 pr-3 font-semibold text-brand-dark">{client.name}</td>
                              <td className="py-2 pr-3 text-brand-dark/60">{client.company}</td>
                              <td className="py-2 pr-3"><span className={`stage-badge ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{client.stage}</span></td>
                              <td className="py-2 pr-3 text-right font-bold text-brand-gold">{formatCurrency(client.value)}</td>
                              <td className={`py-2 text-right ${stale ? 'text-amber-600 font-medium' : 'text-brand-dark/50'}`}>{days}d ago</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                </SectionWrapper>
              )}

              {/* New Materials */}
              <SectionWrapper title="New Materials" hidden={!!hiddenSections.materials} onToggle={() => toggleSection('materials')}>
              <EditableSection
                title="New Materials"
                placeholder={`e.g.\nNike x LIFE Brand Partnership deck — Q3 2026 (approved)\nSpotify Exclusive Podcast Distribution proposal (draft)\nUpdated media kit with Q1 performance data`}
                value={notes.materials}
                onChange={setNote('materials')}
              />
              </SectionWrapper>

              {/* Focus for Weeks Ahead */}
              <SectionWrapper title="Focus for Weeks Ahead" hidden={!!hiddenSections.focusAhead} onToggle={() => toggleSection('focusAhead')}>
              <EditableSection
                title="Focus for Weeks Ahead"
                placeholder={`e.g.\nClose Nike partnership — final sign-off expected by Apr 15\nSecond meeting with Spotify — present distribution terms\nInitiate Amex event co-branding conversation`}
                value={notes.focusAhead}
                onChange={setNote('focusAhead')}
              />
              </SectionWrapper>

              {/* Footer */}
              <div className="text-center py-2 border-t border-brand-cream">
                <p className="text-xs text-brand-dark/30">
                  {companyName} · {reportDate} · Prepared by Jonesy&amp;Co
                </p>
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
}
