import { useState, useMemo } from 'react';
import { Client, PipelineStage, PIPELINE_STAGES, STAGE_CONFIG, SavedProposal, ThreadMessage, formatCurrency, isStale } from '../../types';
import KanbanBoard from './KanbanBoard';
import ListView from './ListView';
import ClientModal from './ClientModal';

type BoardView = 'kanban' | 'list';

interface PipelineTrackerProps {
  clients: Client[];
  allClients?: Client[];
  defaultNewStage?: Client['stage'];
  onAdd: (data: Omit<Client, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, updates: Partial<Client>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, stage: Client['stage']) => void;
  onMarkLost: (id: string, reason: string) => void;
  onReactivate: (id: string) => void;
  onDeleteProposal: (clientId: string, proposalId: string) => void;
  onAddProposal: (clientId: string, proposal: SavedProposal) => void;
  onUpdateProposal: (clientId: string, proposalId: string, updates: Partial<SavedProposal>) => void;
  onUpdateThread: (clientId: string, thread: ThreadMessage[]) => void;
  onUpdateMeetingNotes: (clientId: string, notes: import('../../types').MeetingNote[]) => void;
  onUpdateNewsCache: (clientId: string, cache: import('../../types').Client['newsCache']) => void;
}

export default function PipelineTracker({
  clients,
  defaultNewStage = 'Engaged',
  onAdd,
  onUpdate,
  onDelete,
  onMove,
  onMarkLost,
  onReactivate,
  onDeleteProposal,
  onAddProposal,
  onUpdateProposal,
  onUpdateThread,
  onUpdateMeetingNotes,
  onUpdateNewsCache,
}: PipelineTrackerProps) {
  const [boardView, setBoardView] = useState<BoardView>('kanban');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'All'>('All');
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [search, setSearch] = useState('');

  const activeClients = useMemo(() => clients.filter(c => c.outcome !== 'lost'), [clients]);
  const lostClients = useMemo(() => clients.filter(c => c.outcome === 'lost'), [clients]);

  const staleCount = useMemo(() => activeClients.filter(c => isStale(c.lastContact, c.stage)).length, [activeClients]);
  const totalValue = useMemo(() => activeClients.reduce((s, c) => s + c.value, 0), [activeClients]);
  const wonValue = useMemo(
    () => activeClients.filter(c => c.outcome === 'won').reduce((s, c) => s + c.value, 0),
    [activeClients]
  );

  const displayClients = showLost ? lostClients : activeClients;

  const filteredClients = useMemo(() => {
    let list = displayClients;
    if (!showLost) {
      if (stageFilter !== 'All') list = list.filter(c => c.stage === stageFilter);
      if (showStaleOnly) list = list.filter(c => isStale(c.lastContact, c.stage));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.tags.some(t => t.includes(q))
      );
    }
    return list;
  }, [displayClients, stageFilter, showStaleOnly, showLost, search]);

  const openAdd = () => { setEditingClient(null); setModalOpen(true); };
  const openEdit = (client: Client) => { setEditingClient(client); setModalOpen(true); };

  const handleSave = (data: Omit<Client, 'id' | 'createdAt'>) => {
    if (editingClient) {
      onUpdate(editingClient.id, data);
    } else {
      onAdd(data);
    }
    setModalOpen(false);
    setEditingClient(null);
  };

  return (
    <div className="flex flex-col h-full">
      <style>{`
        @media print {
          @page { margin: 1.2cm 1.5cm; size: A4 landscape; }
          body { background: white !important; font-size: 9pt; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          print-color-adjust: exact; -webkit-print-color-adjust: exact;
        }
      `}</style>

      {/* Print-only pipeline snapshot */}
      <div className="print-only hidden">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '2px solid #1A1A1A', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ backgroundColor: '#E8002D', padding: '5px 12px' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: 'white', fontSize: '22px', letterSpacing: '-1px', lineHeight: 1 }}>LIFE</span>
            </div>
            <span style={{ fontSize: '11pt', fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.02em' }}>Partner Pipeline</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '8pt', color: '#666' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p style={{ margin: '1px 0 0', color: '#999' }}>{activeClients.filter(c => c.outcome !== 'won').length} active · {activeClients.filter(c => c.outcome === 'won').length} won</p>
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          {[
            { label: 'Total Pipeline', value: formatCurrency(totalValue), color: '#1A1A1A' },
            { label: 'Won', value: formatCurrency(wonValue), color: '#059669' },
            { label: 'Active Deals', value: String(activeClients.filter(c => c.outcome !== 'won').length), color: '#1A1A1A' },
            ...(staleCount > 0 ? [{ label: 'Needs Attention', value: String(staleCount), color: '#d97706' }] : []),
          ].map((s, i, arr) => (
            <div key={s.label} style={{ flex: 1, padding: '10px 14px', borderRight: i < arr.length - 1 ? '1px solid #e5e7eb' : 'none', backgroundColor: i === 0 ? '#fafafa' : 'white' }}>
              <p style={{ margin: '0 0 2px', fontSize: '6.5pt', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: '15pt', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Pipeline funnel — stage-by-stage summary */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '18px' }}>
          {PIPELINE_STAGES.filter(s => s !== 'Prospect').map(stage => {
            const stageClients = activeClients.filter(c => c.stage === stage && c.outcome !== 'won');
            const stageValue = stageClients.reduce((s, c) => s + c.value, 0);
            const stageColors: Record<string, string> = {
              Engaged: '#3b82f6', 'Meeting Set': '#8b5cf6', 'Proposal Sent': '#f59e0b',
              Feedback: '#f97316', 'Revised Proposal Sent': '#f43f5e', Close: '#10b981',
            };
            const col = stageColors[stage] ?? '#6b7280';
            return (
              <div key={stage} style={{ flex: 1, borderTop: `3px solid ${col}`, padding: '6px 8px', backgroundColor: '#fafafa', borderRadius: '0 0 4px 4px' }}>
                <p style={{ margin: '0 0 1px', fontSize: '6pt', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stage}</p>
                <p style={{ margin: 0, fontSize: '11pt', fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>{stageClients.length}</p>
                {stageValue > 0 && <p style={{ margin: '1px 0 0', fontSize: '7pt', color: '#666' }}>{formatCurrency(stageValue)}</p>}
              </div>
            );
          })}
        </div>

        {/* Clients grouped by stage */}
        {PIPELINE_STAGES.filter(stage => {
          const stageClients = activeClients.filter(c => c.stage === stage);
          return stageClients.length > 0;
        }).map(stage => {
          const stageClients = activeClients.filter(c => c.stage === stage).sort((a, b) => b.value - a.value);
          const stageValue = stageClients.reduce((s, c) => s + c.value, 0);
          const stageColors: Record<string, string> = {
            Prospect: '#94a3b8', Engaged: '#3b82f6', 'Meeting Set': '#8b5cf6',
            'Proposal Sent': '#f59e0b', Feedback: '#f97316', 'Revised Proposal Sent': '#f43f5e', Close: '#10b981',
          };
          const col = stageColors[stage] ?? '#6b7280';
          return (
            <div key={stage} style={{ marginBottom: '14px' }}>
              {/* Stage header */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', padding: '4px 0 4px 8px', borderLeft: `3px solid ${col}`, marginBottom: '4px' }}>
                <span style={{ fontSize: '8pt', fontWeight: 700, color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stage}</span>
                <span style={{ fontSize: '7pt', color: '#888' }}>{stageClients.length} deal{stageClients.length !== 1 ? 's' : ''}</span>
                {stageValue > 0 && <span style={{ fontSize: '7pt', fontWeight: 600, color: col, marginLeft: 'auto' }}>{formatCurrency(stageValue)}</span>}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    {['Contact', 'Company', 'Value', 'Last Contact', 'Notes', 'Tags'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '3px 8px', fontSize: '6.5pt', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stageClients.map((c, i) => {
                    const stale = isStale(c.lastContact, c.stage);
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: stale ? '#fffbeb' : (i % 2 === 0 ? 'white' : '#fafafa') }}>
                        <td style={{ padding: '5px 8px', fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap' }}>
                          {stale && <span style={{ color: '#d97706', marginRight: '4px' }}>⚠</span>}{c.name}
                        </td>
                        <td style={{ padding: '5px 8px', color: '#444', whiteSpace: 'nowrap' }}>{c.company}</td>
                        <td style={{ padding: '5px 8px', fontWeight: 600, color: '#C9A84C', whiteSpace: 'nowrap' }}>{c.value > 0 ? formatCurrency(c.value) : '—'}</td>
                        <td style={{ padding: '5px 8px', color: '#888', whiteSpace: 'nowrap' }}>{c.lastContact}</td>
                        <td style={{ padding: '5px 8px', color: '#555', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes ? c.notes.split('\n')[0].slice(0, 80) : '—'}</td>
                        <td style={{ padding: '5px 8px', color: '#888', fontSize: '7pt' }}>{c.tags.join(', ') || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Footer */}
        <div style={{ marginTop: '20px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '7pt', color: '#999' }}>
          <span>LIFE Magazine · Confidential</span>
          <span>Printed {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-brand-cream px-6 py-4 no-print">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-xs text-brand-dark/50 font-medium uppercase tracking-wider">Active Pipeline</p>
              <p className="font-display text-2xl font-bold text-brand-dark">{formatCurrency(totalValue)}</p>
            </div>
            <div className="w-px h-10 bg-brand-cream" />
            <div>
              <p className="text-xs text-brand-dark/50 font-medium uppercase tracking-wider">Won</p>
              <p className="font-display text-2xl font-bold text-emerald-600">{formatCurrency(wonValue)}</p>
            </div>
            <div className="w-px h-10 bg-brand-cream" />
            <div>
              <p className="text-xs text-brand-dark/50 font-medium uppercase tracking-wider">Active</p>
              <p className="font-display text-2xl font-bold text-brand-dark">{activeClients.length}</p>
            </div>
            {lostClients.length > 0 && (
              <>
                <div className="w-px h-10 bg-brand-cream" />
                <div>
                  <p className="text-xs text-red-600/70 font-medium uppercase tracking-wider">Lost</p>
                  <p className="font-display text-2xl font-bold text-red-500">{lostClients.length}</p>
                </div>
              </>
            )}
            {staleCount > 0 && (
              <>
                <div className="w-px h-10 bg-brand-cream" />
                <div>
                  <p className="text-xs text-amber-700 font-medium uppercase tracking-wider">Stale</p>
                  <p className="font-display text-2xl font-bold text-amber-600">{staleCount}</p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {PIPELINE_STAGES.map(stage => {
              const count = activeClients.filter(c => c.stage === stage).length;
              const cfg = STAGE_CONFIG[stage];
              return (
                <div key={stage} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {stage}: {count}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="no-print bg-brand-light border-b border-brand-cream px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/30 text-sm">⌕</span>
          <input
            className="input-field pl-8 py-1.5 text-sm"
            placeholder="Search clients, companies, tags…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-dark/30 hover:text-brand-dark text-xs">✕</button>
          )}
        </div>

        {!showLost && (
          <>
            <select
              className="input-field w-auto py-1.5 text-sm"
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value as PipelineStage | 'All')}
            >
              <option value="All">All Stages</option>
              {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button
              onClick={() => setShowStaleOnly(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                showStaleOnly ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-brand-dark/60 border-brand-cream hover:text-brand-dark'
              }`}
            >
              ⚠ Stale {staleCount > 0 && <span className="bg-amber-200 text-amber-800 rounded-full px-1.5 text-xs">{staleCount}</span>}
            </button>
          </>
        )}

        {lostClients.length > 0 && (
          <button
            onClick={() => setShowLost(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              showLost ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-brand-dark/60 border-brand-cream hover:text-brand-dark'
            }`}
          >
            ✕ Lost {lostClients.length > 0 && <span className="bg-red-200 text-red-700 rounded-full px-1.5 text-xs">{lostClients.length}</span>}
          </button>
        )}

        <div className="flex-1" />

        <div className="flex items-center bg-white rounded-lg border border-brand-cream p-0.5">
          <button
            onClick={() => setBoardView('kanban')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${boardView === 'kanban' ? 'bg-brand-gold text-brand-dark' : 'text-brand-dark/60 hover:text-brand-dark'}`}
          >
            ⬡ Kanban
          </button>
          <button
            onClick={() => setBoardView('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${boardView === 'list' ? 'bg-brand-gold text-brand-dark' : 'text-brand-dark/60 hover:text-brand-dark'}`}
          >
            ☰ List
          </button>
        </div>

        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2">
          <span>⎙</span> Download PDF
        </button>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <span>+</span> Add Client
        </button>
      </div>

      {/* Board */}
      <div className="no-print flex-1 overflow-auto p-6">
        {showLost ? (
          <div className="max-w-3xl mx-auto space-y-2">
            {filteredClients.length === 0 ? (
              <p className="text-center text-brand-dark/40 py-12">No lost deals found.</p>
            ) : (
              filteredClients.map(c => (
                <div key={c.id} className="card p-4 flex items-center gap-4 opacity-75">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-brand-dark">{c.name}</p>
                      <span className="text-xs text-brand-dark/50">— {c.company}</span>
                    </div>
                    {c.lostReason && <p className="text-xs text-red-600/70 mt-0.5">{c.lostReason}</p>}
                  </div>
                  <span className="text-sm font-bold text-brand-dark/40">{formatCurrency(c.value)}</span>
                  <button
                    onClick={() => onReactivate(c.id)}
                    className="btn-secondary py-1 px-2.5 text-xs flex-shrink-0"
                  >
                    Reactivate
                  </button>
                </div>
              ))
            )}
          </div>
        ) : boardView === 'kanban' ? (
          <div className="overflow-x-auto pb-2">
            <KanbanBoard clients={filteredClients} onEdit={openEdit} onDelete={onDelete} onMove={onMove} />
          </div>
        ) : (
          <ListView clients={filteredClients} onEdit={openEdit} onDelete={onDelete} onMove={onMove} />
        )}

        {filteredClients.length === 0 && displayClients.length > 0 && (
          <div className="text-center py-16 text-brand-dark/40 animate-fade-in">
            <p className="text-4xl mb-3">◎</p>
            <p className="font-medium text-brand-dark/60">No clients match your filters</p>
            <button
              onClick={() => { setSearch(''); setStageFilter('All'); setShowStaleOnly(false); }}
              className="mt-3 text-brand-gold hover:text-brand-gold-dark text-sm underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <ClientModal
          client={editingClient}
          defaultStage={defaultNewStage}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingClient(null); }}
          onMarkLost={editingClient ? (reason) => { onMarkLost(editingClient.id, reason); setModalOpen(false); setEditingClient(null); } : undefined}
          onReactivate={editingClient ? () => { onReactivate(editingClient.id); setModalOpen(false); setEditingClient(null); } : undefined}
          onDeleteProposal={editingClient ? (proposalId) => onDeleteProposal(editingClient.id, proposalId) : undefined}
          onAddProposal={editingClient ? (proposal) => onAddProposal(editingClient.id, proposal) : undefined}
          onUpdateProposal={editingClient ? (proposalId, updates) => onUpdateProposal(editingClient.id, proposalId, updates) : undefined}
          onUpdateThread={editingClient ? (thread) => onUpdateThread(editingClient.id, thread) : undefined}
          onUpdateMeetingNotes={editingClient ? (notes) => onUpdateMeetingNotes(editingClient.id, notes) : undefined}
          onUpdateNewsCache={editingClient ? (cache) => onUpdateNewsCache(editingClient.id, cache) : undefined}
        />
      )}
    </div>
  );
}
