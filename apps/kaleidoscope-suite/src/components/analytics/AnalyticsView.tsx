import { useMemo } from 'react';
import {
  Client,
  PIPELINE_STAGES,
  PipelineStage,
  STAGE_CONFIG,
  formatCurrency,
} from '../../types';

interface AnalyticsViewProps {
  clients: Client[];
  companyName: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function fmt(n: number | null, suffix = '', decimals = 0): string {
  if (n === null) return '—';
  return n.toFixed(decimals) + suffix;
}

function daysInPipeline(client: Client): number | null {
  const history = client.stageHistory ?? [];
  if (history.length < 2) return null;
  const ms = new Date(history[history.length - 1].date).getTime() - new Date(history[0].date).getTime();
  return Math.round(ms / 86400000);
}

function daysInStage(client: Client, stage: PipelineStage): number | null {
  const history = client.stageHistory ?? [];
  // find last occurrence of this stage
  let idx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].stage === stage) { idx = i; break; }
  }
  if (idx === -1 || idx === history.length - 1) return null;
  const ms = new Date(history[idx + 1].date).getTime() - new Date(history[idx].date).getTime();
  return Math.round(ms / 86400000);
}

// ── sub-components ────────────────────────────────────────────────────────────
function KPICard({
  label, value, sub, accent = false,
}: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="metric-card">
      <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">{label}</p>
      <p className={`font-display text-2xl font-bold ${accent ? 'text-brand-gold' : 'text-brand-dark'}`}>{value}</p>
      {sub && <p className="text-xs text-brand-dark/40">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg font-semibold text-brand-dark">{title}</h2>
      {subtitle && <p className="text-xs text-brand-dark/50 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function AnalyticsView({ clients, companyName }: AnalyticsViewProps) {
  const data = useMemo(() => {
    const won = clients.filter(c => c.outcome === 'won');
    const lost = clients.filter(c => c.outcome === 'lost');
    const active = clients.filter(c => c.outcome === 'active');
    const decided = won.length + lost.length;

    const winRate = decided > 0 ? (won.length / decided) * 100 : null;
    const avgWonDeal = avg(won.map(c => c.value));
    const avgCloseDays = avg(won.map(daysInPipeline).filter((n): n is number => n !== null));
    const wonRevenue = won.reduce((s, c) => s + c.value, 0);
    const lostRevenue = lost.reduce((s, c) => s + c.value, 0);
    const activePipelineValue = active.reduce((s, c) => s + c.value, 0);

    // Funnel snapshot (active + won in stage)
    const funnelCounts: Record<PipelineStage, { count: number; value: number }> = {
      Prospect: { count: 0, value: 0 },
      Engaged: { count: 0, value: 0 },
      'Meeting Set': { count: 0, value: 0 },
      'Proposal Sent': { count: 0, value: 0 },
      Feedback: { count: 0, value: 0 },
      'Revised Proposal Sent': { count: 0, value: 0 },
      Close: { count: 0, value: 0 },
    };
    clients.filter(c => c.outcome !== 'lost').forEach(c => {
      funnelCounts[c.stage].count++;
      funnelCounts[c.stage].value += c.value;
    });
    const maxFunnelCount = Math.max(...Object.values(funnelCounts).map(v => v.count), 1);

    // Stage velocity (avg days in each stage across all clients with history)
    const stageVelocity: Record<PipelineStage, number[]> = {
      Prospect: [], Engaged: [], 'Meeting Set': [], 'Proposal Sent': [], Feedback: [], 'Revised Proposal Sent': [], Close: [],
    };
    clients.forEach(c => {
      PIPELINE_STAGES.forEach(stage => {
        const d = daysInStage(c, stage);
        if (d !== null) stageVelocity[stage].push(d);
      });
    });

    // Category performance (by industry if set, else by first meaningful tag)
    const catMap = new Map<string, { clients: Client[] }>();
    clients.forEach(c => {
      const cat = c.industry?.trim() ||
        c.tags.find(t => !t.startsWith('tier-')) ||
        c.tags[0] ||
        'Uncategorised';
      if (!catMap.has(cat)) catMap.set(cat, { clients: [] });
      catMap.get(cat)!.clients.push(c);
    });
    const categories = [...catMap.entries()]
      .map(([name, { clients: cc }]) => {
        const w = cc.filter(c => c.outcome === 'won');
        const l = cc.filter(c => c.outcome === 'lost');
        const d = w.length + l.length;
        return {
          name,
          total: cc.length,
          value: cc.reduce((s, c) => s + c.value, 0),
          won: w.length,
          lost: l.length,
          winRate: d > 0 ? (w.length / d) * 100 : null,
          avgDeal: avg(cc.map(c => c.value)),
          hasProposals: cc.filter(c => (c.proposals?.length ?? 0) > 0).length,
        };
      })
      .sort((a, b) => b.value - a.value);

    // Proposal impact
    const withProposal = clients.filter(c => (c.proposals?.length ?? 0) > 0);
    const withoutProposal = clients.filter(c => (c.proposals?.length ?? 0) === 0);
    const proposalWinRate = (arr: Client[]) => {
      const w = arr.filter(c => c.outcome === 'won').length;
      const d = w + arr.filter(c => c.outcome === 'lost').length;
      return d > 0 ? (w / d) * 100 : null;
    };

    // Loss reasons
    const reasons = lost
      .map(c => c.lostReason?.trim())
      .filter(Boolean) as string[];
    const reasonCounts = reasons.reduce<Record<string, number>>((acc, r) => {
      acc[r] = (acc[r] ?? 0) + 1; return acc;
    }, {});
    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      won, lost, active, decided,
      winRate, avgWonDeal, avgCloseDays, wonRevenue, lostRevenue, activePipelineValue,
      funnelCounts, maxFunnelCount,
      stageVelocity,
      categories,
      withProposal, withoutProposal, proposalWinRate,
      topReasons,
    };
  }, [clients]);

  const hasVelocityData = PIPELINE_STAGES.some(s => data.stageVelocity[s].length > 0);
  const hasOutcomeData = data.decided > 0;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { background: white !important; font-size: 10pt; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; break-inside: avoid; }
          .metric-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          h1, h2 { page-break-after: avoid; }
          print-color-adjust: exact; -webkit-print-color-adjust: exact;
        }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b border-brand-cream px-6 py-4 flex-shrink-0 flex items-center justify-between no-print">
        <div>
          <h1 className="font-display text-xl font-semibold text-brand-dark">Performance Analytics</h1>
          <p className="text-sm text-brand-dark/50 mt-0.5">
            {companyName} · {clients.length} total deals tracked
            {!hasOutcomeData && (
              <span className="ml-2 text-brand-gold/80">· Data builds as deals are won or lost</span>
            )}
          </p>
        </div>
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <span>⎙</span> Download PDF
        </button>
      </div>

      {/* Print-only header */}
      <div className="print-only hidden" style={{ padding: '0 0 24px 0', borderBottom: '2px solid #e5e7eb', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ backgroundColor: '#7C3AED', padding: '6px 14px' }}>
            <span style={{ fontFamily: 'sans-serif', fontWeight: 700, color: '#fff', fontSize: '16px', letterSpacing: '2px', lineHeight: 1 }}>KALEIDOSCOPE</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '9pt', color: '#666' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Performance Analytics</p>
            <p style={{ margin: 0 }}>{clients.length} deals · {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ── KPI Row ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Win Rate"
              value={fmt(data.winRate, '%', 0)}
              sub={data.decided > 0 ? `${data.won.length}W / ${data.lost.length}L from ${data.decided} decided` : 'No closed deals yet'}
              accent
            />
            <KPICard
              label="Avg Deal Won"
              value={data.avgWonDeal !== null ? formatCurrency(data.avgWonDeal) : '—'}
              sub={data.won.length > 0 ? `Across ${data.won.length} won deal${data.won.length > 1 ? 's' : ''}` : 'No won deals yet'}
            />
            <KPICard
              label="Avg Days to Close"
              value={fmt(data.avgCloseDays, ' days', 0)}
              sub={data.avgCloseDays !== null ? 'From first contact to close' : 'Needs stage history data'}
            />
            <KPICard
              label="Won Revenue"
              value={formatCurrency(data.wonRevenue)}
              sub={`${formatCurrency(data.activePipelineValue)} active · ${formatCurrency(data.lostRevenue)} lost`}
            />
          </div>

          {/* ── Pipeline Funnel ──────────────────────────────────────────────── */}
          <div className="card p-6">
            <SectionHeader title="Pipeline Funnel" subtitle="Active deals and value at each stage" />
            <div className="space-y-3">
              {PIPELINE_STAGES.map((stage, i) => {
                const { count, value } = data.funnelCounts[stage];
                const cfg = STAGE_CONFIG[stage];
                const barPct = Math.max((count / data.maxFunnelCount) * 100, count > 0 ? 4 : 0);
                const prevCount = i > 0 ? data.funnelCounts[PIPELINE_STAGES[i - 1]].count : null;
                const conversion = prevCount !== null && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;
                return (
                  <div key={stage} className="flex items-center gap-4">
                    <div className="w-32 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <span className="text-sm font-medium text-brand-dark">{stage}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="h-7 bg-brand-light rounded-full overflow-hidden">
                        <div
                          className={`h-full ${cfg.dot} rounded-full transition-all duration-500 flex items-center justify-end pr-3`}
                          style={{ width: `${barPct}%` }}
                        >
                          {count > 0 && <span className="text-white text-xs font-bold">{count}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="w-24 text-right flex-shrink-0">
                      <span className="text-sm font-semibold text-brand-gold">{count > 0 ? formatCurrency(value) : '—'}</span>
                    </div>
                    <div className="w-14 text-right flex-shrink-0">
                      {conversion !== null ? (
                        <span className={`text-xs font-medium ${conversion >= 50 ? 'text-emerald-600' : conversion >= 25 ? 'text-amber-600' : 'text-red-500'}`}>
                          ↓ {conversion}%
                        </span>
                      ) : (
                        <span className="text-xs text-brand-dark/20">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Category Performance + Deal Velocity ────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Category table */}
            <div className="card p-6 lg:col-span-3">
              <SectionHeader
                title="Category Performance"
                subtitle="Grouped by industry or primary tag"
              />
              {data.categories.length === 0 ? (
                <p className="text-sm text-brand-dark/40">No deals to analyse yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-cream">
                        <th className="text-left text-xs text-brand-dark/50 uppercase tracking-wider pb-2 font-semibold">Category</th>
                        <th className="text-right text-xs text-brand-dark/50 uppercase tracking-wider pb-2 font-semibold">Deals</th>
                        <th className="text-right text-xs text-brand-dark/50 uppercase tracking-wider pb-2 font-semibold">Value</th>
                        <th className="text-right text-xs text-brand-dark/50 uppercase tracking-wider pb-2 font-semibold">Win Rate</th>
                        <th className="text-right text-xs text-brand-dark/50 uppercase tracking-wider pb-2 font-semibold">Avg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-cream">
                      {data.categories.map(cat => (
                        <tr key={cat.name} className="group">
                          <td className="py-2.5 pr-4">
                            <span className="font-medium text-brand-dark capitalize">{cat.name}</span>
                            {(cat.won > 0 || cat.lost > 0) && (
                              <span className="ml-2 text-xs text-brand-dark/40">
                                {cat.won}W {cat.lost}L
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right text-brand-dark/70">{cat.total}</td>
                          <td className="py-2.5 text-right font-semibold text-brand-gold">{formatCurrency(cat.value)}</td>
                          <td className="py-2.5 text-right">
                            {cat.winRate !== null ? (
                              <span className={`font-semibold ${cat.winRate >= 50 ? 'text-emerald-600' : cat.winRate >= 25 ? 'text-amber-600' : 'text-red-500'}`}>
                                {cat.winRate.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-brand-dark/30">—</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right text-brand-dark/60">{cat.avgDeal !== null ? formatCurrency(cat.avgDeal) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Deal velocity */}
            <div className="card p-6 lg:col-span-2">
              <SectionHeader
                title="Stage Velocity"
                subtitle={hasVelocityData ? 'Avg days spent in each stage' : 'Builds as deals move through stages'}
              />
              <div className="space-y-3">
                {PIPELINE_STAGES.map(stage => {
                  const days = data.stageVelocity[stage];
                  const avgDays = avg(days);
                  const cfg = STAGE_CONFIG[stage];
                  return (
                    <div key={stage} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className="text-sm text-brand-dark flex-1 min-w-0 truncate">{stage}</span>
                      {avgDays !== null ? (
                        <div className="text-right flex-shrink-0">
                          <span className="font-semibold text-sm text-brand-dark">{avgDays.toFixed(0)}d</span>
                          <span className="text-xs text-brand-dark/40 ml-1">avg ({days.length})</span>
                        </div>
                      ) : (
                        <span className="text-xs text-brand-dark/30">No data yet</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {hasVelocityData && data.avgCloseDays !== null && (
                <div className="mt-4 pt-3 border-t border-brand-cream flex items-center justify-between">
                  <span className="text-xs text-brand-dark/60 font-medium">Total avg cycle</span>
                  <span className="font-display text-lg font-bold text-brand-gold">{data.avgCloseDays.toFixed(0)}d</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Proposal Impact + Outcome Split ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Proposal impact */}
            <div className="card p-6">
              <SectionHeader title="Proposal Impact" subtitle="Win rate with vs without proposals attached" />
              <div className="space-y-4">
                {[
                  {
                    label: 'With Proposal',
                    clients: data.withProposal,
                    rate: data.proposalWinRate(data.withProposal),
                    color: 'bg-brand-gold',
                    textColor: 'text-brand-gold',
                  },
                  {
                    label: 'Without Proposal',
                    clients: data.withoutProposal,
                    rate: data.proposalWinRate(data.withoutProposal),
                    color: 'bg-brand-dark/20',
                    textColor: 'text-brand-dark/60',
                  },
                ].map(row => {
                  const decided = row.clients.filter(c => c.outcome !== 'active').length;
                  return (
                    <div key={row.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-brand-dark">{row.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-brand-dark/50">{row.clients.length} deals · {decided} decided</span>
                          <span className={`font-bold text-sm ${row.textColor}`}>
                            {row.rate !== null ? `${row.rate.toFixed(0)}%` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="h-3 bg-brand-light rounded-full overflow-hidden">
                        <div
                          className={`h-full ${row.color} rounded-full transition-all duration-500`}
                          style={{ width: `${row.rate ?? 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-brand-cream">
                <p className="text-xs text-brand-dark/40 leading-relaxed">
                  Attach proposals to client records via the Pipeline or Proposal AI tab to track correlation with close rate.
                </p>
              </div>
            </div>

            {/* Outcome split + loss reasons */}
            <div className="card p-6">
              <SectionHeader title="Deal Outcomes" subtitle="Win / Active / Lost breakdown" />

              {/* Visual split */}
              <div className="flex gap-3 mb-5">
                {[
                  { label: 'Active', count: data.active.length, value: data.activePipelineValue, color: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Won', count: data.won.length, value: data.wonRevenue, color: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Lost', count: data.lost.length, value: data.lostRevenue, color: 'bg-red-400', text: 'text-red-600', bg: 'bg-red-50' },
                ].map(item => (
                  <div key={item.label} className={`flex-1 rounded-xl p-4 ${item.bg} border border-transparent`}>
                    <p className={`font-display text-2xl font-bold ${item.text}`}>{item.count}</p>
                    <p className="text-xs font-medium text-brand-dark/60 mt-0.5">{item.label}</p>
                    <p className={`text-xs font-semibold ${item.text} mt-1`}>{formatCurrency(item.value)}</p>
                  </div>
                ))}
              </div>

              {/* Loss reasons */}
              {data.topReasons.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider mb-2">Top Loss Reasons</p>
                  <div className="space-y-1.5">
                    {data.topReasons.map(([reason, count]) => (
                      <div key={reason} className="flex items-center gap-2">
                        <span className="text-xs text-brand-dark/70 flex-1 truncate">{reason}</span>
                        <span className="text-xs font-semibold text-red-500 flex-shrink-0">{count}×</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : data.lost.length > 0 ? (
                <p className="text-xs text-brand-dark/40 italic">
                  Add loss reasons when marking deals as lost to see patterns here.
                </p>
              ) : (
                <p className="text-xs text-brand-dark/40">
                  Mark deals as lost from the client record to track reasons and trends.
                </p>
              )}
            </div>
          </div>

          {/* ── Pitching Activity ────────────────────────────────────────────── */}
          <div className="card p-6">
            <SectionHeader
              title="What's Being Pitched"
              subtitle="Deals with proposals attached, by stage and outcome"
            />
            {data.withProposal.length === 0 ? (
              <p className="text-sm text-brand-dark/40">No proposals have been attached to deals yet. Generate a proposal and save it to a client record to track pitch activity.</p>
            ) : (
              <div className="space-y-2">
                {data.withProposal
                  .sort((a, b) => b.value - a.value)
                  .map(c => {
                    const cfg = STAGE_CONFIG[c.stage];
                    const outcomeColor = c.outcome === 'won' ? 'text-emerald-600' : c.outcome === 'lost' ? 'text-red-500' : 'text-brand-dark/50';
                    const outcomeBg = c.outcome === 'won' ? 'bg-emerald-50 border-emerald-100' : c.outcome === 'lost' ? 'bg-red-50 border-red-100' : 'bg-brand-light border-brand-cream';
                    return (
                      <div key={c.id} className={`flex items-center gap-4 p-3 rounded-lg border ${outcomeBg}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-brand-dark truncate">{c.name}</p>
                            <span className="text-xs text-brand-dark/50 truncate">{c.company}</span>
                          </div>
                          {c.industry && <p className="text-xs text-brand-dark/40 mt-0.5">{c.industry}</p>}
                        </div>
                        <span className={`stage-badge ${cfg.bg} ${cfg.color} ${cfg.border} border flex-shrink-0`}>
                          {cfg.icon} {c.stage}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                          <span className="text-brand-gold/70 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-2 py-0.5">
                            ◈ {c.proposals.length}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-brand-gold text-sm">{formatCurrency(c.value)}</p>
                          <p className={`text-xs font-medium capitalize ${outcomeColor}`}>{c.outcome}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
