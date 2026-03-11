import { useState } from 'react';
import { Client, PipelineStage, STAGE_CONFIG, formatCurrency, isStale } from '../../types';
import ClientCard from './ClientCard';

interface KanbanColumnProps {
  stage: PipelineStage;
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, stage: PipelineStage) => void;
  onDrop: (clientId: string, stage: PipelineStage) => void;
}

export default function KanbanColumn({
  stage,
  clients,
  onEdit,
  onDelete,
  onMove,
  onDrop,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const cfg = STAGE_CONFIG[stage];
  const staleCount = clients.filter(c => isStale(c.lastContact)).length;
  const totalValue = clients.reduce((sum, c) => sum + c.value, 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const clientId = e.dataTransfer.getData('clientId');
    if (clientId) onDrop(clientId, stage);
  };

  return (
    <div
      className={`kanban-column transition-all duration-150 ${isDragOver ? 'border-brand-gold bg-brand-gold/5 shadow-gold' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="p-3.5 border-b border-brand-cream">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className="font-semibold text-sm text-brand-dark">{stage}</span>
            <span className={`stage-badge ${cfg.bg} ${cfg.color} ${cfg.border} border text-xs px-2`}>
              {clients.length}
            </span>
          </div>
          {staleCount > 0 && (
            <span className="stale-indicator">⚠ {staleCount}</span>
          )}
        </div>
        <div className="text-xs text-brand-dark/40 font-medium">
          {formatCurrency(totalValue)} total
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2.5 space-y-2 overflow-y-auto">
        {clients.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed transition-colors ${isDragOver ? 'border-brand-gold' : 'border-brand-cream'}`}>
            <p className="text-xs text-brand-dark/30 text-center">
              {isDragOver ? 'Drop here' : 'No clients'}
            </p>
          </div>
        ) : (
          clients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              draggable
            />
          ))
        )}
      </div>
    </div>
  );
}
