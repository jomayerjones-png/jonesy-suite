import { useState, useRef, useCallback } from 'react';
import { Client, SavedProposal, ThreadMessage, PipelineStage, PIPELINE_STAGES, STAGE_CONFIG } from '../../types';

// ── Lead config ───────────────────────────────────────────────────────────────
const LEADS = ['JMJ', 'GBV', 'RS', 'NM', 'KK', 'Mimi', 'MS'];
const LEAD_COLORS: Record<string, string> = {
  JMJ:  'bg-blue-100 text-blue-800',
  GBV:  'bg-purple-100 text-purple-800',
  RS:   'bg-amber-100 text-amber-800',
  NM:   'bg-emerald-100 text-emerald-800',
  KK:   'bg-pink-100 text-pink-800',
  Mimi: 'bg-orange-100 text-orange-800',
  MS:   'bg-teal-100 text-teal-800',
};
const TIERS = ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLeads(client: Client): string[] {
  return client.tags
    .filter(t => LEADS.map(l => l.toLowerCase()).includes(t.toLowerCase()))
    .map(t => LEADS.find(l => l.toLowerCase() === t.toLowerCase()) ?? t);
}

function getTier(client: Client): string {
  const t = client.tags.find(t => /^tier-\d/.test(t));
  return t ? 'Tier ' + t.split('-')[1] : '';
}

function setLeadsInTags(tags: string[], leads: string[]): string[] {
  const nonLeads = tags.filter(t => !LEADS.map(l => l.toLowerCase()).includes(t.toLowerCase()));
  return [...nonLeads, ...leads.map(l => l.toLowerCase())];
}

