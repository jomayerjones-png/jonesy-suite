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
} from '../../types';

interface WeeklyReportProps {
  clients: Client[];
  companyName: string;
}

const STORAGE_KEY_REPORT = 'jonesy_suite_weekly_report';

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
      {/* Screen view */}
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

      {/* Print view */}
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

export default function WeeklyReport({ clients, companyName }: WeeklyReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const [notes, setNotes] = useState<ReportNotes>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REPORT);
      if (stored) return { ...EMPTY_NOTES, ...JSON.parse(stored) };
    } catch { /* fall through */ }
    return EMPTY_NOTES;
  });

  const [copyLabel, setCopyLabel] = useState('Copy Text');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REPORT, JSON.stringify(notes));
  }, [notes]);

  const setNote = (key: keyof ReportNotes) => (value: string) =>
    setNotes(prev => ({ ...prev, [key]: value }));

  const stats = useMemo(() => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const staleClients = clients.filter(c => isStale(c.lastContact));
    const newThisWeek = clients.filter(c => new Date(c.createdAt).getTime() >= oneWeekAgo);
    const contactedThisWeek = clients.filter(
      c => new Date(c.lastContact).getTime() >= oneWeekAgo
    );
    const byStage: Record<PipelineStage, Client[]> = {
      Engaged: [],
      'Meeting Set': [],
      'Proposal Sent': [],
      Feedback: [],
      Close: [],
    };
    clients.forEach(c => byStage[c.stage].push(c));
    const totalValue = clients.reduce((s, c) => s + c.value, 0);
    const closedValue = byStage.Close.reduce((s, c) => s + c.value, 0);
    const activeValue = clients.filter(c => c.stage !== 'Close').reduce((s, c) => s + c.value, 0);
    const avgDeal = clients.length > 0 ? totalValue / clients.length : 0;
    const topClients = [...clients].sort((a, b) => b.value - a.value).slice(0, 5);
    const meetingSetClients = byStage['Meeting Set'];
    const proposalClients = byStage['Proposal Sent'];
    const feedbackClients = byStage['Feedback'];

    return {
      staleClients,
      newThisWeek,
      contactedThisWeek,
      byStage,
      totalValue,
      closedValue,
      activeValue,
      avgDeal,
      topClients,
      meetingSetClients,
      proposalClients,
      feedbackClients,
    };
  }, [clients]);

  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const handleDownload = () => window.print();

  const handleCopy = async () => {
    if (!reportRef.current) return;
    await navigator.clipboard.writeText(reportRef.current.innerText);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy Text'), 2000);
  };

  const maxCount = Math.max(...PIPELINE_STAGES.map(s => stats.byStage[s].length), 1);

  return (
    <>
      {/* Print-specific styles injected inline for reliability */}
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { background: white !important; font-size: 11pt; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; break-inside: avoid; }
          .metric-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          .report-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
          .report-activity { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
          h1, h2, h3 { page-break-after: avoid; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="bg-white border-b border-brand-cream px-6 py-4 flex items-center justify-between no-print">
          <div>
            <h1 className="font-display text-xl font-semibold text-brand-dark">Weekly Report</h1>
            <p className="text-sm text-brand-dark/50 mt-0.5">Week of {weekLabel} · Fill in sections below, then download</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="btn-secondary">
              {copyLabel}
            </button>
            <button onClick={handleDownload} className="btn-primary flex items-center gap-2">
              <span>⎙</span> Download PDF
            </button>
          </div>
        </div>

        {/* Report content */}
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

            {/* ── SECTION 1: Pipeline Metrics ── */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">📊</span>
                <h2 className="font-display text-lg font-semibold text-brand-dark">Pipeline Metrics</h2>
              </div>

              {/* KPI grid */}
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

              {/* Activity highlights */}
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

              {/* Pipeline by stage */}
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
                              {stageClients.length > 0 && (
                                <span className="text-white text-xs font-bold">{stageClients.length}</span>
                              )}
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

            {/* ── SECTION 2: Pipeline Updates (narrative) ── */}
            <EditableSection
              title="Pipeline Updates"
              icon="🔄"
              placeholder={`e.g.\nRolex follow-up call completed — awaiting revised scope feedback\nSamsung proposal at decision stage, chasing CMO sign-off\nNew intro to Verizon sport team via Diego`}
              value={notes.pipelineUpdates}
              onChange={setNote('pipelineUpdates')}
            />

            {/* Top opportunities (auto) */}
            {stats.topClients.length > 0 && (
              <div className="card p-6">
                <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">Top Opportunities</h2>
                <div className="space-y-2.5">
                  {stats.topClients.map((client, i) => {
                    const cfg = STAGE_CONFIG[client.stage];
                    const stale = isStale(client.lastContact);
                    return (
                      <div key={client.id} className={`flex items-center gap-4 p-3 rounded-lg ${stale ? 'bg-amber-50 border border-amber-100' : 'bg-brand-light'}`}>
                        <span className="w-7 h-7 rounded-full bg-brand-gold/20 text-brand-gold font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-brand-dark truncate">{client.name}</p>
                            {stale && <span className="stale-indicator text-xs">⚠ stale</span>}
                          </div>
                          <p className="text-xs text-brand-dark/50 truncate">{client.company}</p>
                        </div>
                        <span className={`stage-badge ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                          {cfg.icon} {client.stage}
                        </span>
                        <span className="font-bold text-brand-gold text-sm flex-shrink-0">{formatCurrency(client.value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stale alert (auto) */}
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
                            <span className={`stage-badge ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                              {client.stage}
                            </span>
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

            {/* ── SECTION 3: Meetings Attended ── */}
            <EditableSection
              title="Meetings Attended"
              icon="🤝"
              placeholder={`e.g.\nRolex — Arnaud Boetsch — scope clarification call (Tue)\nMeta partnerships team — Chris Cox — intro meeting (Wed)\nInternal strategy sync with team (Thu)`}
              value={notes.meetings}
              onChange={setNote('meetings')}
            />

            {/* ── SECTION 4: Actions Taken & Completed ── */}
            <EditableSection
              title="Actions Taken & Completed"
              icon="✅"
              placeholder={`e.g.\nSent revised Samsung proposal with updated integration scope\nFollowed up with Toyota on end-of-month decision timeline\nOnboarded Adobe contact to LIFE editorial preview deck`}
              value={notes.actions}
              onChange={setNote('actions')}
            />

            {/* ── SECTION 5: Next Week's Areas of Focus ── */}
            <EditableSection
              title="Next Week's Areas of Focus"
              icon="🎯"
              placeholder={`e.g.\nClose Samsung partnership — final sign-off\nSecond meeting with United Airlines — destination storytelling examples\nInitiate LVMH event co-branding conversation`}
              value={notes.nextFocus}
              onChange={setNote('nextFocus')}
              printLabel="Next Week's Areas of Focus"
            />

            {/* New this week (auto) */}
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

            {/* Footer */}
            <div className="text-center py-4 border-t border-brand-cream">
              <p className="text-xs text-brand-dark/30">
                Generated by {companyName} Suite · {reportDate}
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
