import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Client,
  PIPELINE_STAGES,
  PipelineStage,
  STAGE_CONFIG,
  formatCurrency,
  formatDate,
  daysSince,
  isStale,
  generateId,
} from '../../types';

interface WeeklyReportProps {
  clients: Client[];
  companyName: string;
}

const STORAGE_KEY_REPORT = 'life_suite_weekly_report';
const STORAGE_KEY_ARCHIVES = 'life_suite_report_archives';

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

function EditableSection({
  title,
  icon,
  placeholder,
  value,
  onChange,
  printLabel,
}: {
  title: string;
  icon: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  printLabel?: string;
}) {
  const lines = value.split('\n').filter(l => l.trim());

  return (
    <div className="card p-6">
      <div className="no-print">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">{icon}</span>
          <h2 className="font-display text-lg font-semibold text-brand-dark">{title}</h2>
        </div>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full px-3 py-2.5 bg-brand-light border border-brand-cream-dark rounded-lg text-sm text-brand-dark placeholder-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold resize-y transition-all duration-150 font-sans leading-relaxed"
        />
        <p className="text-xs text-brand-dark/30 mt-1.5">One item per line</p>
      </div>
      <div className="print-only hidden">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
          <span className="text-base">{icon}</span>
          <h2 className="font-display text-lg font-semibold text-gray-900">{printLabel ?? title}</h2>
        </div>
        {lines.length > 0 ? (
          <ul className="space-y-1.5">
            {lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 italic">No items recorded.</p>
        )}
      </div>
    </div>
  );
}

function NotesReadOnly({ title, icon, value }: { title: string; icon: string; value: string }) {
  const lines = value.split('\n').filter(l => l.trim());
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-brand-cream">
        <span className="text-base">{icon}</span>
        <h2 className="font-display text-lg font-semibold text-brand-dark">{title}</h2>
      </div>
      {lines.length > 0 ? (
        <ul className="space-y-1.5">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-brand-dark/80">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-gold flex-shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-brand-dark/30 italic">Nothing recorded.</p>
      )}
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
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { background: white !important; font-size: 11pt; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; break-inside: avoid; }
        }
      `}</style>

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
          <span>⎙</span> Download PDF
        </button>
      </div>

      {/* Archived report content */}
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Header */}
          <div className="card overflow-hidden">
            <div className="bg-brand-dark px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-brand-gold/70 text-xs font-medium uppercase tracking-widest mb-1">Weekly Business Report — Archived</p>
                  <h1 className="font-display text-3xl font-bold text-white">{archive.companyName}</h1>
                  <p className="text-white/50 text-sm mt-1">Saved {savedDate}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-brand-gold/70 text-xs font-medium uppercase tracking-widest mb-1">Week of</p>
                  <p className="text-white font-medium">{archive.weekLabel}</p>
                  <p className="text-white/50 text-xs mt-1">{archive.stats.clientCount} clients</p>
                </div>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold-dark" />
          </div>

          {/* Pipeline Metrics */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">📊</span>
              <h2 className="font-display text-lg font-semibold text-brand-dark">Pipeline Metrics</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Pipeline', value: formatCurrency(archive.stats.totalValue), color: 'text-brand-dark' },
                { label: 'Active Value', value: formatCurrency(archive.stats.activeValue), color: 'text-brand-gold' },
                { label: 'Closed Value', value: formatCurrency(archive.stats.closedValue), color: 'text-emerald-600' },
                { label: 'Avg. Deal Size', value: formatCurrency(archive.stats.avgDeal), color: 'text-brand-dark' },
              ].map(m => (
                <div key={m.label} className="metric-card">
                  <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">{m.label}</p>
                  <p className={`font-display text-2xl font-bold ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'New Clients', value: archive.stats.newThisWeek, icon: '✦', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                { label: 'Contacted', value: archive.stats.contactedThisWeek, icon: '◎', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                { label: 'Stale (7d+)', value: archive.stats.staleCount, icon: '⚠', color: archive.stats.staleCount > 0 ? 'text-amber-700' : 'text-emerald-600', bg: archive.stats.staleCount > 0 ? 'bg-amber-50' : 'bg-emerald-50', border: archive.stats.staleCount > 0 ? 'border-amber-100' : 'border-emerald-100' },
              ].map(item => (
                <div key={item.label} className={`rounded-lg p-4 flex items-center gap-3 ${item.bg} border ${item.border}`}>
                  <div className={`text-2xl ${item.color}`}>{item.icon}</div>
                  <div>
                    <p className={`font-display text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-brand-dark/60 font-medium">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brand-dark/60 uppercase tracking-wider mb-3">Stage Breakdown</h3>
              <div className="space-y-2.5">
                {PIPELINE_STAGES.map(stage => {
                  const s = archive.stats.byStage[stage] ?? { count: 0, value: 0 };
                  const cfg = STAGE_CONFIG[stage];
                  return (
                    <div key={stage} className="flex items-center gap-4">
                      <div className="w-32 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className="text-sm font-medium text-brand-dark">{stage}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="h-6 bg-brand-light rounded-full overflow-hidden">
                          <div
                            className={`h-full ${cfg.dot} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                            style={{ width: `${Math.max((s.count / maxCount) * 100, 4)}%` }}
                          >
                            {s.count > 0 && <span className="text-white text-xs font-bold">{s.count}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="w-24 text-right flex-shrink-0">
                        <span className="text-sm font-semibold text-brand-gold">{formatCurrency(s.value)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {archive.notes.pipelineUpdates && <NotesReadOnly title="Pipeline Updates" icon="🔄" value={archive.notes.pipelineUpdates} />}

          {/* Top opportunities */}
          {archive.stats.topClients.length > 0 && (
            <div className="card p-6">
              <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">Top Opportunities</h2>
              <div className="space-y-2.5">
                {archive.stats.topClients.map((client, i) => {
                  const cfg = STAGE_CONFIG[client.stage];
                  return (
                    <div key={i} className={`flex items-center gap-4 p-3 rounded-lg ${client.stale ? 'bg-amber-50 border border-amber-100' : 'bg-brand-light'}`}>
                      <span className="w-7 h-7 rounded-full bg-brand-gold/20 text-brand-gold font-bold text-sm flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-brand-dark truncate">{client.name}</p>
                        <p className="text-xs text-brand-dark/50 truncate">{client.company}</p>
                      </div>
                      <span className={`stage-badge ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{cfg.icon} {client.stage}</span>
                      <span className="font-bold text-brand-gold text-sm flex-shrink-0">{formatCurrency(client.value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {archive.notes.meetings && <NotesReadOnly title="Meetings Attended" icon="🤝" value={archive.notes.meetings} />}
          {archive.notes.actions && <NotesReadOnly title="Actions Taken & Completed" icon="✅" value={archive.notes.actions} />}
          {archive.notes.nextFocus && <NotesReadOnly title="Next Week's Areas of Focus" icon="🎯" value={archive.notes.nextFocus} />}

          {/* Footer */}
          <div className="text-center py-4 border-t border-brand-cream">
            <p className="text-xs text-brand-dark/30">
              {archive.companyName} Suite · Week of {archive.weekLabel} · Archived {savedDate}
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
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { background: white !important; font-size: 11pt; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; break-inside: avoid; }
          .metric-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          h1, h2, h3 { page-break-after: avoid; }
        }
      `}</style>

      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="bg-white border-b border-brand-cream px-6 py-4 flex items-center justify-between no-print">
          <div>
            <h1 className="font-display text-xl font-semibold text-brand-dark">Weekly Report</h1>
            <p className="text-sm text-brand-dark/50 mt-0.5">
              {showArchives ? `${archives.length} saved report${archives.length !== 1 ? 's' : ''}` : `Week of ${weekLabel} · Fill in sections below, then save or download`}
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
                <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 text-sm">
                  <span>⎙</span> Download PDF
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
              ◑ Archives {archives.length > 0 && (
                <span className={`rounded-full px-1.5 text-xs ${showArchives ? 'bg-brand-dark/20 text-brand-dark' : 'bg-brand-gold/20 text-brand-gold'}`}>
                  {archives.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Archives panel */}
        {showArchives ? (
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-3xl mx-auto">
              {archives.length === 0 ? (
                <div className="text-center py-20 text-brand-dark/40">
                  <p className="text-4xl mb-4">◑</p>
                  <p className="font-medium text-brand-dark/50 mb-1">No saved reports yet</p>
                  <p className="text-sm">Click "Save Report" on the current week's report to archive it here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {archives.map(archive => {
                    const saved = new Date(archive.savedAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    });
                    return (
                      <div key={archive.id} className="card p-5 flex items-center gap-5">
                        <div className="w-10 h-10 rounded-full bg-brand-gold/15 border border-brand-gold/25 flex items-center justify-center flex-shrink-0">
                          <span className="text-brand-gold font-display font-bold text-sm">◑</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-brand-dark">Week of {archive.weekLabel}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-brand-dark/40">Saved {saved}</span>
                            <span className="text-xs text-brand-dark/25">·</span>
                            <span className="text-xs text-brand-gold font-medium">{formatCurrency(archive.stats.totalValue)} pipeline</span>
                            <span className="text-xs text-brand-dark/25">·</span>
                            <span className="text-xs text-brand-dark/50">{archive.stats.clientCount} clients</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setViewingArchive(archive)}
                            className="btn-primary py-1.5 px-3 text-sm"
                          >
                            View & Download
                          </button>
                          <button
                            onClick={() => deleteArchive(archive.id)}
                            className="text-brand-dark/30 hover:text-red-500 transition-colors text-sm px-2 py-1.5"
                            title="Delete archive"
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
          <div className="flex-1 overflow-auto p-6">
            <div ref={reportRef} className="max-w-4xl mx-auto space-y-6">

              {/* Report header */}
              <div className="card overflow-hidden">
                <div className="bg-brand-dark px-8 py-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-brand-gold/70 text-xs font-medium uppercase tracking-widest mb-1">Weekly Business Report</p>
                      <h1 className="font-display text-3xl font-bold text-white">{companyName}</h1>
                      <p className="text-white/50 text-sm mt-1">{reportDate}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-brand-gold/70 text-xs font-medium uppercase tracking-widest mb-1">Week of</p>
                      <p className="text-white font-medium">{weekLabel}</p>
                      <p className="text-white/50 text-xs mt-1">{clients.length} active clients</p>
                    </div>
                  </div>
                </div>
                <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold-dark" />
              </div>

              {/* Pipeline Metrics */}
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base">📊</span>
                  <h2 className="font-display text-lg font-semibold text-brand-dark">Pipeline Metrics</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Total Pipeline', value: formatCurrency(stats.totalValue), sub: 'All active deals', color: 'text-brand-dark' },
                    { label: 'Active Value', value: formatCurrency(stats.activeValue), sub: 'Excl. closed deals', color: 'text-brand-gold' },
                    { label: 'Closed Value', value: formatCurrency(stats.closedValue), sub: `${stats.byStage.Close.length} deals closed`, color: 'text-emerald-600' },
                    { label: 'Avg. Deal Size', value: formatCurrency(stats.avgDeal), sub: `Across ${clients.length} clients`, color: 'text-brand-dark' },
                  ].map(m => (
                    <div key={m.label} className="metric-card">
                      <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">{m.label}</p>
                      <p className={`font-display text-2xl font-bold ${m.color}`}>{m.value}</p>
                      <p className="text-xs text-brand-dark/40">{m.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'New Clients', value: stats.newThisWeek.length, icon: '✦', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'Contacted This Week', value: stats.contactedThisWeek.length, icon: '◎', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                    { label: 'Stale (7d+)', value: stats.staleClients.length, icon: '⚠', color: stats.staleClients.length > 0 ? 'text-amber-700' : 'text-emerald-600', bg: stats.staleClients.length > 0 ? 'bg-amber-50' : 'bg-emerald-50', border: stats.staleClients.length > 0 ? 'border-amber-100' : 'border-emerald-100' },
                  ].map(item => (
                    <div key={item.label} className={`rounded-lg p-4 flex items-center gap-3 ${item.bg} border ${item.border}`}>
                      <div className={`text-2xl ${item.color}`}>{item.icon}</div>
                      <div>
                        <p className={`font-display text-2xl font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-xs text-brand-dark/60 font-medium">{item.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-brand-dark/60 uppercase tracking-wider mb-3">Stage Breakdown</h3>
                  <div className="space-y-2.5">
                    {PIPELINE_STAGES.map(stage => {
                      const stageClients = stats.byStage[stage];
                      const value = stageClients.reduce((s, c) => s + c.value, 0);
                      const pct = Math.round((stageClients.length / Math.max(clients.length, 1)) * 100);
                      const cfg = STAGE_CONFIG[stage];
                      return (
                        <div key={stage} className="flex items-center gap-4">
                          <div className="w-32 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              <span className="text-sm font-medium text-brand-dark">{stage}</span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="h-6 bg-brand-light rounded-full overflow-hidden">
                              <div
                                className={`h-full ${cfg.dot} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                                style={{ width: `${Math.max((stageClients.length / maxCount) * 100, 4)}%` }}
                              >
                                {stageClients.length > 0 && <span className="text-white text-xs font-bold">{stageClients.length}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="w-24 text-right flex-shrink-0">
                            <span className="text-sm font-semibold text-brand-gold">{formatCurrency(value)}</span>
                          </div>
                          <div className="w-10 text-right flex-shrink-0 text-xs text-brand-dark/40">{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <EditableSection
                title="Pipeline Updates"
                icon="🔄"
                placeholder={`e.g.\nRolex follow-up call completed — awaiting revised scope feedback\nSamsung proposal at decision stage, chasing CMO sign-off\nNew intro to Verizon sport team via Diego`}
                value={notes.pipelineUpdates}
                onChange={setNote('pipelineUpdates')}
              />

              {stats.topClients.length > 0 && (
                <div className="card p-6">
                  <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">Top Opportunities</h2>
                  <div className="space-y-2.5">
                    {stats.topClients.map((client, i) => {
                      const cfg = STAGE_CONFIG[client.stage];
                      const stale = isStale(client.lastContact);
                      return (
                        <div key={client.id} className={`flex items-center gap-4 p-3 rounded-lg ${stale ? 'bg-amber-50 border border-amber-100' : 'bg-brand-light'}`}>
                          <span className="w-7 h-7 rounded-full bg-brand-gold/20 text-brand-gold font-bold text-sm flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-brand-dark truncate">{client.name}</p>
                              {stale && <span className="stale-indicator text-xs">⚠ stale</span>}
                            </div>
                            <p className="text-xs text-brand-dark/50 truncate">{client.company}</p>
                          </div>
                          <span className={`stage-badge ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{cfg.icon} {client.stage}</span>
                          <span className="font-bold text-brand-gold text-sm flex-shrink-0">{formatCurrency(client.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {stats.staleClients.length > 0 && (
                <div className="card border-amber-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">⚠</div>
                    <div>
                      <h2 className="font-display text-lg font-semibold text-brand-dark">Requires Attention</h2>
                      <p className="text-xs text-amber-700">{stats.staleClients.length} client{stats.staleClients.length > 1 ? 's' : ''} not contacted in 7+ days</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {stats.staleClients
                      .sort((a, b) => daysSince(b.lastContact) - daysSince(a.lastContact))
                      .map(client => {
                        const days = daysSince(client.lastContact);
                        const cfg = STAGE_CONFIG[client.stage];
                        return (
                          <div key={client.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-semibold text-sm text-brand-dark">{client.name}</p>
                                <p className="text-xs text-brand-dark/50">{client.company}</p>
                              </div>
                              <span className={`stage-badge ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{client.stage}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-amber-700">{days} days</p>
                              <p className="text-xs text-brand-dark/50">{formatDate(client.lastContact)}</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <EditableSection
                title="Meetings Attended"
                icon="🤝"
                placeholder={`e.g.\nRolex — Arnaud Boetsch — scope clarification call (Tue)\nMeta partnerships team — Chris Cox — intro meeting (Wed)\nInternal strategy sync with team (Thu)`}
                value={notes.meetings}
                onChange={setNote('meetings')}
              />

              <EditableSection
                title="Actions Taken & Completed"
                icon="✅"
                placeholder={`e.g.\nSent revised Spotify proposal with updated distribution scope\nFollowed up with CNN on programming decision timeline\nOnboarded HubSpot contact to Prof G content partnership deck`}
                value={notes.actions}
                onChange={setNote('actions')}
              />

              <EditableSection
                title="Next Week's Areas of Focus"
                icon="🎯"
                placeholder={`e.g.\nClose Samsung partnership — final sign-off\nSecond meeting with United Airlines — destination storytelling examples\nInitiate LVMH event co-branding conversation`}
                value={notes.nextFocus}
                onChange={setNote('nextFocus')}
                printLabel="Next Week's Areas of Focus"
              />

              {stats.newThisWeek.length > 0 && (
                <div className="card p-6">
                  <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">New This Week</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {stats.newThisWeek.map(client => {
                      const cfg = STAGE_CONFIG[client.stage];
                      return (
                        <div key={client.id} className="flex items-center gap-3 p-3 bg-brand-light rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-brand-dark truncate">{client.name}</p>
                            <p className="text-xs text-brand-dark/50 truncate">{client.company}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`stage-badge ${cfg.bg} ${cfg.color} ${cfg.border} border block mb-1`}>{client.stage}</span>
                            <span className="text-xs font-bold text-brand-gold">{formatCurrency(client.value)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="text-center py-4 border-t border-brand-cream">
                <p className="text-xs text-brand-dark/30">
                  Generated by {companyName} Suite · {reportDate}
                </p>
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
}
