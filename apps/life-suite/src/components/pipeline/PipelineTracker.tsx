import { useState, useMemo } from 'react';
import { Client, PipelineStage, PIPELINE_STAGES, STAGE_CONFIG, formatCurrency, isStale } from '../../types';
import KanbanBoard from './KanbanBoard';
import ListView from './ListView';
import ClientModal from './ClientModal';

type BoardView = 'kanban' | 'list';

interface PipelineTrackerProps {
  clients: Client[];
  onAdd: (data: Omit<Client, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, updates: Partial<Client>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, stage: Client['stage']) => void;
  onDeleteProposal: (clientId: string, proposalId: string) => void;
  onAddProposal: (clientId: string, proposal: import('../../types').SavedProposal) => void;
}

export default function PipelineTracker({
  clients,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
  onDeleteProposal,
  onAddProposal,
}: PipelineTrackerProps) {
  const [boardView, setBoardView] = useState<BoardView>('kanban');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'All'>('All');
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [search, setSearch] = useState('');

  const staleCount = useMemo(() => clients.filter(c => isStale(c.lastContact)).length, [clients]);
  const totalValue = useMemo(() => clients.reduce((s, c) => s + c.value, 0), [clients]);
  const closedValue = useMemo(
    () => clients.filter(c => c.stage === 'Close').reduce((s, c) => s + c.value, 0),
    [clients]
  );

  const filteredClients = useMemo(() => {
    let list = clients;
    if (stageFilter !== 'All') list = list.filter(c => c.stage === stageFilter);
    if (showStaleOnly) list = list.filter(c => isStale(c.lastContact));
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
  }, [clients, stageFilter, showStaleOnly, search]);

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
      {/* Stats bar */}
      <div className="bg-white border-b border-brand-cream px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Pipeline metrics */}
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-xs text-brand-dark/50 font-medium uppercase tracking-wider">Total Pipeline</p>
              <p className="font-display text-2xl font-bold text-brand-dark">{formatCurrency(totalValue)}</p>
            </div>
            <div className="w-px h-10 bg-brand-cream" />
            <div>
              <p className="text-xs text-brand-dark/50 font-medium uppercase tracking-wider">Closed</p>
              <p className="font-display text-2xl font-bold text-emerald-600">{formatCurrency(closedValue)}</p>
            </div>
            <div className="w-px h-10 bg-brand-cream" />
            <div>
              <p className="text-xs text-brand-dark/50 font-medium uppercase tracking-wider">Clients</p>
              <p className="font-display text-2xl font-bold text-brand-dark">{clients.length}</p>
            </div>
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

          {/* Stage mini-pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {PIPELINE_STAGES.map(stage => {
              const count = clients.filter(c => c.stage === stage).length;
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
      <div className="bg-brand-light border-b border-brand-cream px-6 py-3 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/30 text-sm">⌕</span>
          <input
            className="input-field pl-8 py-1.5 text-sm"
            placeholder="Search clients, companies, tags…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-dark/30 hover:text-brand-dark text-xs"
            >✕</button>
          )}
        </div>

        {/* Stage filter */}
        <select
          className="input-field w-auto py-1.5 text-sm"
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value as PipelineStage | 'All')}
        >
          <option value="All">All Stages</option>
          {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Stale filter */}
        <button
          onClick={() => setShowStaleOnly(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
            showStaleOnly
              ? 'bg-amber-100 text-amber-800 border-amber-300'
              : 'bg-white text-brand-dark/60 border-brand-cream hover:text-brand-dark'
          }`}
        >
          ⚠ Stale only {staleCount > 0 && <span className="bg-amber-200 text-amber-800 rounded-full px-1.5 text-xs">{staleCount}</span>}
        </button>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center bg-white rounded-lg border border-brand-cream p-0.5">
          <button
            onClick={() => setBoardView('kanban')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              boardView === 'kanban'
                ? 'bg-brand-gold text-brand-dark'
                : 'text-brand-dark/60 hover:text-brand-dark'
            }`}
          >
            ⬡ Kanban
          </button>
          <button
            onClick={() => setBoardView('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              boardView === 'list'
                ? 'bg-brand-gold text-brand-dark'
                : 'text-brand-dark/60 hover:text-brand-dark'
            }`}
          >
            ☰ List
          </button>
        </div>

        {/* Add client */}
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <span>+</span> Add Client
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto p-6">
        {boardView === 'kanban' ? (
          <div className="overflow-x-auto pb-2">
            <KanbanBoard
              clients={filteredClients}
              onEdit={openEdit}
              onDelete={onDelete}
              onMove={onMove}
            />
          </div>
        ) : (
          <ListView
            clients={filteredClients}
            onEdit={openEdit}
            onDelete={onDelete}
            onMove={onMove}
          />
        )}

        {filteredClients.length === 0 && clients.length > 0 && (
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

      {/* Modal */}
      {modalOpen && (
        <ClientModal
          client={editingClient}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingClient(null); }}
          onDeleteProposal={editingClient ? (proposalId) => onDeleteProposal(editingClient.id, proposalId) : undefined}
          onAddProposal={editingClient ? (proposal) => onAddProposal(editingClient.id, proposal) : undefined}
        />
      )}
    </div>
  );
}
