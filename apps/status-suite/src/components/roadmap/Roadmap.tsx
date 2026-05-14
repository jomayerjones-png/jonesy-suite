import { useState } from 'react';

type Quarter = 'q2' | 'q3' | 'q4';

interface Week {
  id: string;
  label: string;
  theme: string;
  milestones: string[];
}

const Q2_WEEKS: Week[] = [
  { id: 'q2-1', label: 'W/C 12 May', theme: '', milestones: [] },
  { id: 'q2-2', label: 'W/C 19 May', theme: '', milestones: [] },
  { id: 'q2-3', label: 'W/C 26 May', theme: '', milestones: [] },
  { id: 'q2-4', label: 'W/C 2 Jun', theme: '', milestones: [] },
  { id: 'q2-5', label: 'W/C 9 Jun', theme: '', milestones: [] },
  { id: 'q2-6', label: 'W/C 16 Jun', theme: '', milestones: [] },
  { id: 'q2-7', label: 'W/C 23 Jun', theme: '', milestones: [] },
  { id: 'q2-8', label: 'W/C 30 Jun', theme: '', milestones: [] },
];

const Q3_WEEKS: Week[] = [
  { id: 'q3-1', label: 'W/C 7 Jul', theme: '', milestones: [] },
  { id: 'q3-2', label: 'W/C 14 Jul', theme: '', milestones: [] },
  { id: 'q3-3', label: 'W/C 21 Jul', theme: '', milestones: [] },
  { id: 'q3-4', label: 'W/C 28 Jul', theme: '', milestones: [] },
  { id: 'q3-5', label: 'W/C 4 Aug', theme: '', milestones: [] },
  { id: 'q3-6', label: 'W/C 11 Aug', theme: '', milestones: [] },
  { id: 'q3-7', label: 'W/C 18 Aug', theme: '', milestones: [] },
  { id: 'q3-8', label: 'W/C 25 Aug', theme: '', milestones: [] },
  { id: 'q3-9', label: 'W/C 1 Sep', theme: '', milestones: [] },
  { id: 'q3-10', label: 'W/C 8 Sep', theme: '', milestones: [] },
  { id: 'q3-11', label: 'W/C 15 Sep', theme: '', milestones: [] },
  { id: 'q3-12', label: 'W/C 22 Sep', theme: '', milestones: [] },
  { id: 'q3-13', label: 'W/C 29 Sep', theme: '', milestones: [] },
];

const Q4_WEEKS: Week[] = [
  { id: 'q4-1', label: 'W/C 6 Oct', theme: '', milestones: [] },
  { id: 'q4-2', label: 'W/C 13 Oct', theme: '', milestones: [] },
  { id: 'q4-3', label: 'W/C 20 Oct', theme: '', milestones: [] },
  { id: 'q4-4', label: 'W/C 27 Oct', theme: '', milestones: [] },
  { id: 'q4-5', label: 'W/C 3 Nov', theme: '', milestones: [] },
  { id: 'q4-6', label: 'W/C 10 Nov', theme: '', milestones: [] },
  { id: 'q4-7', label: 'W/C 17 Nov', theme: '', milestones: [] },
  { id: 'q4-8', label: 'W/C 24 Nov', theme: '', milestones: [] },
  { id: 'q4-9', label: 'W/C 1 Dec', theme: '', milestones: [] },
  { id: 'q4-10', label: 'W/C 8 Dec', theme: '', milestones: [] },
  { id: 'q4-11', label: 'W/C 15 Dec', theme: '', milestones: [] },
  { id: 'q4-12', label: 'W/C 22 Dec', theme: '', milestones: [] },
  { id: 'q4-13', label: 'W/C 29 Dec', theme: '', milestones: [] },
];

const QUARTER_DATA: Record<Quarter, { label: string; range: string; init: Week[] }> = {
  q2: { label: 'Q2', range: 'May – June 2026', init: Q2_WEEKS },
  q3: { label: 'Q3', range: 'July – September 2026', init: Q3_WEEKS },
  q4: { label: 'Q4', range: 'October – December 2026', init: Q4_WEEKS },
};

function Editable({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
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
      className={`border-b-2 border-[#E8471C] outline-none bg-transparent font-inherit w-full ${className}`}
      placeholder={placeholder}
    />
  );
  return (
    <span
      onClick={() => { setDraft(value); setOn(true); }}
      title="Click to edit"
      className={`cursor-text hover:opacity-70 transition-opacity ${className} ${!value ? 'text-gray-300 italic' : ''}`}
    >
      {value || placeholder || 'Click to edit'}
    </span>
  );
}

