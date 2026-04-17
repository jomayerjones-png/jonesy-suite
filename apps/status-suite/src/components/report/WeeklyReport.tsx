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

const STORAGE_KEY_REPORT = 'status_suite_weekly_report';
const STORAGE_KEY_ARCHIVES = 'status_suite_report_archives';

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
    <div className="fixed inset-0 z-50 bg-brand-light overflow-auto">
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
                    <div className="bg-[#E8471C] px-2 py-0.5"><span className="font-display font-bold text-white text-xs tracking-tighter leading-none">STATUS</span></div>
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
            <div className="h-0.5 bg-[#E8471C] print-accent" />
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
          {archive.notes.nextFocus && <NotesReadOnly title="Next Week's Focus" value={archive.notes.nextFocus} />}

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

  const stats = useMemo(() => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const staleClients = clients.filter(c => isStale(c.lastContact));
    const newThisWeek = clients.filter(c => new Date(c.createdAt).getTime() >= oneWeekAgo);
    const contactedThisWeek = clients.filter(c => new Date(c.lastContact).getTime() >= oneWeekAgo);
    const byStage: Record<PipelineStage, Client[]> = {
      Engaged: [], 'Meeting Set': [], 'Proposal Sent': [], Feedback: [], Close: [],
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

  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const saveToArchive = () => {
    const byStageSnapshot: Record<PipelineStage, { count: number; value: number }> = {
      Engaged: { count: 0, value: 0 }, 'Meeting Set': { count: 0, value: 0 },
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
          <div className="flex-1 overflow-auto p-5">
            <div ref={reportRef} className="max-w-4xl mx-auto space-y-4 print-compact">

              {/* Report header */}
              <div className="card overflow-hidden">
                <div className="bg-brand-dark px-6 py-4 print-header">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                    <div className="bg-[#E8471C] px-2 py-0.5"><span className="font-display font-bold text-white text-xs tracking-tighter leading-none">STATUS</span></div>
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
                <div className="h-0.5 bg-[#E8471C] print-accent" />
              </div>

              {/* Pipeline Metrics */}
              <SectionWrapper title="Pipeline Metrics" hidden={!!hiddenSections.metrics} onToggle={() => toggleSection('metrics')}>
              <div className="card p-4">
                <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Pipeline Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print-metrics mb-4">
                  {[
                    { label: 'Total Pipeline', value: formatCurrency(stats.totalValue), sub: 'All active deals', color: 'text-brand-dark' },
                    { label: 'Active Value', value: formatCurrency(stats.activeValue), sub: 'Excl. closed', color: 'text-brand-gold' },
                    { label: 'Closed Value', value: formatCurrency(stats.closedValue), sub: `${stats.byStage.Close.length} closed`, color: 'text-emerald-600' },
                    { label: 'Avg. Deal', value: formatCurrency(stats.avgDeal), sub: `${clients.length} clients`, color: 'text-brand-dark' },
                  ].map(m => (
                    <div key={m.label} className="metric-card">
                      <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">{m.label}</p>
                      <p className={`font-display text-xl font-bold ${m.color}`}>{m.value}</p>
                      <p className="text-xs text-brand-dark/40 no-print">{m.sub}</p>
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
                      const stale = isStale(client.lastContact);
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
              <EditableSection
                title="Meetings Attended"
                placeholder={`e.g.\nRolex — Arnaud Boetsch — scope clarification call (Tue)\nMeta partnerships team — Chris Cox — intro meeting (Wed)\nInternal strategy sync with team (Thu)`}
                value={notes.meetings}
                onChange={setNote('meetings')}
              />
              </SectionWrapper>

              <SectionWrapper title="Actions Taken & Completed" hidden={!!hiddenSections.actions} onToggle={() => toggleSection('actions')}>
              <EditableSection
                title="Actions Taken & Completed"
                placeholder={`e.g.\nSent revised Samsung proposal with updated integration scope\nFollowed up with Toyota on end-of-month decision timeline\nOnboarded Adobe contact to LIFE editorial preview deck`}
                value={notes.actions}
                onChange={setNote('actions')}
              />
              </SectionWrapper>

              <SectionWrapper title="Next Week's Focus" hidden={!!hiddenSections.nextFocus} onToggle={() => toggleSection('nextFocus')}>
              <EditableSection
                title="Next Week's Focus"
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
