import { Client, PipelineStage, PIPELINE_STAGES } from '../../types';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, stage: PipelineStage) => void;
}

export default function KanbanBoard({ clients, onEdit, onDelete, onMove }: KanbanBoardProps) {
  return (
    <div className="flex gap-3 pb-4 min-w-max">
      {PIPELINE_STAGES.map(stage => (
        <KanbanColumn
          key={stage}
          stage={stage}
          clients={clients.filter(c => c.stage === stage)}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          onDrop={onMove}
        />
      ))}
    </div>
  );
}
