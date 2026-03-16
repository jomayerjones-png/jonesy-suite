import { useState, useEffect, useRef } from 'react';
import { Client, SavedProposal, PIPELINE_STAGES, generateId } from '../../types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

async function readPdfAsText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(text);
  }
  return pages.join('\n\n');
}

type ClientFormData = Omit<Client, 'id' | 'createdAt'>;

interface ClientModalProps {
  client?: Client | null;
  onSave: (data: ClientFormData) => void;
  onClose: () => void;
  onMarkLost?: (reason: string) => void;
  onReactivate?: () => void;
  onDeleteProposal?: (proposalId: string) => void;
  onAddProposal?: (proposal: SavedProposal) => void;
}

const DEFAULT_FORM: ClientFormData = {
  name: '',
  company: '',
  email: '',
  phone: '',
  value: 0,
  stage: 'Engaged',
  notes: '',
  lastContact: new Date().toISOString().split('T')[0],
  tags: [],
  proposals: [],
  industry: '',
  outcome: 'active',
  lostReason: '',
  stageHistory: [],
  documents: [],
};

function renderMarkdown(text: string): string {
  return text
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .trim();
}

function downloadProposalPdf(proposal: SavedProposal) {
  const html = renderMarkdown(proposal.content);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${proposal.title}</title><style>
    @page { margin: 1cm; size: A4; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; font-size: 10pt; line-height: 1.5; margin: 0; padding: 2cm; }
    h1 { font-size: 18pt; margin: 0 0 8pt; } h2 { font-size: 13pt; margin: 16pt 0 6pt; } h3 { font-size: 11pt; margin: 12pt 0 4pt; }
    ul, ol { padding-left: 1.2em; margin: 4pt 0; } li { margin: 2pt 0; }
    blockquote { border-left: 3px solid #d4af37; padding-left: 12pt; margin: 8pt 0; color: #555; }
    strong { font-weight: 600; } p { margin: 4pt 0; }
  </style></head><body><div class="prose-proposal">${html}</div></body></html>`);
  printWindow.document.close();
  setTimeout(() => { printWindow.focus(); printWindow.print(); }, 250);
}

function extractFirstLine(text: string): string {
  return (
    text
      .split('\n')
      .find(l => l.trim())
      ?.replace(/^#+\s*/, '')
      .trim() ?? 'Imported Proposal'
  );
}

// ── Import Proposal Modal ─────────────────────────────────────────────────────
function ImportProposalModal({
  clientName,
  onSave,
  onClose,
}: {
  clientName: string;
  onSave: (p: SavedProposal) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'paste' | 'file'>('paste');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadText = (content: string, filename?: string) => {
    setText(content);
    setTitle(
      content.split('\n').find(l => l.trim())?.replace(/^#+\s*/, '').trim() ??
      (filename ? filename.replace(/\.[^.]+$/, '') : 'Imported Proposal')
    );
    setError('');
  };

  const handleFile = async (file: File) => {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const text = await readPdfAsText(file);
        loadText(text, file.name);
      } catch {
        setError('Failed to read PDF. The file may be corrupted or password-protected.');
      }
      return;
    }
    if (!file.name.match(/\.(txt|md|markdown)$/i)) {
      setError('Please upload a .pdf, .txt, or .md file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => loadText(e.target?.result as string, file.name);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSave = () => {
    if (!text.trim()) { setError('Content cannot be empty.'); return; }
    onSave({
      id: generateId(),
      title: title.trim() || extractFirstLine(text),
      content: text,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-dark/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-brand-cream flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-display text-xl font-semibold text-brand-dark">Import Proposal</h2>
            <p className="text-xs text-brand-dark/50 mt-0.5">Attaching to <span className="font-medium">{clientName}</span></p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-brand-cream flex items-center justify-center text-brand-dark/50 hover:text-brand-dark transition-all"
          >
            ✕
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-brand-cream flex-shrink-0">
          {([
            { id: 'paste', label: 'Paste Text', icon: '⎘', desc: 'Copy & paste from Google Docs or anywhere' },
            { id: 'file',  label: 'Upload File', icon: '⬆', desc: 'Upload a .txt or .md file' },
          ] as const).map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setError(''); }}
              className={`flex-1 py-3 text-sm font-medium transition-all flex flex-col items-center gap-0.5 ${
                mode === m.id
                  ? 'text-brand-gold border-b-2 border-brand-gold bg-brand-gold/5'
                  : 'text-brand-dark/50 hover:text-brand-dark'
              }`}
            >
              <span className="text-base">{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Google Docs tip */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-3">
            <span className="text-blue-500 text-base flex-shrink-0 mt-0.5">📄</span>
            <div className="text-xs text-blue-700 leading-relaxed">
              <span className="font-semibold">From Google Docs:</span>{' '}
              {mode === 'paste'
                ? 'Select all text in your Google Doc (⌘A / Ctrl+A), copy it, then paste below.'
                : 'Open your Google Doc → File → Download → Plain Text (.txt), then upload the file below.'}
            </div>
          </div>

          {/* Paste mode */}
          {mode === 'paste' && (
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setError(''); }}
              placeholder="Paste your proposal content here…"
              rows={12}
              className="w-full px-3 py-2.5 bg-brand-light border border-brand-cream-dark rounded-lg text-sm text-brand-dark placeholder-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold resize-y font-sans leading-relaxed"
            />
          )}

          {/* File upload mode */}
          {mode === 'file' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                dragging
                  ? 'border-brand-gold bg-brand-gold/5'
                  : text
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-brand-cream-dark hover:border-brand-gold/50 hover:bg-brand-gold/5'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {text ? (
                <>
                  <span className="text-3xl">✓</span>
                  <p className="text-sm font-semibold text-emerald-700">File loaded</p>
                  <p className="text-xs text-brand-dark/50 text-center">{text.length.toLocaleString()} characters · click to replace</p>
                </>
              ) : (
                <>
                  <span className="text-3xl text-brand-dark/20">⬆</span>
                  <p className="text-sm font-semibold text-brand-dark/60">Drop file here or click to browse</p>
                  <p className="text-xs text-brand-dark/40">Accepts .pdf, .txt, and .md files</p>
                </>
              )}
            </div>
          )}

          {/* Title override */}
          {text && (
            <div>
              <label className="label">Proposal Title</label>
              <input
                className="input-field"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Auto-detected from first line…"
              />
              <p className="text-xs text-brand-dark/40 mt-1">Leave blank to use the first line of your document</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700 flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-brand-cream flex items-center justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Attach to Record
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Briefing Detail Row ──────────────────────────────────────────────────────
function BriefingRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-brand-dark/80 leading-relaxed whitespace-pre-line">{value}</p>
    </div>
  );
}

// ── Proposal Viewer ───────────────────────────────────────────────────────────
function ProposalViewer({
  proposal,
  onClose,
}: {
  proposal: SavedProposal;
  onClose: () => void;
}) {
  const [showBriefing, setShowBriefing] = useState(false);
  const b = proposal.briefing;
  const hasBriefing = b && (b.clientName || b.company || b.challenge || b.desiredOutcome);
  const hasNotes = !!proposal.clientNotes;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-brand-light">
      <div className="bg-brand-dark px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-brand-gold flex items-center justify-center">
            <span className="font-display text-brand-dark font-bold text-xs">J</span>
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-white">{proposal.title}</p>
            <p className="text-white/40 text-xs">
              {new Date(proposal.createdAt).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(hasBriefing || hasNotes) && (
            <button
              onClick={() => setShowBriefing(v => !v)}
              className={`btn-secondary text-xs py-1.5 flex items-center gap-1.5 ${showBriefing ? 'bg-brand-gold/10 border-brand-gold/30' : ''}`}
            >
              {showBriefing ? '◉ Hide Brief' : '◎ Briefing & Notes'}
            </button>
          )}
          <button onClick={() => downloadProposalPdf(proposal)} className="btn-secondary text-xs py-1.5">
            ↓ Download PDF
          </button>
          <button onClick={() => navigator.clipboard.writeText(proposal.content)} className="btn-secondary text-xs py-1.5">
            ⎘ Copy
          </button>
          <button onClick={onClose} className="btn-secondary text-xs py-1.5">✕ Close</button>
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold-dark flex-shrink-0" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Briefing & Notes panel */}
          {showBriefing && (hasBriefing || hasNotes) && (
            <div className="mb-8 card p-6 space-y-5 border-brand-gold/20 bg-brand-gold/5">
              <div className="flex items-center gap-2 pb-3 border-b border-brand-gold/20">
                <span className="text-brand-gold text-sm">◎</span>
                <h3 className="font-display text-base font-semibold text-brand-dark">Briefing Document & Notes</h3>
              </div>

              {b && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <BriefingRow label="Client" value={b.clientName} />
                  <BriefingRow label="Company" value={b.company} />
                  {b.industry && <BriefingRow label="Industry" value={b.industry} />}
                  {b.budget && <BriefingRow label="Budget Range" value={b.budget} />}
                  {b.timeline && <BriefingRow label="Timeline" value={b.timeline} />}
                </div>
              )}

              {b?.challenge && (
                <BriefingRow label="Core Challenge / Problem" value={b.challenge} />
              )}
              {b?.currentState && (
                <BriefingRow label="Current State" value={b.currentState} />
              )}
              {b?.desiredOutcome && (
                <BriefingRow label="Desired Outcome" value={b.desiredOutcome} />
              )}
              {b?.successMetrics && (
                <BriefingRow label="Success Metrics" value={b.successMetrics} />
              )}
              {b?.additionalContext && (
                <BriefingRow label="Additional Context" value={b.additionalContext} />
              )}

              {hasNotes && (
                <div className="pt-4 border-t border-brand-gold/20">
                  <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider mb-1">Pipeline Notes</p>
                  <p className="text-sm text-brand-dark/70 leading-relaxed whitespace-pre-line bg-white rounded-lg p-3 border border-brand-cream">
                    {proposal.clientNotes}
                  </p>
                </div>
              )}
            </div>
          )}

          <div
            className="prose-proposal"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.content) }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main ClientModal ──────────────────────────────────────────────────────────
export default function ClientModal({
  client,
  onSave,
  onClose,
  onMarkLost,
  onReactivate,
  onDeleteProposal,
  onAddProposal,
}: ClientModalProps) {
  const [tab, setTab] = useState<'details' | 'proposals'>('details');
  const [viewingProposal, setViewingProposal] = useState<SavedProposal | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showLostForm, setShowLostForm] = useState(false);
  const [lostReason, setLostReason] = useState('');

  const [form, setForm] = useState<ClientFormData>(
    client
      ? {
          name: client.name,
          company: client.company,
          email: client.email,
          phone: client.phone,
          value: client.value,
          stage: client.stage,
          notes: client.notes,
          lastContact: client.lastContact,
          tags: client.tags,
          proposals: client.proposals ?? [],
          industry: client.industry ?? '',
          outcome: client.outcome ?? 'active',
          lostReason: client.lostReason ?? '',
          stageHistory: client.stageHistory ?? [],
          documents: client.documents ?? [],
        }
      : DEFAULT_FORM
  );
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const set = <K extends keyof ClientFormData>(key: K, value: ClientFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.company.trim()) errs.company = 'Company is required';
    if (form.value < 0) errs.value = 'Value must be non-negative';
    if (!form.lastContact) errs.lastContact = 'Last contact date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSave(form);
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag && !form.tags.includes(tag)) set('tags', [...form.tags, tag]);
    setTagInput('');
  };

  const removeTag = (tag: string) => set('tags', form.tags.filter(t => t !== tag));

  const proposals = client?.proposals ?? [];
  const hasProposals = proposals.length > 0;

  const handleImportSave = (proposal: SavedProposal) => {
    onAddProposal?.(proposal);
    setShowImport(false);
  };

  return (
    <>
      {viewingProposal && (
        <ProposalViewer proposal={viewingProposal} onClose={() => setViewingProposal(null)} />
      )}
      {showImport && client && (
        <ImportProposalModal
          clientName={client.name}
          onSave={handleImportSave}
          onClose={() => setShowImport(false)}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-brand-cream flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-brand-dark">
                {client ? client.name : 'New Client'}
              </h2>
              <p className="text-xs text-brand-dark/50 mt-0.5">
                {client ? client.company : 'Add a new client to your pipeline'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-brand-cream flex items-center justify-center text-brand-dark/50 hover:text-brand-dark transition-all"
            >
              ✕
            </button>
          </div>

          {/* Tabs — only when editing */}
          {client && (
            <div className="flex border-b border-brand-cream">
              <button
                onClick={() => setTab('details')}
                className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                  tab === 'details'
                    ? 'text-brand-gold border-b-2 border-brand-gold'
                    : 'text-brand-dark/50 hover:text-brand-dark'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setTab('proposals')}
                className={`flex-1 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  tab === 'proposals'
                    ? 'text-brand-gold border-b-2 border-brand-gold'
                    : 'text-brand-dark/50 hover:text-brand-dark'
                }`}
              >
                Proposals
                {hasProposals && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-gold text-brand-dark text-xs font-bold">
                    {proposals.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Details tab */}
          {tab === 'details' && (
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Full Name *</label>
                    <input
                      className={`input-field ${errors.name ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                      placeholder="Sarah Chen"
                      autoFocus
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="label">Company *</label>
                    <input
                      className={`input-field ${errors.company ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                      value={form.company}
                      onChange={e => set('company', e.target.value)}
                      placeholder="TechFlow Inc."
                    />
                    {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input-field" value={form.email} onChange={e => set('email', e.target.value)} placeholder="sarah@company.com" />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input-field" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (415) 555-0192" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Deal Value ($) *</label>
                    <input
                      type="number" min="0"
                      className={`input-field ${errors.value ? 'border-red-400' : ''}`}
                      value={form.value || ''}
                      onChange={e => set('value', parseFloat(e.target.value) || 0)}
                      placeholder="50000"
                    />
                  </div>
                  <div>
                    <label className="label">Pipeline Stage</label>
                    <select className="input-field" value={form.stage} onChange={e => set('stage', e.target.value as Client['stage'])}>
                      {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Last Contact Date *</label>
                  <input
                    type="date"
                    className={`input-field ${errors.lastContact ? 'border-red-400' : ''}`}
                    value={form.lastContact}
                    onChange={e => set('lastContact', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="label">Industry</label>
                  <input className="input-field" value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="Media, Technology, Luxury, Automotive…" />
                </div>

                <div>
                  <label className="label">Notes</label>
                  <textarea className="input-field resize-none" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Key details, next steps, context..." />
                </div>

                <div>
                  <label className="label">Tags</label>
                  <div className="flex gap-2">
                    <input
                      className="input-field flex-1"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      placeholder="enterprise, brand, referral..."
                    />
                    <button type="button" onClick={addTag} className="btn-secondary px-3 flex-shrink-0">Add</button>
                  </div>
                  {form.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-cream text-brand-dark/70 text-xs border border-brand-cream-dark">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-brand-cream bg-brand-light/50 space-y-3">
                {/* Mark as lost */}
                {client && client.outcome !== 'lost' && onMarkLost && (
                  <div>
                    {showLostForm ? (
                      <div className="flex gap-2">
                        <input
                          className="input-field flex-1 text-sm"
                          value={lostReason}
                          onChange={e => setLostReason(e.target.value)}
                          placeholder="Reason for loss (optional)…"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => { onMarkLost(lostReason); }}
                          className="btn-danger flex-shrink-0 text-sm"
                        >
                          Confirm Lost
                        </button>
                        <button type="button" onClick={() => setShowLostForm(false)} className="btn-secondary flex-shrink-0 text-sm">Cancel</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setShowLostForm(true)} className="text-xs text-red-500/70 hover:text-red-600 underline">
                        Mark this deal as lost
                      </button>
                    )}
                  </div>
                )}
                {client && client.outcome === 'lost' && onReactivate && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <span className="text-xs text-red-600 flex-1">This deal is marked as lost{client.lostReason ? `: "${client.lostReason}"` : '.'}</span>
                    <button type="button" onClick={onReactivate} className="btn-secondary text-xs py-1">Reactivate</button>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">{client ? 'Save Changes' : 'Add Client'}</button>
                </div>
              </div>
            </form>
          )}

          {/* Proposals tab */}
          {tab === 'proposals' && client && (
            <div className="overflow-y-auto flex-1 flex flex-col">
              {/* Import bar */}
              <div className="px-4 pt-4 pb-3 border-b border-brand-cream flex items-center justify-between">
                <p className="text-xs text-brand-dark/50">
                  {proposals.length === 0 ? 'No proposals attached yet' : `${proposals.length} proposal${proposals.length > 1 ? 's' : ''} attached`}
                </p>
                <button
                  onClick={() => setShowImport(true)}
                  className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                >
                  <span>⬆</span> Import from Google Docs
                </button>
              </div>

              {proposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-8 flex-1">
                  <div className="w-14 h-14 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mb-4">
                    <span className="text-2xl text-brand-gold/50">◈</span>
                  </div>
                  <p className="font-display text-base font-semibold text-brand-dark mb-1">No proposals yet</p>
                  <p className="text-sm text-brand-dark/40 leading-relaxed mb-4">
                    Import from Google Docs, or generate one in the Proposal AI tab and attach it here.
                  </p>
                  <button onClick={() => setShowImport(true)} className="btn-secondary text-sm">
                    ⬆ Import Proposal
                  </button>
                </div>
              ) : (
                <div className="p-4 space-y-3 flex-1">
                  {[...proposals].reverse().map(p => (
                    <div key={p.id} className="card p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-gold/15 border border-brand-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-brand-gold text-sm">◈</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-brand-dark leading-snug line-clamp-2">{p.title}</p>
                        <p className="text-xs text-brand-dark/40 mt-0.5">
                          {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => setViewingProposal(p)} className="btn-secondary py-1 px-2.5 text-xs">View</button>
                        <button onClick={() => downloadProposalPdf(p)} className="btn-secondary py-1 px-2.5 text-xs">↓ PDF</button>
                        {confirmDeleteId === p.id ? (
                          <button
                            onClick={() => { onDeleteProposal?.(p.id); setConfirmDeleteId(null); }}
                            className="btn-danger py-1 px-2.5 text-xs"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="w-7 h-7 rounded-lg bg-white border border-brand-cream flex items-center justify-center text-brand-dark/30 hover:text-red-500 hover:border-red-200 transition-all text-xs"
                            title="Delete proposal"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 pb-4">
                <button onClick={onClose} className="btn-secondary w-full">Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
