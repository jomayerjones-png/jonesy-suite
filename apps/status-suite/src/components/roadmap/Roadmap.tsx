import { useState } from 'react';

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

const GROUPS: Record<number, { label: string }> = {
  1: { label: 'March — Foundations' },
  3: { label: 'April — Proposals & Pipeline' },
  6: { label: 'Dinner, 23 April' },
  7: { label: 'May — Deals Close · Production Sprint Begins' },
  11: { label: 'June — Launch Prep' },
};

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

// ── Main ─────────────────────────────────────────────────────────
type RoadmapView = 'roadmap' | 'close';

export default function Roadmap({ companyName: _companyName }: { companyName: string }) {
  const [weeks, setWeeks] = useState(WEEKS_INIT);
  const [closers, setClosers] = useState(CLOSERS_INIT);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [subView, setSubView] = useState<RoadmapView>('roadmap');

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
        <div style={{ backgroundColor: '#FFE500', padding: '5px 12px', display: 'inline-block' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: '#0A0A0A', fontSize: '22px', letterSpacing: '-1px', lineHeight: 1 }}>STATUS</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9pt', color: '#888' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Strategic Roadmap · March – June 2026</p>
          <p style={{ margin: 0 }}>{subView === 'roadmap' ? 'Week by Week' : 'Close by 1 May'}</p>
        </div>
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
                  ? 'border-[#FFE500] text-brand-dark'
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
            Deals closed by 1 May · Magazine launch 22 June
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
            {weeks.map((week, i) => {
              const group = GROUPS[week.id];
              const isDinner = week.phase === 'dinner';
              const dotClass = PHASE_DOT[week.phase];
              return (
                <div key={week.id}>
                  {group && (
                    <div className={`text-[10px] font-bold tracking-[0.15em] uppercase ${isDinner ? 'text-brand-gold' : 'text-gray-400'} ${i === 0 ? '' : 'mt-6'} mb-2`}>
                      {group.label}
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
              <div className="text-xl font-bold text-white tracking-tight">22 June 2026 — Magazine goes to print, Issue 1</div>
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
