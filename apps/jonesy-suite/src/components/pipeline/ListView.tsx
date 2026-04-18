import { useState } from 'react';
import { Client, PipelineStage, STAGE_CONFIG, PIPELINE_STAGES, formatCurrency, daysSince, isStale } from '../../types';

type SortKey = 'name' | 'company' | 'value' | 'stage' | 'lastContact';
type SortDir = 'asc' | 'desc';

interface ListViewProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, stage: PipelineStage) => void;
}

export default function ListView({ clients, onEdit, onDelete, onMove }: ListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('lastContact');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...clients].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'company': cmp = a.company.localeCompare(b.company); break;
      case 'value': cmp = a.value - b.value; break;
      case 'stage': cmp = PIPELINE_STAGES.indexOf(a.stage) - PIPELINE_STAGES.indexOf(b.stage); break;
      case 'lastContact': cmp = new Date(a.lastContact).getTime() - new Date(b.lastContact).getTime(); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className={`ml-1 text-xs ${sortKey === col ? 'text-brand-gold' : 'text-brand-dark/30'}`}>
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  const ThBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-4 py-3 text-left cursor-pointer select-none hover:text-brand-dark text-xs font-semibold uppercase tracking-wider text-brand-dark/60 whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      {label}<SortIcon col={col} />
    </th>
  );

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-light/80 border-b border-brand-cream">
              <ThBtn col="name" label="Client" />
              <ThBtn col="company" label="Company" />
              <ThBtn col="stage" label="Stage" />
              <ThBtn col="value" label="Value" />
              <ThBtn col="lastContact" label="Last Contact" />
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-dark/60">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((client, i) => {
              const cfg = STAGE_CONFIG[client.stage];
              const stale = isStale(client.lastContact);
              const days = daysSince(client.lastContact);
              const isExpanded = expandedId === client.id;

              return (
                <>
                  <tr
                    key={client.id}
                    className={`border-b border-brand-cream/60 hover:bg-brand-light/50 cursor-pointer transition-colors ${
                      stale ? 'bg-amber-50/30' : i % 2 === 0 ? '' : 'bg-brand-light/20'
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : client.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {stale && <span className="text-amber-500 text-xs">⚠</span>}
                        <span className="font-medium text-brand-dark">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-dark/70">{client.company}</td>
                    <td className="px-4 py-3">
                      <span className={`stage-badge ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                        <span>{cfg.icon}</span> {client.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-brand-gold">
                      {formatCurrency(client.value)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={stale ? 'text-amber-700 font-medium' : 'text-brand-dark/60'}>
                          {days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`}
                        </span>
                        {stale && (
                          <span className="stale-indicator text-xs">stale</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={e => { e.stopPropagation(); onEdit(client); }}
                          className="btn-ghost py-1 px-2 text-xs"
                        >
                          Edit
                        </button>
                        {confirmDelete === client.id ? (
                          <button
                            onClick={e => { e.stopPropagation(); onDelete(client.id); setConfirmDelete(null); }}
                            className="btn-danger py-1 px-2 text-xs"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDelete(client.id); }}
                            className="btn-ghost py-1 px-2 text-xs text-red-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${client.id}-detail`} className="bg-brand-light/40 border-b border-brand-cream">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="grid grid-cols-3 gap-6">
                          <div>
                            <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider mb-1">Contact</p>
                            {client.email && <p className="text-sm text-brand-dark/80">{client.email}</p>}
                            {client.phone && <p className="text-sm text-brand-dark/80">{client.phone}</p>}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider mb-1">Notes</p>
                            <p className="text-sm text-brand-dark/70 leading-relaxed">{client.notes || 'No notes'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider mb-1">Move to Stage</p>
                            <div className="flex flex-wrap gap-1.5">
                              {PIPELINE_STAGES.filter(s => s !== client.stage).map(s => (
                                <button
                                  key={s}
                                  onClick={e => { e.stopPropagation(); onMove(client.id, s); }}
                                  className={`stage-badge ${STAGE_CONFIG[s].bg} ${STAGE_CONFIG[s].color} ${STAGE_CONFIG[s].border} border cursor-pointer hover:opacity-80 transition-opacity`}
                                >
                                  {STAGE_CONFIG[s].icon} {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {(client.tags ?? []).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {(client.tags ?? []).map(tag => (
                              <span key={tag} className="px-2 py-0.5 rounded-full bg-brand-cream text-brand-dark/50 text-xs border border-brand-cream-dark">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="text-center py-16 text-brand-dark/40">
            <p className="text-3xl mb-3">◎</p>
            <p className="font-medium">No clients found</p>
          </div>
        )}
      </div>
    </div>
  );
}