export default function Roadmap({ companyName: _companyName }: { companyName: string }) {
  const [quarter, setQuarter] = useState<Quarter>('q2');
  const [weekData, setWeekData] = useState<Record<Quarter, Week[]>>({
    q2: [...Q2_WEEKS],
    q3: [...Q3_WEEKS],
    q4: [...Q4_WEEKS],
  });

  const weeks = weekData[quarter];
  const qInfo = QUARTER_DATA[quarter];

  const setWLabel = (id: string, v: string) =>
    setWeekData(prev => ({ ...prev, [quarter]: prev[quarter].map(w => w.id === id ? { ...w, label: v } : w) }));
  const setWTheme = (id: string, v: string) =>
    setWeekData(prev => ({ ...prev, [quarter]: prev[quarter].map(w => w.id === id ? { ...w, theme: v } : w) }));
  const setWMs = (id: string, mi: number, v: string) =>
    setWeekData(prev => ({ ...prev, [quarter]: prev[quarter].map(w => w.id === id ? { ...w, milestones: w.milestones.map((m, i) => i === mi ? v : m) } : w) }));
  const addWM = (id: string) =>
    setWeekData(prev => ({ ...prev, [quarter]: prev[quarter].map(w => w.id === id ? { ...w, milestones: [...w.milestones, ''] } : w) }));
  const delWM = (id: string, mi: number) =>
    setWeekData(prev => ({ ...prev, [quarter]: prev[quarter].map(w => w.id === id ? { ...w, milestones: w.milestones.filter((_, i) => i !== mi) } : w) }));

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

      {/* Print-only header */}
      <div className="print-only hidden items-center justify-between mb-6 pb-4 border-b-2 border-gray-200">
        <div style={{ backgroundColor: '#E8471C', padding: '5px 12px', display: 'inline-block' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fff', fontSize: '16px', letterSpacing: '-0.5px', lineHeight: 1 }}>status_</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9pt', color: '#888' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Status · {qInfo.label} Roadmap</p>
          <p style={{ margin: 0 }}>{qInfo.range}</p>
        </div>
      </div>

      {/* Quarter tabs */}
      <div className="no-print flex items-center justify-between border-b border-gray-200 mb-8">
        <div className="flex gap-0">
          {(['q2', 'q3', 'q4'] as Quarter[]).map(q => (
            <button
              key={q}
              onClick={() => setQuarter(q)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                quarter === q
                  ? 'border-[#E8471C] text-brand-dark'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {QUARTER_DATA[q].label}
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
          Status · {qInfo.label} Roadmap
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-dark">
          {qInfo.range}
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Week-by-week activity plan. Click any field to edit.
        </p>
      </div>

      {/* Weeks */}
      <div className="flex flex-col gap-0.5">
        {weeks.map(week => (
          <div key={week.id}>
            <div className="flex items-stretch bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Left: week label */}
              <div className="w-[148px] flex-shrink-0 px-4 py-3.5 border-r border-gray-200 flex flex-col justify-center gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E8471C] flex-shrink-0" />
                  <Editable value={week.label} onChange={v => setWLabel(week.id, v)} className="text-xs font-bold text-brand-dark" />
                </div>
                <Editable
                  value={week.theme}
                  onChange={v => setWTheme(week.id, v)}
                  placeholder="Theme"
                  className="text-[10px] text-gray-400 tracking-wide pl-4"
                />
              </div>
              {/* Right: milestones */}
              <div className="flex-1 px-4 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                {week.milestones.length === 0 && (
                  <span className="text-xs text-gray-300 italic">No milestones yet</span>
                )}
                {week.milestones.map((m, mi) => (
                  <div key={mi} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                    <Editable value={m} onChange={v => setWMs(week.id, mi, v)} placeholder="New milestone" className="text-sm text-brand-dark" />
                    <span
                      onClick={() => delWM(week.id, mi)}
                      className="no-print text-gray-200 hover:text-[#E8471C] cursor-pointer text-[10px] select-none transition-colors"
                    >
                      ✕
                    </span>
                  </div>
                ))}
                <span
                  onClick={() => addWM(week.id)}
                  className="no-print text-[11px] text-gray-300 hover:text-[#E8471C] cursor-pointer select-none transition-colors"
                >
                  + add
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-7 px-3.5 py-2.5 bg-white border border-gray-200 rounded-md text-xs text-gray-400">
        All fields are editable. Click any week label, theme, or milestone to update. Use "Download PDF" to export.
      </div>
    </div>
  );
}
