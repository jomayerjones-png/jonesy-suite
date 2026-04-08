import { useState } from 'react';

interface Deliverable {
  id: string;
  text: string;
  done: boolean;
}

interface Phase {
  month: number;
  title: string;
  fee: number;
  deliverables: Deliverable[];
}

const INITIAL_PHASES: Phase[] = [
  {
    month: 1,
    title: 'Setup & Creative Development',
    fee: 10000,
    deliverables: [
      { id: '1a', text: 'Audit of current commercial opportunities', done: false },
      { id: '1b', text: 'Concepting and idea development', done: false },
      { id: '1c', text: 'Delivery of net-new Status commercial products', done: false },
      { id: '1d', text: 'Sales scripting and pitch deck development', done: false },
      { id: '1e', text: 'Development of overall sales approach', done: false },
      { id: '1f', text: 'Support guest list development and hosting for WHCD', done: false },
    ],
  },
  {
    month: 2,
    title: 'Sales Sprint & Activation',
    fee: 10000,
    deliverables: [
      { id: '2a', text: 'Ongoing targeted pipeline development', done: false },
      { id: '2b', text: 'Collaboration with Stacy on GTM messaging', done: false },
      { id: '2c', text: 'Creative brief development informed by partner conversations', done: false },
      { id: '2d', text: 'Bespoke ideas tailored to individual partners', done: false },
    ],
  },
  {
    month: 3,
    title: 'Scale & Optimise',
    fee: 10000,
    deliverables: [
      { id: '3a', text: 'Continued pipeline development and partner outreach', done: false },
      { id: '3b', text: 'Replication and refinement of Month 2 approach', done: false },
      { id: '3c', text: 'Performance review and revised strategy based on pipeline results', done: false },
    ],
  },
];

const STORAGE_KEY = 'status_suite_engagement';

