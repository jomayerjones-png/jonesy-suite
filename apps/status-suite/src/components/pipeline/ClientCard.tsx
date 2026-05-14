import { useState } from 'react';
import { Client, STAGE_CONFIG, formatCurrency, formatDate, daysSince } from '../../types';


interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, stage: Client['stage']) => void;
  draggable?: boolean;
  compact?: boolean;
}

export default function ClientCard({
  client,
  onEdit,
  onDelete,
  onMove: _onMove,
  draggable = true,
  compact = false,
}: ClientCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stageCfg = STAGE_CONFIG[client.stage];
  const days = daysSince(client.lastContact);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('clientId', client.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable={draggable}
      onDragStart={handleDragStart}
      className={`card card-hover animate-fade-in group relative ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${compact ? 'p-3' : 'p-4'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setConfirmDelete(false); }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Company & contact */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-brand-dark text-sm truncate">{client.company}</span>
          </div>
          <p className="text-xs text-brand-dark/60 mt-0.5 truncate">{client.name}{client.contacts && client.contacts.length > 0 ? ` + ${client.contacts.length}` : ''}</p>
        </div>

        {/* Value */}
        <div className="text-right flex-shrink-0">
          <span className="text-sm font-bold text-brand-gold">{formatCurrency(client.value)}</span>
        </div>
      </div>

      {!compact && (
        <>
          {/* Stage badge */}
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <span
              className={`stage-badge ${stageCfg.bg} ${stageCfg.color} ${stageCfg.border} border`}
            >
              <span>{stageCfg.icon}</span> {client.stage}
            </span>
            {client.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="inline-flex px-2 py-0.5 rounded-full bg-brand-light text-brand-dark/50 text-xs border border-brand-cream"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Notes */}
          {client.notes && (
            <p className="mt-2 text-xs text-brand-dark/60 line-clamp-2 leading-relaxed">
              {client.notes}
            </p>
          )}

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-brand-dark/40">
              <span>🕐</span>
              <span>
                {days === 0
                  ? 'Today'
                  : days === 1
                  ? 'Yesterday'
                  : `${days}d ago`}
              </span>
              <span className="text-brand-dark/20">·</span>
              <span>{formatDate(client.lastContact)}</span>
            </div>
            {(client.proposals?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-xs text-brand-gold/80 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-2 py-0.5">
                <span>◈</span>
                <span>{client.proposals!.length}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Actions overlay */}
      {showActions && (
        <div className="absolute top-2 right-2 flex items-center gap-1 animate-fade-in">
          <button
            onClick={() => onEdit(client)}
            className="w-7 h-7 rounded-lg bg-white border border-brand-cream flex items-center justify-center text-brand-dark/60 hover:text-brand-dark hover:border-brand-cream-dark shadow-card transition-all text-xs"
            title="Edit"
          >
            ✏
          </button>
          {confirmDelete ? (
            <button
              onClick={() => onDelete(client.id)}
              className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center text-white shadow-card transition-all text-xs"
              title="Confirm delete"
            >
              ✓
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-7 h-7 rounded-lg bg-white border border-brand-cream flex items-center justify-center text-brand-dark/40 hover:text-red-500 hover:border-red-200 shadow-card transition-all text-xs"
              title="Delete"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {compact && (
        <div className="flex items-center gap-2 mt-2">
          <span className={`stage-badge ${stageCfg.bg} ${stageCfg.color} ${stageCfg.border} border text-xs`}>
            {client.stage}
          </span>
        </div>
      )}
    </div>
  );
}
