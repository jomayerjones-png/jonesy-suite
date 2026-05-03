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
import { fetchReportArchives, saveReportArchive, deleteReportArchive } from '../../lib/supabase';

interface WeeklyReportProps {
  clients: Client[];
  companyName: string;
}

const STORAGE_KEY_REPORT = 'life_suite_weekly_report';
const STORAGE_KEY_ARCHIVES = 'life_suite_report_archives';
const INTEL_API_KEY = 'life_suite_intel_api_key';

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
  .print-header { padding: 10px 14px !important; background-color: #b91c1c !important; }
  .print-accent { background: #b91c1c !important; }
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
    <div className="fixed inset-0 z-50 bg-brand-light overflow-auto print:relative print:inset-auto print:overflow-visible">
      <style>{PRINT_STYLE}</style>

      {/* Archive viewer toolbar */}
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

      {/* Archived report content */}
      <div className="p-5">
        <div className="max-w-4xl mx-auto space-y-4 print-compact">

          {/* Header */}
          <div className="card overflow-hidden">
            <div className="bg-brand-dark px-6 py-4 print-header">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="bg-[#E8002D] px-2 py-0.5"><span className="font-display font-bold text-white text-xs tracking-tighter leading-none">LIFE</span></div>
                    <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Weekly Business Report</p>
                  </div>
                  <h1 className="font-display text-2xl font-bold text-white">{archive.companyName}</h1>
                  <p className="text-white/50 text-xs mt-0.5">Saved {savedDate}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-brand-gold/70 text-xs font-medium uppercase tracking-widest mb-0.5">Week of</p>
                  <p className="text-white font-medium text-sm">{archive.weekLabel}</p>
                  <p className="text-white/50 text-xs mt-0.5">{archive.stats.clientCount} clients</p>
                </div>
              </div>
            </div>
            <div className="h-0.5 bg-[#E8002D] print-accent" />
          </div>

          {/* Pipeline Metrics */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Pipeline Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print-metrics mb-4">
              {[
                { label: 'Total Pipeline', value: formatCurrency(archive.stats.totalValue), color: 'text-brand-dark' },
                { label: 'Active Value', value: formatCurrency(archive.stats.activeValue), color: 'text-brand-gold' },
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
                        <span className="text-xs font-semibold text-brand-gold">{formatCurrency(s.value)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {archive.notes.pipelineUpdates && <NotesReadOnly title="Pipeline Updates" value={archive.notes.pipelineUpdates} />}

          {/* Top opportunities */}
          {archive.stats.topClients.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Top Opportunities</h2>
              <div className="space-y-1.5">
                {archive.stats.topClients.map((client, i) => {
                  const cfg = STAGE_CONFIG[client.stage];
                  return (
                    <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${client.stale ? 'bg-amber-50 border border-amber-100' : 'bg-brand-light'}`}>
                      <span className="w-5 h-5 rounded-full bg-brand-gold/20 text-brand-gold font-bold text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs text-brand-dark truncate">{client.name} <span className="font-normal text-brand-dark/50">— {client.company}</span></p>
                      </div>
                      <span className={`stage-badge text-xs ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{client.stage}</span>
                      <span className="font-bold text-brand-gold text-xs flex-shrink-0">{formatCurrency(client.value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {archive.notes.meetings && <NotesReadOnly title="Meetings Attended" value={archive.notes.meetings} />}
          {archive.notes.actions && <NotesReadOnly title="Actions Taken & Completed" value={archive.notes.actions} />}
          {archive.notes.nextFocus && <NotesReadOnly title="This Week's Focus" value={archive.notes.nextFocus} />}

          {/* Footer */}
          <div className="text-center py-2 border-t border-brand-cream">
            <p className="text-xs text-brand-dark/30">
              {archive.companyName} Suite · Week of {archive.weekLabel}
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

  useEffect(() => {
    fetchReportArchives()
      .then(data => {
        const remote = data as ArchivedReport[];
        if (remote.length > 0) {
          setArchives(remote);
          localStorage.setItem(STORAGE_KEY_ARCHIVES, JSON.stringify(remote));
        }
      })
      .catch(() => { /* stay on localStorage */ });
  }, []);

  const [showArchives, setShowArchives] = useState(false);
  const [viewingArchive, setViewingArchive] = useState<ArchivedReport | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy Text');
  const [digestLabel, setDigestLabel] = useState('Email Digest');
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

  const setNote = (key: keyof ReportNotes) => (value: string) =>
    setNotes(prev => ({ ...prev, [key]: value }));

  const weekStartStr = useMemo(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const staleClients = clients.filter(c => isStale(c.lastContact, c.stage));
    const newThisWeek = clients.filter(c => new Date(c.createdAt).getTime() >= oneWeekAgo);
    const contactedThisWeek = clients.filter(c => new Date(c.lastContact).getTime() >= oneWeekAgo);
    const byStage: Record<PipelineStage, Client[]> = {
      Prospect: [], Engaged: [], 'Meeting Set': [], 'Proposal Sent': [], Feedback: [], 'Revised Proposal Sent': [], Close: [],
    };
    clients.forEach(c => byStage[c.stage].push(c));
    const totalValue = clients.reduce((s, c) => s + c.value, 0);
    const closedValue = byStage.Close.reduce((s, c) => s + c.value, 0);
    const activeValue = clients.filter(c => c.stage !== 'Close').reduce((s, c) => s + c.value, 0);
    const dealsWithValue = clients.filter(c => c.value > 0);
    const avgDeal = dealsWithValue.length > 0 ? totalValue / dealsWithValue.length : 0;
    const topClients = [...clients].sort((a, b) => b.value - a.value).slice(0, 5);
    return {
      staleClients, newThisWeek, contactedThisWeek, byStage,
      totalValue, closedValue, activeValue, avgDeal, valuedDealsCount: dealsWithValue.length, topClients,
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

  // Auto-populate meetings from client meeting notes this week
  const thisWeekMeetingLines = useMemo(() => {
    return clients.flatMap(c =>
      (c.meetingNotes ?? [])
        .filter(n => n.date >= weekStartStr)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(n => {
          const who = n.attendees ? ` — ${n.attendees}` : '';
          const takeaway = n.takeaways ? ` · ${n.takeaways.split('\n')[0].slice(0, 80)}` : '';
          return `${c.name} @ ${c.company}${who} (${n.date})${takeaway}`;
        })
    );
  }, [clients, weekStartStr]);

  useEffect(() => {
    if (!notes.meetings && thisWeekMeetingLines.length > 0) {
      setNotes(prev => ({ ...prev, meetings: thisWeekMeetingLines.join('\n') }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thisWeekMeetingLines]);

  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const weekEnd = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const saveToArchive = () => {
    const byStageSnapshot: Record<PipelineStage, { count: number; value: number }> = {
      Prospect: { count: 0, value: 0 }, Engaged: { count: 0, value: 0 }, 'Meeting Set': { count: 0, value: 0 },
      'Proposal Sent': { count: 0, value: 0 }, Feedback: { count: 0, value: 0 }, 'Revised Proposal Sent': { count: 0, value: 0 }, Close: { count: 0, value: 0 },
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
          stale: isStale(c.lastContact, c.stage),
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
    saveReportArchive(archive as unknown as Record<string, unknown>).catch(() => {});
    setSaveLabel('✓ Saved!');
    setTimeout(() => setSaveLabel('Save Report'), 2500);
  };

  const deleteArchive = (id: string) => {
    setArchives(prev => prev.filter(a => a.id !== id));
    deleteReportArchive(id).catch(() => {});
  };

  const generateDraft = async () => {
    const key = apiKey.trim();
    if (!key) { setShowApiKeyInput(true); return; }
    setGenerating(true);
    setGenerateError('');

    // ── Assemble week data ─────────────────────────────────────────
    const stageMovements = clients.flatMap(c =>
      (c.stageHistory ?? [])
        .filter(e => e.date >= weekStartStr)
        .map(e => `${c.name} @ ${c.company} → ${e.stage}`)
    );

    const newClients = stats.newThisWeek.map(c =>
      `${c.name} @ ${c.company} (${c.stage}, ${formatCurrency(c.value)})`
    );

    const meetingLines = clients.flatMap(c =>
      (c.meetingNotes ?? [])
        .filter(n => n.date >= weekStartStr)
        .map(n => {
          const who = n.attendees ? ` with ${n.attendees}` : '';
          const notes = n.notes ? ` — ${n.notes.slice(0, 120)}` : '';
          const takeaways = n.takeaways ? ` KEY: ${n.takeaways.slice(0, 80)}` : '';
          return `${c.name} @ ${c.company}${who} (${n.date})${notes}${takeaways}`;
        })
    );

    const staleList = stats.staleClients
      .sort((a, b) => b.value - a.value)
      .map(c => `${c.name} @ ${c.company} — ${daysSince(c.lastContact)}d since contact (${c.stage}, ${formatCurrency(c.value)})`);

    const topList = stats.topClients.map((c, i) =>
      `${i + 1}. ${c.name} @ ${c.company} — ${c.stage} — ${formatCurrency(c.value)}`
    );

    const prevS = prevStats;
    const deltaTotal = prevS ? stats.totalValue - prevS.totalValue : null;
    const deltaActive = prevS ? stats.activeValue - prevS.activeValue : null;
    const deltaCount = prevS ? clients.length - prevS.clientCount : null;

    const prompt = `You are writing a weekly BD report for Jo Mayer Jones, CRO of LIFE magazine (relaunching September 2026 with Karlie Kloss and Josh Kushner). Write like a sharp, direct chief of staff — specific, no filler, action-oriented.

WEEK: ${weekLabel}

PIPELINE NUMBERS:
- Total pipeline: ${formatCurrency(stats.totalValue)}${deltaTotal !== null ? ` (${deltaTotal >= 0 ? '+' : ''}${formatCurrency(deltaTotal)} vs last week)` : ''}
- Active value: ${formatCurrency(stats.activeValue)}${deltaActive !== null ? ` (${deltaActive >= 0 ? '+' : ''}${formatCurrency(deltaActive)} vs last week)` : ''}
- Closed: ${formatCurrency(stats.closedValue)} across ${stats.byStage.Close.length} deals
- Total clients: ${clients.length}${deltaCount !== null ? ` (${deltaCount >= 0 ? '+' : ''}${deltaCount} vs last week)` : ''}
- Contacted this week: ${stats.contactedThisWeek.length}
- Stale (7d+): ${stats.staleClients.length}

TOP OPPORTUNITIES:
${topList.length > 0 ? topList.join('\n') : 'None yet'}

STAGE MOVEMENTS THIS WEEK:
${stageMovements.length > 0 ? stageMovements.join('\n') : 'No stage changes recorded'}

NEW CLIENTS ADDED:
${newClients.length > 0 ? newClients.join('\n') : 'None this week'}

MEETINGS & CALL NOTES THIS WEEK:
${meetingLines.length > 0 ? meetingLines.join('\n') : 'No call notes logged this week'}

REQUIRES FOLLOW-UP (stale):
${staleList.length > 0 ? staleList.slice(0, 6).join('\n') : 'All contacts current'}

---
Generate a JSON object with exactly these four fields. Each field is a string with bullet points separated by newlines (start each with the text, no dash or bullet character — those are added by the UI).

"pipelineUpdates" — 3–5 bullets on what moved in the pipeline this week. Reference specific names and companies. Note deals that advanced, stalled, or need a push. Include WoW value change if meaningful.

"meetings" — list each meeting from the call notes above as: "[Name] @ [Company] — [one-line summary of outcome or next step] ([date])". If no notes logged, write one bullet: "No meetings logged this week — add notes in client cards to auto-populate".

"actions" — 3–5 bullets on concrete actions taken this week (proposals sent, emails sent, follow-ups done, intros made). Infer from the data and stage movements where possible.

"nextFocus" — 3–5 bullets on the highest-priority actions for next week. Be specific: which deal needs closing, which contact needs chasing, what's the decision to force. Think like a CRO.

Return only the JSON object. No prose, no markdown fences.`;

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

  const handleEmailDigest = async () => {
    const advancing = clients
      .filter(c => ['Close', 'Feedback', 'Proposal Sent'].includes(c.stage) && c.outcome === 'active')
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)
      .map(c => `${c.name} @ ${c.company}${c.value > 0 ? ` (${formatCurrency(c.value)})` : ''}`)
      .join(' · ');

    const needsAction = stats.staleClients
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map(c => `${c.name} @ ${c.company} (${daysSince(c.lastContact)}d)`)
      .join(' · ');

    const focusLine = notes.nextFocus
      ? notes.nextFocus.split('\n').filter(l => l.trim()).slice(0, 2).join(' / ')
      : '';

    const lines = [
      `LIFE BD — Week of ${weekLabel}`,
      '',
      `Pipeline: ${formatCurrency(stats.totalValue)} total · ${formatCurrency(stats.activeValue)} active · ${clients.filter(c => c.outcome === 'active').length} deals`,
      advancing ? `Advancing: ${advancing}` : 'Advancing: No deals in late stage yet',
      needsAction ? `Follow up: ${needsAction}` : 'Follow-up: All contacts current',
      focusLine ? `Focus: ${focusLine}` : '',
    ].filter(l => l !== '').join('\n');

    await navigator.clipboard.writeText(lines);
    setDigestLabel('Copied!');
    setTimeout(() => setDigestLabel('Email Digest'), 2500);
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

      <div className="flex flex-col h-full print:block print:h-auto">
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
                <button
                  onClick={generateDraft}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all bg-[#E8002D] text-white border-[#E8002D] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Use Claude to draft all four sections from this week's pipeline data"
                >
                  {generating ? (
                    <>
                      <span className="animate-spin text-xs">◌</span> Drafting…
                    </>
                  ) : (
                    <>✦ Generate Draft</>
                  )}
                </button>
                <button onClick={handleEmailDigest} className="btn-secondary text-sm hidden sm:inline-flex" title="Copy a concise 5-line digest for Slack or email">
                  {digestLabel}
                </button>
                <button onClick={handleCopy} className="btn-secondary text-sm hidden sm:inline-flex">
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

        {/* API key prompt */}
        {showApiKeyInput && (
          <div className="bg-brand-light border-b border-brand-cream px-6 py-3 flex items-center gap-3 no-print">
            <span className="text-xs text-brand-dark/60 flex-shrink-0">Anthropic API key to generate draft:</span>
            <input
              type="password"
              className="input-field flex-1 py-1.5 text-xs font-mono max-w-xs"
              placeholder="sk-ant-…"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); localStorage.setItem(INTEL_API_KEY, e.target.value); }}
            />
            <button
              onClick={() => { setShowApiKeyInput(false); if (apiKey.trim()) generateDraft(); }}
              className="btn-primary text-xs py-1.5 px-3"
            >
              Generate
            </button>
            <button onClick={() => setShowApiKeyInput(false)} className="text-xs text-brand-dark/40 hover:text-brand-dark">✕</button>
          </div>
        )}

        {/* Error banner */}
        {generateError && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center gap-2 no-print">
            <span className="text-xs text-red-600">⚠ {generateError}</span>
            <button onClick={() => setGenerateError('')} className="text-xs text-red-400 hover:text-red-600 ml-auto">✕</button>
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
                            <span className="text-xs text-brand-gold font-medium">{formatCurrency(archive.stats.totalValue)}</span>
                            <span className="text-xs text-brand-dark/20">·</span>
                            <span className="text-xs text-brand-dark/50">{archive.stats.clientCount} clients</span>
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
          <div className="flex-1 overflow-auto p-5 print:overflow-visible print:h-auto">
            <div ref={reportRef} className="max-w-4xl mx-auto space-y-4 print-compact">

              {/* Report header */}
              <div className="card overflow-hidden">
                <div className="bg-brand-dark px-6 py-4 print-header">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                    <div className="bg-[#E8002D] px-2 py-0.5"><span className="font-display font-bold text-white text-xs tracking-tighter leading-none">LIFE</span></div>
                    <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Weekly Business Report</p>
                  </div>
                      <h1 className="font-display text-2xl font-bold text-white">{companyName}</h1>
                      <p className="text-white/50 text-xs mt-0.5">{reportDate}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-brand-gold/70 text-xs font-medium uppercase tracking-widest mb-0.5">Week of</p>
                      <p className="text-white font-medium text-sm">{weekLabel}</p>
                      <p className="text-white/50 text-xs mt-0.5">{clients.length} active clients</p>
                    </div>
                  </div>
                </div>
                <div className="h-0.5 bg-[#E8002D] print-accent" />
              </div>

              {/* Pipeline Metrics */}
              <SectionWrapper title="Pipeline Metrics" hidden={!!hiddenSections.metrics} onToggle={() => toggleSection('metrics')}>
              <div className="card p-4">
                <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Pipeline Metrics</h2>
                {prevStats && (
                  <p className="text-xs text-brand-dark/40 mb-2 no-print">vs. week of {archives[0].weekLabel}</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print-metrics mb-4">
                  {[
                    { label: 'Total Pipeline', value: formatCurrency(stats.totalValue), delta: fmtDelta(stats.totalValue, prevStats?.totalValue), color: 'text-brand-dark' },
                    { label: 'Active Value', value: formatCurrency(stats.activeValue), delta: fmtDelta(stats.activeValue, prevStats?.activeValue), color: 'text-brand-gold' },
                    { label: 'Closed Value', value: formatCurrency(stats.closedValue), delta: fmtDelta(stats.closedValue, prevStats?.closedValue), color: 'text-emerald-600' },
                    { label: 'Avg. Deal', value: formatCurrency(stats.avgDeal), delta: fmtDelta(stats.avgDeal, prevStats?.avgDeal), color: 'text-brand-dark' },
                  ].map(m => (
                    <div key={m.label} className="metric-card">
                      <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">{m.label}</p>
                      <p className={`font-display text-xl font-bold ${m.color}`}>{m.value}</p>
                      {m.delta && (
                        <p className={`text-xs font-medium no-print ${m.delta.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                          {m.delta.text} {m.delta.positive ? '↑' : '↓'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 print-metrics mb-4">
                  {[
                    { label: 'New', value: stats.newThisWeek.length, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'Contacted', value: stats.contactedThisWeek.length, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                    { label: 'Stale (7d+)', value: stats.staleClients.length, color: stats.staleClients.length > 0 ? 'text-amber-700' : 'text-emerald-600', bg: stats.staleClients.length > 0 ? 'bg-amber-50' : 'bg-emerald-50', border: stats.staleClients.length > 0 ? 'border-amber-100' : 'border-emerald-100' },
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
                      const stageClients = stats.byStage[stage];
                      const value = stageClients.reduce((s, c) => s + c.value, 0);
                      const cfg = STAGE_CONFIG[stage];
                      const countDelta = fmtCountDelta(stageClients.length, prevStats?.byStage[stage]?.count);
                      return (
                        <div key={stage} className="flex items-center gap-3 print-stage-row">
                          <div className="w-32 flex-shrink-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              <span className="text-xs font-medium text-brand-dark">{stage}</span>
                              {countDelta && (
                                <span className={`text-xs font-bold no-print ${countDelta.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {countDelta.text}
                                </span>
                              )}
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
                          <div className="w-20 text-right flex-shrink-0">
                            <span className="text-xs font-semibold text-brand-gold">{formatCurrency(value)}</span>
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
                placeholder={`e.g.\nRolex follow-up call completed — awaiting revised scope feedback\nSamsung proposal at decision stage, chasing CMO sign-off\nNew intro to Verizon sport team via Diego`}
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
                      const stale = isStale(client.lastContact, client.stage);
                      return (
                        <div key={client.id} className={`flex items-center gap-3 p-2 rounded-lg ${stale ? 'bg-amber-50 border border-amber-100' : 'bg-brand-light'}`}>
                          <span className="w-5 h-5 rounded-full bg-brand-gold/20 text-brand-gold font-bold text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs text-brand-dark truncate">
                              {client.name} <span className="font-normal text-brand-dark/50">— {client.company}</span>
                              {stale && <span className="ml-1 text-amber-600 text-xs">stale</span>}
                            </p>
                          </div>
                          <span className={`stage-badge text-xs ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{client.stage}</span>
                          <span className="font-bold text-brand-gold text-xs flex-shrink-0">{formatCurrency(client.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </SectionWrapper>
              )}

              {stats.staleClients.length > 0 && (
                <SectionWrapper title="Requires Attention" hidden={!!hiddenSections.attention} onToggle={() => toggleSection('attention')}>
                <div className="card border-amber-200 p-4">
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Requires Attention</h2>
                    <p className="text-xs text-amber-700">{stats.staleClients.length} client{stats.staleClients.length > 1 ? 's' : ''} not contacted in 7+ days</p>
                  </div>
                  <div className="space-y-1.5">
                    {stats.staleClients
                      .sort((a, b) => daysSince(b.lastContact) - daysSince(a.lastContact))
                      .map(client => {
                        const days = daysSince(client.lastContact);
                        const cfg = STAGE_CONFIG[client.stage];
                        return (
                          <div key={client.id} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-100">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-semibold text-xs text-brand-dark">{client.name} <span className="font-normal text-brand-dark/50">— {client.company}</span></p>
                              </div>
                              <span className={`stage-badge text-xs ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{client.stage}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-amber-700">{days}d</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
                </SectionWrapper>
              )}

              <SectionWrapper title="Meetings Attended" hidden={!!hiddenSections.meetings} onToggle={() => toggleSection('meetings')}>
              <div className="card p-4 space-y-3">
                <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Meetings Attended</h2>
                {thisWeekMeetingLines.length > 0 && (
                  <div className="bg-brand-light/60 rounded-lg px-3 py-2.5 border border-brand-cream no-print">
                    <p className="text-xs font-semibold text-brand-dark/40 uppercase tracking-wider mb-1.5">From pipeline notes this week</p>
                    <ul className="space-y-1">
                      {thisWeekMeetingLines.map((line, i) => (
                        <li key={i} className="text-xs text-brand-dark/70 flex items-start gap-1.5">
                          <span className="mt-1 w-1 h-1 rounded-full bg-brand-gold flex-shrink-0" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="no-print">
                  <p className="text-xs text-brand-dark/40 mb-1">Additional notes / context</p>
                  <textarea
                    value={notes.meetings}
                    onChange={e => setNote('meetings')(e.target.value)}
                    placeholder={`e.g.\nRolex — Arnaud Boetsch — scope clarification call (Tue)\nMeta partnerships team — Chris Cox — intro meeting (Wed)`}
                    rows={3}
                    className="w-full px-3 py-2 bg-brand-light border border-brand-cream-dark rounded-lg text-sm text-brand-dark placeholder-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold resize-y transition-all duration-150 font-sans leading-relaxed"
                  />
                </div>
                {/* Print view: combined */}
                <div className="print-only hidden">
                  <ul className="space-y-0.5">
                    {[...thisWeekMeetingLines, ...notes.meetings.split('\n').filter(l => l.trim())].map((line, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-800 leading-snug">
                        <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              </SectionWrapper>

              <SectionWrapper title="Actions Taken & Completed" hidden={!!hiddenSections.actions} onToggle={() => toggleSection('actions')}>
              <EditableSection
                title="Actions Taken & Completed"
                placeholder={`e.g.\nSent revised Samsung proposal with updated integration scope\nFollowed up with Toyota on end-of-month decision timeline\nOnboarded Adobe contact to LIFE editorial preview deck`}
                value={notes.actions}
                onChange={setNote('actions')}
              />
              </SectionWrapper>

              <SectionWrapper title="This Week's Focus" hidden={!!hiddenSections.nextFocus} onToggle={() => toggleSection('nextFocus')}>
              <EditableSection
                title="This Week's Focus"
                placeholder={`e.g.\nClose Samsung partnership — final sign-off\nSecond meeting with United Airlines — destination storytelling examples\nInitiate LVMH event co-branding conversation`}
                value={notes.nextFocus}
                onChange={setNote('nextFocus')}
              />
              </SectionWrapper>

              <div className="text-center py-2 border-t border-brand-cream">
                <p className="text-xs text-brand-dark/30">
                  {companyName} Suite · {reportDate}
                </p>
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
}
