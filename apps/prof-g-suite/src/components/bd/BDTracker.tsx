import { useState, useEffect, useMemo } from 'react';

type BDStatus = 'Contact' | 'Engaged' | 'Proposal Sent' | 'Closed' | 'Need Contact';
type Tier = 'Tier 0' | 'Tier 1' | 'Tier 2' | 'Tier 3';

interface BDLead {
  id: string;
  teamLead: string;
  status: BDStatus;
  nextStep: string;
  partner: string;
  sector: string;
  keyContact: string;
  tier: Tier;
  editorialConcept: string;
  estValue: number;
  source: string;
  introMade: boolean;
  movedToSuite: boolean;
  notes: string;
}

const STATUS_OPTIONS: BDStatus[] = ['Contact', 'Engaged', 'Proposal Sent', 'Closed', 'Need Contact'];
const TIER_OPTIONS: Tier[] = ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3'];

const STATUS_COLORS: Record<BDStatus, { bg: string; text: string; dot: string }> = {
  'Contact': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Engaged': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'Proposal Sent': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Closed': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Need Contact': { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
};

const TIER_COLORS: Record<Tier, string> = {
  'Tier 0': 'bg-brand-gold text-white',
  'Tier 1': 'bg-brand-dark text-white',
  'Tier 2': 'bg-brand-cream-dark text-brand-dark',
  'Tier 3': 'bg-brand-cream text-brand-dark/60',
};

const SECTORS = ['All', 'Travel', 'Tech', 'Retail', 'Luxury', 'Healthcare', 'Financial Services', 'Entertainment / Streaming', 'Beauty', 'Automotive', 'Consumer Tech', 'Beauty + Fashion'];

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

interface BDTrackerProps {
  storageKey: string;
  suiteName: string;
}

