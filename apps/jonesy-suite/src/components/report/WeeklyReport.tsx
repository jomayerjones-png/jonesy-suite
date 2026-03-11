import { useMemo, useRef } from 'react';
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

export default function WeeklyReport({ clients, companyName }: WeeklyReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);

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

  const handlePrint = () => window.print();

  const handleCopy = async () => {
    if (!reportRef.current) return;
    const text = reportRef.current.innerText;
    await navigator.clipboard.writeText(text);
    // Brief feedback
    const btn = document.getElementById('copy-btn');
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Text'; }, 2000); }
  };

  const maxCount = Math.max(...PIPELINE_STAGES.map(s => stats.byStage[s].length), 1);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-white border-b border-brand-cream px-6 py-4 flex items-center justify-between no-print">
        <div>
          <h1 className="font-display text-xl font-semibold text-brand-dark">Weekly Client Report</h1>
          <p className="text-sm text-brand-dark/50 mt-0.5">Week of {weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button id="copy-btn" onClick={handleCopy} className="btn-secondary">
            Copy Text
          </button>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
            <span>⎙</span> Print Report
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
                  <p className="text-brand-gold/70 text-xs font-medium uppercase tracking-widest mb-1">Weekly Pipeline Report</p>
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
            {/* Gold accent bar */}
            <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold-dark" />
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'New Clients', value: stats.newThisWeek.length, icon: '✦', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
              { label: 'Contacted', value: stats.contactedThisWeek.length, icon: '◎', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
              { label: 'Stale (7d+)', value: stats.staleClients.length, icon: '⚠', color: stats.staleClients.length > 0 ? 'text-amber-700' : 'text-emerald-600', bg: stats.staleClients.length > 0 ? 'bg-amber-50' : 'bg-emerald-50', border: stats.staleClients.length > 0 ? 'border-amber-100' : 'border-emerald-100' },
            ].map(item => (
              <div key={item.label} className={`card p-4 flex items-center gap-3 ${item.bg} border ${item.border}`}>
                <div className={`text-2xl ${item.color}`}>{item.icon}</div>
                <div>
                  <p className={`font-display text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-brand-dark/60 font-medium">{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline by stage */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">Pipeline by Stage</h2>
            <div className="space-y-3">
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

          {/* Top clients */}
          {stats.topClients.length > 0 && (
            <div className="card p-6">
              <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">Top Opportunities</h2>
              <div className="space-y-3">
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

          {/* Stale clients alert */}
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

          {/* New this week */}
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
  );
}