export default function EngagementTracker() {
  const [phases, setPhases] = useState<Phase[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as Phase[];
    } catch { /* fall through */ }
    return INITIAL_PHASES;
  });

  const save = (updated: Phase[]) => {
    setPhases(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const toggleDeliverable = (monthIdx: number, delId: string) => {
    const updated = phases.map((p, i) =>
      i === monthIdx
        ? { ...p, deliverables: p.deliverables.map(d => d.id === delId ? { ...d, done: !d.done } : d) }
        : p
    );
    save(updated);
  };

  const totalDeliverables = phases.reduce((s, p) => s + p.deliverables.length, 0);
  const doneDeliverables = phases.reduce((s, p) => s + p.deliverables.filter(d => d.done).length, 0);
  const overallProgress = totalDeliverables > 0 ? Math.round((doneDeliverables / totalDeliverables) * 100) : 0;

  const contractStart = new Date('2026-04-06');
  const contractEnd = new Date('2026-07-03');
  const now = new Date();
  const totalDays = (contractEnd.getTime() - contractStart.getTime()) / (1000 * 60 * 60 * 24);
  const elapsed = Math.max(0, Math.min(totalDays, (now.getTime() - contractStart.getTime()) / (1000 * 60 * 60 * 24)));
  const timeProgress = Math.round((elapsed / totalDays) * 100);

  const currentMonth = elapsed <= 30 ? 1 : elapsed <= 60 ? 2 : 3;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Contract terms bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold text-brand-dark">Engagement Overview</h2>
          <span className="text-xs font-medium text-brand-dark/50">COMMERCIAL ENGAGEMENT — STATUS</span>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-brand-light rounded-lg p-3 text-center">
            <p className="text-xs text-brand-dark/50 font-medium uppercase tracking-wider">Duration</p>
            <p className="font-display text-lg font-bold text-brand-dark">3 Months</p>
            <p className="text-xs text-brand-dark/40">Apr 6 — Jul 3</p>
          </div>
          <div className="bg-brand-light rounded-lg p-3 text-center">
            <p className="text-xs text-brand-dark/50 font-medium uppercase tracking-wider">Retainer</p>
            <p className="font-display text-lg font-bold text-brand-dark">$30,000</p>
            <p className="text-xs text-brand-dark/40">$10K / month</p>
          </div>
          <div className="bg-brand-light rounded-lg p-3 text-center">
            <p className="text-xs text-brand-dark/50 font-medium uppercase tracking-wider">Commission</p>
            <p className="font-display text-lg font-bold text-brand-gold">7.5%</p>
            <p className="text-xs text-brand-dark/40">On all sales generated</p>
          </div>
          <div className="bg-brand-light rounded-lg p-3 text-center">
            <p className="text-xs text-brand-dark/50 font-medium uppercase tracking-wider">Current Phase</p>
            <p className="font-display text-lg font-bold text-brand-dark">Month {currentMonth}</p>
            <p className="text-xs text-brand-dark/40">{phases[currentMonth - 1]?.title}</p>
          </div>
        </div>

        {/* Timeline progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-brand-dark/50">
            <span>Contract Timeline</span>
            <span>{timeProgress}% elapsed</span>
          </div>
          <div className="w-full bg-brand-cream rounded-full h-2">
            <div className="bg-brand-gold h-2 rounded-full transition-all duration-500" style={{ width: `${timeProgress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-brand-dark/40">
            <span>Apr 6</span>
            <span>May 6</span>
            <span>Jun 6</span>
            <span>Jul 3</span>
          </div>
        </div>
      </div>

      {/* Overall deliverables progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-brand-dark">Deliverables Progress</span>
          <span className="text-sm font-bold text-brand-gold">{doneDeliverables}/{totalDeliverables} complete</span>
        </div>
        <div className="w-full bg-brand-cream rounded-full h-3">
          <div
            className="bg-brand-gold h-3 rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Phase cards */}
      {phases.map((phase, pi) => {
        const phaseDone = phase.deliverables.filter(d => d.done).length;
        const phaseTotal = phase.deliverables.length;
        const phaseProgress = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;
        const isCurrent = pi + 1 === currentMonth;

        return (
          <div key={pi} className={`card overflow-hidden ${isCurrent ? 'ring-2 ring-brand-gold' : ''}`}>
            {/* Phase header */}
            <div className={`px-5 py-4 flex items-center justify-between ${isCurrent ? 'bg-brand-gold' : 'bg-brand-dark'}`}>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${isCurrent ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'}`}>
                  Month {phase.month}
                </span>
                <h3 className="font-display text-lg font-bold text-white">{phase.title}</h3>
              </div>
              <span className="font-display text-xl font-bold text-white">${phase.fee.toLocaleString()}</span>
            </div>

            {/* Deliverables */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-brand-dark/50 font-medium">{phaseDone}/{phaseTotal} deliverables</span>
                <span className="text-xs font-semibold text-brand-gold">{phaseProgress}%</span>
              </div>
              <div className="w-full bg-brand-cream rounded-full h-1.5 mb-3">
                <div className="bg-brand-gold h-1.5 rounded-full transition-all" style={{ width: `${phaseProgress}%` }} />
              </div>
              {phase.deliverables.map(d => (
                <label key={d.id} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={d.done}
                    onChange={() => toggleDeliverable(pi, d.id)}
                    className="mt-0.5 w-4 h-4 rounded border-brand-cream-dark text-brand-gold focus:ring-brand-gold/40 cursor-pointer"
                  />
                  <span className={`text-sm leading-relaxed ${d.done ? 'line-through text-brand-dark/40' : 'text-brand-dark/80 group-hover:text-brand-dark'}`}>
                    {d.text}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {/* Commercial Terms */}
      <div className="card p-5">
        <h3 className="font-display text-base font-bold text-brand-dark mb-4 uppercase tracking-wider">Commercial Terms</h3>
        <div className="divide-y divide-brand-cream">
          {[
            ['Commission', '7.5% on all sales directly generated through our outreach efforts and alt sales resources on sales brought in with above products for 6 months from the beginning of this agreement'],
            ['T&E', 'The monthly retainer fee does not include any travel or expenses incurred. Any T&E costs will be invoiced separately and require prior approval.'],
            ['First Refusal', 'Right of first refusal on content and event production tied to the ideas developed above'],
            ['Renewal', 'This agreement is from April 6th — July 3rd'],
            ['Payment Terms', 'Monthly retainer of $10,000 USD. Payment schedule to be agreed upon contract execution'],
          ].map(([label, desc]) => (
            <div key={label} className="flex gap-4 py-3">
              <span className="text-sm font-semibold text-brand-dark w-32 flex-shrink-0">{label}</span>
              <span className="text-sm text-brand-dark/70">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