export default function BDTracker({ storageKey, suiteName }: BDTrackerProps) {
  const [leads, setLeads] = useState<BDLead[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored) as BDLead[];
    } catch { /* fall through */ }
    return [];
  });

  const [filterStatus, setFilterStatus] = useState<BDStatus | 'All'>('All');
  const [filterTier, setFilterTier] = useState<Tier | 'All'>('All');
  const [filterSector, setFilterSector] = useState('All');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'partner' | 'tier' | 'status' | 'sector'>('partner');

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(leads));
  }, [leads, storageKey]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (filterStatus !== 'All') result = result.filter(l => l.status === filterStatus);
    if (filterTier !== 'All') result = result.filter(l => l.tier === filterTier);
    if (filterSector !== 'All') result = result.filter(l => l.sector === filterSector);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.partner.toLowerCase().includes(q) ||
        l.keyContact.toLowerCase().includes(q) ||
        l.teamLead.toLowerCase().includes(q) ||
        l.notes.toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      if (sortBy === 'tier') {
        const tierOrder = { 'Tier 0': 0, 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
        return tierOrder[a.tier] - tierOrder[b.tier];
      }
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      if (sortBy === 'sector') return a.sector.localeCompare(b.sector);
      return a.partner.localeCompare(b.partner);
    });
    return result;
  }, [leads, filterStatus, filterTier, filterSector, search, sortBy]);

  const stats = useMemo(() => {
    const total = leads.length;
    const engaged = leads.filter(l => l.status === 'Engaged').length;
    const proposalSent = leads.filter(l => l.status === 'Proposal Sent').length;
    const closed = leads.filter(l => l.status === 'Closed').length;
    const tier0 = leads.filter(l => l.tier === 'Tier 0').length;
    const totalValue = leads.reduce((s, l) => s + l.estValue, 0);
    return { total, engaged, proposalSent, closed, tier0, totalValue };
  }, [leads]);

  const addLead = (lead: Omit<BDLead, 'id'>) => {
    setLeads(prev => [{ ...lead, id: generateId() }, ...prev]);
    setShowAdd(false);
  };

  const updateLead = (id: string, updates: Partial<BDLead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const deleteLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    if (editingId === id) setEditingId(null);
  };

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-dark">Business Development</h1>
          <p className="text-sm text-brand-dark/50 mt-1">{suiteName} — Partner Pipeline Brainstorming</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Partner</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Total Partners', value: stats.total, color: 'text-brand-dark' },
          { label: 'Engaged', value: stats.engaged, color: 'text-amber-600' },
          { label: 'Proposals Sent', value: stats.proposalSent, color: 'text-purple-600' },
          { label: 'Closed', value: stats.closed, color: 'text-emerald-600' },
          { label: 'Tier 0', value: stats.tier0, color: 'text-brand-gold' },
          { label: 'Pipeline Value', value: stats.totalValue >= 1000000 ? `$${(stats.totalValue / 1000000).toFixed(1)}M` : stats.totalValue >= 1000 ? `$${(stats.totalValue / 1000).toFixed(0)}K` : `$${stats.totalValue}`, color: 'text-brand-dark' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <p className="text-xs text-brand-dark/50 font-medium uppercase tracking-wider">{s.label}</p>
            <p className={`font-display text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-3 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search partners, contacts, notes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field max-w-xs"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as BDStatus | 'All')} className="input-field w-auto">
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterTier} onChange={e => setFilterTier(e.target.value as Tier | 'All')} className="input-field w-auto">
          <option value="All">All Tiers</option>
          {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterSector} onChange={e => setFilterSector(e.target.value)} className="input-field w-auto">
          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="input-field w-auto">
          <option value="partner">Sort: Partner A-Z</option>
          <option value="tier">Sort: Tier</option>
          <option value="status">Sort: Status</option>
          <option value="sector">Sort: Sector</option>
        </select>
        <span className="text-xs text-brand-dark/40 ml-auto">{filteredLeads.length} results</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-dark text-white text-left">
                <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wider">Lead</th>
                <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wider">Partner</th>
                <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wider">Sector</th>
                <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wider">Key Contact</th>
                <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wider">Tier</th>
                <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wider">Next Step</th>
                <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wider">Est. Value</th>
                <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wider">Notes</th>
                <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wider w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream">
              {filteredLeads.map(lead => (
                <tr key={lead.id} className="hover:bg-brand-light/50 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-brand-dark whitespace-nowrap">{lead.teamLead || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[lead.status].bg} ${STATUS_COLORS[lead.status].text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[lead.status].dot}`} />
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-brand-dark">{lead.partner}</td>
                  <td className="px-3 py-2.5 text-brand-dark/60">{lead.sector || '—'}</td>
                  <td className="px-3 py-2.5 text-brand-dark/70 max-w-[200px] truncate">{lead.keyContact || '—'}</td>
                  <td className="px-3 py-2.5">
                    {lead.tier && (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${TIER_COLORS[lead.tier]}`}>
                        {lead.tier}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-brand-dark/60 max-w-[180px] truncate">{lead.nextStep || '—'}</td>
                  <td className="px-3 py-2.5 font-medium text-brand-dark">
                    {lead.estValue > 0 ? `$${lead.estValue.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-brand-dark/50 max-w-[200px] truncate">{lead.notes || '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => setEditingId(lead.id)} className="text-brand-dark/30 hover:text-brand-dark text-xs">Edit</button>
                      <button onClick={() => deleteLead(lead.id)} className="text-red-300 hover:text-red-600 text-xs">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-brand-dark/40">
                    {leads.length === 0 ? 'No partners added yet. Click "+ Add Partner" to get started.' : 'No results match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(showAdd || editingId) && (
        <LeadModal
          lead={editingId ? leads.find(l => l.id === editingId) : undefined}
          onSave={(data) => {
            if (editingId) {
              updateLead(editingId, data);
              setEditingId(null);
            } else {
              addLead(data as Omit<BDLead, 'id'>);
            }
          }}
          onClose={() => { setShowAdd(false); setEditingId(null); }}
        />
      )}
    </div>
  );
}

function LeadModal({
  lead,
  onSave,
  onClose,
}: {
  lead?: BDLead;
  onSave: (data: Omit<BDLead, 'id'>) => void;
  onClose: () => void;
}) {
  const [teamLead, setTeamLead] = useState(lead?.teamLead ?? '');
  const [status, setStatus] = useState<BDStatus>(lead?.status ?? 'Contact');
  const [nextStep, setNextStep] = useState(lead?.nextStep ?? '');
  const [partner, setPartner] = useState(lead?.partner ?? '');
  const [sector, setSector] = useState(lead?.sector ?? '');
  const [keyContact, setKeyContact] = useState(lead?.keyContact ?? '');
  const [tier, setTier] = useState<Tier>(lead?.tier ?? 'Tier 2');
  const [editorialConcept, setEditorialConcept] = useState(lead?.editorialConcept ?? '');
  const [estValue, setEstValue] = useState(lead?.estValue?.toString() ?? '');
  const [source, setSource] = useState(lead?.source ?? '');
  const [introMade, setIntroMade] = useState(lead?.introMade ?? false);
  const [movedToSuite, setMovedToSuite] = useState(lead?.movedToSuite ?? false);
  const [notes, setNotes] = useState(lead?.notes ?? '');

  const handleSubmit = () => {
    if (!partner.trim()) return;
    onSave({
      teamLead, status, nextStep, partner: partner.trim(), sector, keyContact,
      tier, editorialConcept, estValue: parseInt(estValue) || 0, source,
      introMade, movedToSuite, notes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-brand-cream flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-brand-dark">{lead ? 'Edit Partner' : 'Add Partner'}</h2>
          <button onClick={onClose} className="text-brand-dark/30 hover:text-brand-dark text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Partner / Brand *</label>
              <input value={partner} onChange={e => setPartner(e.target.value)} className="input-field" placeholder="e.g. Samsung" />
            </div>
            <div>
              <label className="label">Sector</label>
              <input value={sector} onChange={e => setSector(e.target.value)} className="input-field" placeholder="e.g. Tech" />
            </div>
            <div>
              <label className="label">Team Lead</label>
              <input value={teamLead} onChange={e => setTeamLead(e.target.value)} className="input-field" placeholder="e.g. JMJ" />
            </div>
            <div>
              <label className="label">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as BDStatus)} className="input-field">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Key Contact</label>
              <input value={keyContact} onChange={e => setKeyContact(e.target.value)} className="input-field" placeholder="Name / Title" />
            </div>
            <div>
              <label className="label">Tier</label>
              <select value={tier} onChange={e => setTier(e.target.value as Tier)} className="input-field">
                {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Est. Value ($)</label>
              <input value={estValue} onChange={e => setEstValue(e.target.value)} className="input-field" placeholder="0" type="number" />
            </div>
            <div>
              <label className="label">Source / Suggested By</label>
              <input value={source} onChange={e => setSource(e.target.value)} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label">Next Step</label>
            <input value={nextStep} onChange={e => setNextStep(e.target.value)} className="input-field" placeholder="e.g. Send proposal" />
          </div>
          <div>
            <label className="label">Editorial Concept / Angle</label>
            <input value={editorialConcept} onChange={e => setEditorialConcept(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-field" rows={3} />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={introMade} onChange={e => setIntroMade(e.target.checked)} className="rounded border-brand-cream-dark text-brand-gold focus:ring-brand-gold/40" />
              <span className="text-sm text-brand-dark/70">Intro Made</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={movedToSuite} onChange={e => setMovedToSuite(e.target.checked)} className="rounded border-brand-cream-dark text-brand-gold focus:ring-brand-gold/40" />
              <span className="text-sm text-brand-dark/70">Moved to Suite</span>
            </label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-brand-cream flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} className="btn-primary">{lead ? 'Save Changes' : 'Add Partner'}</button>
        </div>
      </div>
    </div>
  );
}
