import { useState, useEffect } from 'react';
import { fetchTodayProspects, updateProspectStatus } from '../../lib/supabase';
import type { DailyProspect } from '../../lib/supabase';

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
}: {
  prospect: DailyProspect;
  onAdd: (p: DailyProspect) => void;
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

  const loadProspects = () => {
    setProspectsLoading(true);
    setProspectsError(null);
    fetchTodayProspects()
      .then(data => setProspects(data.filter(p => p.status !== 'added')))
      .catch(err => setProspectsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setProspectsLoading(false));
  };

  useEffect(() => { loadProspects(); }, []);

  const handleAddToEngaged = (prospect: DailyProspect) => {
    onAddToEngaged(prospect);
    updateProspectStatus(prospect.id, 'added').catch(err =>
      console.warn('[Roadmap] Failed to update prospect status:', err)
    );
    setProspects(prev =>
      prev.map(p => p.id === prospect.id ? { ...p, status: 'added' } : p)
    );
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
          {!prospectsLoading && (
            <button onClick={loadProspects} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ↻ Refresh
            </button>
          )}
        </div>

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
        ) : prospectsError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-700 mb-1">Failed to load prospects</p>
              <p className="text-xs text-red-500 font-mono">{prospectsError}</p>
            </div>
            <button onClick={loadProspects} className="text-xs text-red-600 underline flex-shrink-0">Retry</button>
          </div>
        ) : prospects.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-400">
              No prospects for today yet — trigger the <strong>Daily Prospect Briefing</strong> workflow in GitHub Actions, then refresh.
            </p>
            <button onClick={loadProspects} className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 flex-shrink-0">
              Refresh
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {prospects.map(p => (
              <ProspectCard key={p.id} prospect={p} onAdd={handleAddToEngaged} />
            ))}
          </div>
        )}
      </div>

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
