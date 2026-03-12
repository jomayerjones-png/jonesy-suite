import { useState, useRef, useCallback } from 'react';
import { Client, ProjectDocument, generateId, formatCurrency } from '../../types';

interface LiveProjectsProps {
  clients: Client[];
  onUpdateClient: (id: string, updates: Partial<Client>) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function LiveProjects({ clients, onUpdateClient }: LiveProjectsProps) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const soldClients = clients.filter(c => c.outcome === 'won' || c.stage === 'Close');

  const handleFiles = useCallback((projectId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const client = clients.find(c => c.id === projectId);
    if (!client) return;

    const readers: Promise<ProjectDocument>[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      readers.push(
        new Promise<ProjectDocument>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              id: generateId(),
              name: file.name,
              size: file.size,
              type: file.type,
              dataUrl: reader.result as string,
              uploadedAt: new Date().toISOString(),
            });
          };
          reader.readAsDataURL(file);
        })
      );
    }

    Promise.all(readers).then((newDocs) => {
      onUpdateClient(projectId, {
        documents: [...(client.documents ?? []), ...newDocs],
      });
    });
  }, [clients, onUpdateClient]);

  const removeDocument = (projectId: string, docId: string) => {
    const client = clients.find(c => c.id === projectId);
    if (!client) return;
    onUpdateClient(projectId, {
      documents: (client.documents ?? []).filter(d => d.id !== docId),
    });
  };

  const downloadDocument = (doc: ProjectDocument) => {
    const a = document.createElement('a');
    a.href = doc.dataUrl;
    a.download = doc.name;
    a.click();
  };

  const handleDrop = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    setDragOverId(null);
    handleFiles(projectId, e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    setDragOverId(projectId);
  };

  const openFilePicker = (projectId: string) => {
    uploadTargetRef.current = projectId;
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadTargetRef.current) {
      handleFiles(uploadTargetRef.current, e.target.files);
      e.target.value = '';
    }
  };

  const getDocIcon = (type: string): string => {
    if (type.startsWith('image/')) return '🖼';
    if (type.includes('pdf')) return '📕';
    if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return '📊';
    if (type.includes('presentation') || type.includes('powerpoint')) return '📽';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('zip') || type.includes('compressed')) return '📦';
    return '📄';
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-brand-dark mb-1">Live Projects</h1>
        <p className="text-brand-dark/50 text-sm">
          {soldClients.length} sold project{soldClients.length !== 1 ? 's' : ''} — drop important documents into each project folder.
        </p>
      </div>

      {soldClients.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-brand-cream shadow-card">
          <div className="text-4xl mb-4 opacity-30">◆</div>
          <h2 className="font-display text-lg font-semibold text-brand-dark/60 mb-2">No live projects yet</h2>
          <p className="text-brand-dark/40 text-sm max-w-sm mx-auto">
            When deals reach the Close stage or are marked as won, they'll appear here as live project folders.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {soldClients.map(client => {
            const isOpen = openProjectId === client.id;
            const docs = client.documents ?? [];
            const isDragOver = dragOverId === client.id;

            return (
              <div
                key={client.id}
                className={`bg-white rounded-xl border transition-all duration-150 ${
                  isDragOver
                    ? 'border-brand-gold shadow-gold'
                    : 'border-brand-cream shadow-card hover:shadow-card-hover'
                }`}
                onDrop={(e) => handleDrop(e, client.id)}
                onDragOver={(e) => handleDragOver(e, client.id)}
                onDragLeave={() => setDragOverId(null)}
              >
                {/* Project header row */}
                <button
                  onClick={() => setOpenProjectId(isOpen ? null : client.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left group"
                >
                  {/* Folder icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors ${
                    isOpen ? 'bg-brand-gold/20 text-brand-gold-dark' : 'bg-brand-cream text-brand-dark/40 group-hover:bg-brand-gold/10'
                  }`}>
                    {isOpen ? '📂' : '📁'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-brand-dark truncate">{client.company}</h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Won
                      </span>
                    </div>
                    <p className="text-brand-dark/45 text-sm truncate">{client.name} · {formatCurrency(client.value)}</p>
                  </div>

                  {/* Doc count + chevron */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {docs.length > 0 && (
                      <span className="text-xs text-brand-dark/40 bg-brand-cream rounded-full px-2.5 py-1">
                        {docs.length} doc{docs.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className={`text-brand-dark/30 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}>
                      ▸
                    </span>
                  </div>
                </button>

                {/* Expanded folder content */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-brand-cream/60 animate-fade-in">
                    {/* Drop zone */}
                    <div
                      className={`mt-4 mb-4 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        isDragOver
                          ? 'border-brand-gold bg-brand-gold/5'
                          : 'border-brand-cream-dark hover:border-brand-gold/50 hover:bg-brand-gold/5'
                      }`}
                      onClick={() => openFilePicker(client.id)}
                    >
                      <div className="text-2xl mb-2 opacity-40">{isDragOver ? '📥' : '📎'}</div>
                      <p className="text-sm text-brand-dark/50 font-medium">
                        {isDragOver ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
                      </p>
                      <p className="text-xs text-brand-dark/30 mt-1">PDFs, images, spreadsheets, documents</p>
                    </div>

                    {/* Document list */}
                    {docs.length === 0 ? (
                      <p className="text-sm text-brand-dark/30 text-center py-2">No documents yet</p>
                    ) : (
                      <ul className="space-y-2">
                        {docs.map(doc => (
                          <li
                            key={doc.id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-brand-light/60 hover:bg-brand-cream/50 transition-colors group/doc"
                          >
                            <span className="text-lg flex-shrink-0">{getDocIcon(doc.type)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-brand-dark truncate">{doc.name}</p>
                              <p className="text-xs text-brand-dark/35">
                                {formatFileSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover/doc:opacity-100 transition-opacity">
                              <button
                                onClick={() => downloadDocument(doc)}
                                className="p-1.5 rounded-md hover:bg-brand-cream text-brand-dark/40 hover:text-brand-dark/70 text-xs"
                                title="Download"
                              >
                                ↓
                              </button>
                              <button
                                onClick={() => removeDocument(client.id, doc.id)}
                                className="p-1.5 rounded-md hover:bg-red-50 text-brand-dark/40 hover:text-red-500 text-xs"
                                title="Remove"
                              >
                                ✕
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