function setTierInTags(tags: string[], tier: string): string[] {
  const nonTier = tags.filter(t => !/^tier-\d/.test(t));
  const num = tier.replace('Tier ', '').toLowerCase();
  return [...nonTier, ...(num ? [`tier-${num}`] : [])];
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface BDSpreadsheetProps {
  clients: Client[];
  onAdd: (data: Omit<Client, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, updates: Partial<Client>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, stage: Client['stage']) => void;
  onMarkLost?: (id: string, reason: string) => void;
  onReactivate?: (id: string) => void;
  onAddProposal?: (clientId: string, proposal: SavedProposal) => void;
  onUpdateThread?: (clientId: string, thread: ThreadMessage[]) => void;
}

type SortField = 'company' | 'stage' | 'industry' | 'value' | 'name';

// ── Inline cell ───────────────────────────────────────────────────────────────
function EditableCell({
  value, onSave, placeholder = '—', className = '', multiline = false,
}: {
  value: string; onSave: (v: string) => void; placeholder?: string; className?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const start = () => { setDraft(value); setEditing(true); setTimeout(() => ref.current?.select(), 0); };
  const commit = () => { onSave(draft.trim()); setEditing(false); };
  const cancel = () => setEditing(false);

  if (editing) {
    const props = {
      ref,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') cancel();
      },
      autoFocus: true,
      className: `w-full text-xs bg-white border border-[#E8002D] outline-none rounded px-1.5 py-0.5 ${className}`,
    };
    return multiline
      ? <textarea {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} rows={3} className={props.className + ' resize-none'} />
      : <input {...props as React.InputHTMLAttributes<HTMLInputElement>} />;
  }

  return (
    <span
      onClick={start}
      className={`block cursor-text min-h-[20px] text-xs rounded px-1 py-0.5 hover:bg-gray-50 transition-colors ${value ? '' : 'text-gray-300 italic'} ${className}`}
    >
      {value || placeholder}
    </span>
  );
}

// ── Stage cell ────────────────────────────────────────────────────────────────
function StageCell({ stage, onChange }: { stage: PipelineStage; onChange: (s: PipelineStage) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = STAGE_CONFIG[stage];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${cfg.bg} ${cfg.color} ${cfg.border}`}
      >
        {stage}
        <span className="opacity-50 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-20 py-1 min-w-[140px]">
          {PIPELINE_STAGES.map(s => {
            const c = STAGE_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 flex items-center gap-2 ${s === stage ? 'font-semibold' : ''}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Lead multi-select ─────────────────────────────────────────────────────────
function LeadCell({ leads, onChange }: { leads: string[]; onChange: (l: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex flex-wrap gap-0.5 cursor-pointer min-h-[22px] min-w-[32px]"
      >
        {leads.length === 0
          ? <span className="text-gray-300 text-xs italic">—</span>
          : leads.map(l => (
            <span key={l} className={`text-xs px-1.5 py-0.5 rounded font-medium ${LEAD_COLORS[l] ?? 'bg-gray-100 text-gray-700'}`}>{l}</span>
          ))
        }
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-20 py-1 min-w-[120px]">
          {LEADS.map(l => (
            <button
              key={l}
              onClick={() => {
                const next = leads.includes(l) ? leads.filter(x => x !== l) : [...leads, l];
                onChange(next);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${leads.includes(l) ? 'font-semibold' : ''}`}
            >
              <span className={`inline-block w-3 h-3 rounded border-2 flex-shrink-0 ${leads.includes(l) ? 'bg-[#E8002D] border-[#E8002D]' : 'border-gray-300'}`} />
              {l}
            </button>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button onClick={() => setOpen(false)} className="w-full text-left px-3 py-1 text-xs text-gray-400">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tier cell ─────────────────────────────────────────────────────────────────
function TierCell({ tier, onChange }: { tier: string; onChange: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const colors: Record<string, string> = {
    'Tier 0': 'bg-red-100 text-red-800',
    'Tier 1': 'bg-blue-100 text-blue-800',
    'Tier 2': 'bg-amber-100 text-amber-800',
    'Tier 3': 'bg-gray-100 text-gray-600',
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`text-xs px-1.5 py-0.5 rounded font-medium ${tier ? colors[tier] ?? 'bg-gray-100 text-gray-600' : 'text-gray-300 italic'}`}
      >
        {tier || '—'}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-20 py-1 min-w-[90px]">
          <button onClick={() => { onChange(''); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50">Clear</button>
          {TIERS.map(t => (
            <button
              key={t}
              onClick={() => { onChange(t); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 ${t === tier ? 'font-bold' : ''}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BDSpreadsheet({
  clients, onAdd, onUpdate, onDelete, onMove,
}: BDSpreadsheetProps) {
  const [sortField, setSortField] = useState<SortField>('company');
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState('');
  const [showLost, setShowLost] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const displayClients = showLost ? clients.filter(c => c.outcome === 'lost') : clients.filter(c => c.outcome !== 'lost');

  const filtered = displayClients.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.company.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) ||
      c.industry.toLowerCase().includes(q) || c.tags.some(t => t.includes(q)) ||
      (c.notes ?? '').toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    let va = '', vb = '';
    if (sortField === 'company') { va = a.company; vb = b.company; }
    else if (sortField === 'stage') { va = a.stage; vb = b.stage; }
    else if (sortField === 'industry') { va = a.industry; vb = b.industry; }
    else if (sortField === 'value') { return sortAsc ? a.value - b.value : b.value - a.value; }
    else if (sortField === 'name') { va = a.name; vb = b.name; }
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortAsc(v => !v);
    else { setSortField(field); setSortAsc(true); }
  }, [sortField]);

  const update = (id: string, updates: Partial<Client>) => onUpdate(id, updates);

  const addRow = () => {
    onAdd({
      name: 'New Contact',
      company: 'New Company',
      email: '', phone: '', value: 0,
      stage: 'Engaged',
      notes: '', nextStep: '',
      lastContact: new Date().toISOString().split('T')[0],
      tags: [],
      proposals: [],
      industry: '',
      outcome: 'active',
      lostReason: '',
      stageHistory: [],
    });
  };

  const SortHeader = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <th
      onClick={() => toggleSort(field)}
      className={`px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-gray-800 transition-colors ${className}`}
    >
      {label}
      {sortField === field && <span className="ml-1 opacity-60">{sortAsc ? '↑' : '↓'}</span>}
    </th>
  );

  const lostCount = clients.filter(c => c.outcome === 'lost').length;

  return (
    <div className="flex flex-col h-full bg-brand-light">
      <style>{`
        @media print {
          @page { margin: 1cm; size: A4 landscape; }
          body { background: white !important; font-size: 8pt; }
          .no-print { display: none !important; }
          .print-only { display: table-row !important; }
          th, td { border: 1px solid #e5e7eb !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print bg-white border-b border-brand-cream px-4 py-2 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">⌕</span>
          <input
            className="input-field pl-7 py-1.5 text-xs w-56"
            placeholder="Search partners, contacts, sectors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>}
        </div>
        <span className="text-xs text-gray-400">{sorted.length} companies</span>
        {lostCount > 0 && (
          <button
            onClick={() => setShowLost(v => !v)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${showLost ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'}`}
          >
            {showLost ? '← Active' : `✕ Lost (${lostCount})`}
          </button>
        )}
        <div className="flex-1" />
        <button onClick={() => window.print()} className="no-print btn-secondary text-xs py-1.5 flex items-center gap-1.5">
          <span>⎙</span> Export
        </button>
        <button onClick={addRow} className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
          <span>+</span> Add Row
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: '1100px' }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Lead</th>
              <SortHeader field="stage" label="Status" className="w-32" />
              <SortHeader field="company" label="Partner / Brand" className="w-44" />
              <SortHeader field="name" label="Key Contact" className="w-36" />
              <SortHeader field="industry" label="Sector" className="w-28" />
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Tier</th>
              <SortHeader field="value" label="Value ($)" className="w-24" />
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-44">Next Step</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
              <th className="w-8 no-print" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((client, i) => {
              const leads = getLeads(client);
              const tier = getTier(client);
              const isLost = client.outcome === 'lost';
              return (
                <tr
                  key={client.id}
                  className={`group transition-colors ${isLost ? 'opacity-50' : 'hover:bg-blue-50/30'} ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                >
                  {/* Lead */}
                  <td className="px-2 py-1.5 align-top">
                    <LeadCell
                      leads={leads}
                      onChange={newLeads => update(client.id, { tags: setLeadsInTags(client.tags, newLeads) })}
                    />
                  </td>

                  {/* Status */}
                  <td className="px-2 py-1.5 align-top">
                    {isLost
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">Lost</span>
                      : <StageCell stage={client.stage} onChange={stage => onMove(client.id, stage)} />
                    }
                  </td>

                  {/* Company */}
                  <td className="px-2 py-1.5 align-top">
                    <EditableCell
                      value={client.company}
                      onSave={v => update(client.id, { company: v })}
                      className="font-semibold text-gray-900"
                    />
                  </td>

                  {/* Contact */}
                  <td className="px-2 py-1.5 align-top">
                    <EditableCell
                      value={client.name === 'TBD' ? '' : client.name}
                      onSave={v => update(client.id, { name: v || 'TBD' })}
                      placeholder="TBD"
                      className="text-gray-700"
                    />
                  </td>

                  {/* Sector */}
                  <td className="px-2 py-1.5 align-top">
                    <EditableCell
                      value={client.industry}
                      onSave={v => update(client.id, { industry: v })}
                      placeholder="—"
                      className="text-gray-600"
                    />
                  </td>

                  {/* Tier */}
                  <td className="px-2 py-1.5 align-top">
                    <TierCell
                      tier={tier}
                      onChange={t => update(client.id, { tags: setTierInTags(client.tags, t) })}
                    />
                  </td>

                  {/* Value */}
                  <td className="px-2 py-1.5 align-top">
                    <EditableCell
                      value={client.value > 0 ? String(client.value) : ''}
                      onSave={v => update(client.id, { value: Number(v.replace(/[^0-9.]/g, '')) || 0 })}
                      placeholder="$0"
                      className="text-gray-700 font-medium"
                    />
                  </td>

                  {/* Next Step */}
                  <td className="px-2 py-1.5 align-top max-w-[180px]">
                    <EditableCell
                      value={client.nextStep ?? ''}
                      onSave={v => update(client.id, { nextStep: v })}
                      placeholder="Add next step…"
                      className="text-gray-700"
                      multiline
                    />
                  </td>

                  {/* Notes */}
                  <td className="px-2 py-1.5 align-top">
                    <EditableCell
                      value={client.notes}
                      onSave={v => update(client.id, { notes: v })}
                      placeholder="Add notes…"
                      className="text-gray-500 leading-relaxed"
                      multiline
                    />
                  </td>

                  {/* Delete */}
                  <td className="px-1 py-1.5 align-top no-print">
                    {confirmDeleteId === client.id ? (
                      <button
                        onClick={() => { onDelete(client.id); setConfirmDeleteId(null); }}
                        className="text-xs text-red-600 font-medium whitespace-nowrap"
                      >
                        Confirm
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(client.id)}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition-all text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center text-gray-400 text-sm">
                  {search ? 'No matches found.' : 'No companies in BD. Click + Add Row to start.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Add row footer */}
        <div className="no-print border-t border-dashed border-gray-200 px-4 py-2">
          <button onClick={addRow} className="text-xs text-gray-400 hover:text-[#E8002D] transition-colors flex items-center gap-1.5">
            <span className="text-base leading-none">+</span> Add company
          </button>
        </div>
      </div>
    </div>
  );
}
