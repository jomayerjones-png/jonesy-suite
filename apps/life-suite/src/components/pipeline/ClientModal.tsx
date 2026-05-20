import { useState, useEffect, useRef } from 'react';
import { Client, SavedProposal, ThreadMessage, MeetingNote, NewsArticle, PIPELINE_STAGES, generateId, formatCurrency, formatDate } from '../../types';
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
  defaultStage?: Client['stage'];
  onSave: (data: ClientFormData) => void;
  onClose: () => void;
  onMarkLost?: (reason: string) => void;
  onReactivate?: () => void;
  onDeleteProposal?: (proposalId: string) => void;
  onAddProposal?: (proposal: SavedProposal) => void;
  onUpdateProposal?: (proposalId: string, updates: Partial<SavedProposal>) => void;
  onUpdateThread?: (thread: ThreadMessage[]) => void;
  onUpdateMeetingNotes?: (notes: MeetingNote[]) => void;
  onUpdateNewsCache?: (cache: Client['newsCache']) => void;
}

const DEFAULT_FORM: ClientFormData = {
  name: '',
  company: '',
  email: '',
  phone: '',
  value: 500_000,
  stage: 'Engaged',
  notes: '',
  lastContact: new Date().toISOString().split('T')[0],
  tags: [],
  proposals: [],
  industry: '',
  outcome: 'active',
  lostReason: '',
  stageHistory: [],
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

function downloadProposalPdf(
  proposal: SavedProposal,
  opts: { suiteName: string; clientName?: string; clientCompany?: string },
) {
  const html = renderMarkdown(proposal.content);
  const client = opts.clientName || proposal.briefing?.clientName || '';
  const company = opts.clientCompany || proposal.briefing?.company || '';
  const clientInitial = (company || client || 'C').charAt(0).toUpperCase();
  const suiteInitial = opts.suiteName.charAt(0).toUpperCase();
  const date = new Date(proposal.createdAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${proposal.title}</title><style>
    @page { margin: 1.5cm 2cm 2cm 2cm; size: A4; }
    @page :first { margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 10pt; line-height: 1.65; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* ── Cover Page ── */
    .cover {
      height: 100vh; display: flex; flex-direction: column; justify-content: space-between;
      padding: 2.8cm 2.5cm 2cm; page-break-after: always;
    }
    .cover-top-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 48pt; }
    .cover-logo { display: flex; align-items: center; gap: 10pt; }
    .cover-logo-mark {
      width: 36pt; height: 36pt; background: #1a1a1a; border-radius: 4pt;
      display: flex; align-items: center; justify-content: center;
      font-size: 16pt; font-weight: 700; color: #d4af37; letter-spacing: 0;
    }
    .cover-logo-text { font-size: 13pt; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #1a1a1a; }
    .cover-client-logo { display: flex; align-items: center; gap: 8pt; }
    .cover-client-mark {
      width: 36pt; height: 36pt; background: #f5f5f0; border: 1.5pt solid #e0e0d8; border-radius: 4pt;
      display: flex; align-items: center; justify-content: center;
      font-size: 16pt; font-weight: 600; color: #888;
    }
    .cover-client-text { font-size: 10pt; color: #999; font-weight: 500; }
    .cover-rule { width: 60px; height: 2.5px; background: #d4af37; margin: 0 0 28pt; }
    .cover-title { font-size: 30pt; font-weight: 300; color: #1a1a1a; line-height: 1.2; margin-bottom: 14pt; }
    .cover-subtitle { font-size: 13pt; color: #666; font-weight: 400; }
    .cover-meta { border-top: 1px solid #e0e0e0; padding-top: 20pt; }
    .cover-meta-row { display: flex; gap: 48pt; margin-bottom: 8pt; }
    .cover-meta-label { font-size: 7.5pt; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #999; margin-bottom: 2pt; }
    .cover-meta-value { font-size: 10pt; color: #333; }
    .cover-confidential { font-size: 7pt; color: #bbb; letter-spacing: 1px; text-transform: uppercase; margin-top: 28pt; }

    /* ── Content Header (repeats visually at top of content) ── */
    .content-header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 10pt; border-bottom: 1px solid #e5e5e5; margin-bottom: 24pt;
    }
    .content-header-left { display: flex; align-items: center; gap: 8pt; }
    .content-header-mark {
      width: 22pt; height: 22pt; background: #1a1a1a; border-radius: 3pt;
      display: flex; align-items: center; justify-content: center;
      font-size: 10pt; font-weight: 700; color: #d4af37;
    }
    .content-header-brand { font-size: 8pt; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #b8962e; }
    .content-header-right { display: flex; align-items: center; gap: 8pt; }
    .content-header-client-mark {
      width: 22pt; height: 22pt; background: #f5f5f0; border: 1pt solid #e0e0d8; border-radius: 3pt;
      display: flex; align-items: center; justify-content: center;
      font-size: 10pt; font-weight: 600; color: #999;
    }
    .content-header-title { font-size: 8pt; color: #999; max-width: 200pt; text-align: right; }

    /* ── Prose ── */
    .prose h1 { font-size: 20pt; font-weight: 300; color: #1a1a1a; margin: 0 0 16pt; padding-bottom: 10pt; border-bottom: 2px solid #d4af37; }
    .prose h2 { font-size: 13pt; font-weight: 600; color: #1a1a1a; margin: 26pt 0 10pt; padding-bottom: 6pt; border-bottom: 1px solid #eee; }
    .prose h3 { font-size: 11pt; font-weight: 600; color: #333; margin: 18pt 0 6pt; }
    .prose p { margin: 6pt 0; color: #333; }
    .prose ul, .prose ol { padding-left: 1.4em; margin: 6pt 0; }
    .prose li { margin: 3pt 0; color: #333; }
    .prose blockquote { border-left: 3px solid #d4af37; padding: 8pt 16pt; margin: 12pt 0; background: #fafaf5; color: #555; font-style: italic; }
    .prose strong { font-weight: 600; color: #1a1a1a; }

    /* ── Footer ── */
    .content-footer { margin-top: 36pt; padding-top: 10pt; border-top: 1px solid #eee; display: flex; justify-content: space-between; font-size: 7pt; color: #bbb; }
  </style></head><body>
    <div class="cover">
      <div>
        <div class="cover-top-bar">
          <div class="cover-logo">
            <div class="cover-logo-mark">${suiteInitial}</div>
            <div class="cover-logo-text">${opts.suiteName}</div>
          </div>
          ${company ? `<div class="cover-client-logo">
            <div class="cover-client-text">${company}</div>
            <div class="cover-client-mark">${clientInitial}</div>
          </div>` : ''}
        </div>
        <div class="cover-rule"></div>
        <div class="cover-title">${proposal.title}</div>
        ${company ? `<div class="cover-subtitle">Prepared for ${company}</div>` : ''}
      </div>
      <div class="cover-meta">
        <div class="cover-meta-row">
          ${client ? `<div><div class="cover-meta-label">Prepared For</div><div class="cover-meta-value">${client}${company ? `, ${company}` : ''}</div></div>` : ''}
          <div><div class="cover-meta-label">Prepared By</div><div class="cover-meta-value">${opts.suiteName}</div></div>
          <div><div class="cover-meta-label">Date</div><div class="cover-meta-value">${date}</div></div>
        </div>
        <div class="cover-confidential">Confidential &mdash; For intended recipient only</div>
      </div>
    </div>
    <div class="content-header">
      <div class="content-header-left">
        <div class="content-header-mark">${suiteInitial}</div>
        <div class="content-header-brand">${opts.suiteName}</div>
      </div>
      <div class="content-header-right">
        <div class="content-header-title">${proposal.title}</div>
        ${company ? `<div class="content-header-client-mark">${clientInitial}</div>` : ''}
      </div>
    </div>
    <div class="prose">${html}</div>
    <div class="content-footer">
      <span>${opts.suiteName} &mdash; Confidential</span>
      <span>${date}</span>
    </div>
  </body></html>`);
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
  onUpdate,
}: {
  proposal: SavedProposal;
  onClose: () => void;
  onUpdate?: (updates: Partial<SavedProposal>) => void;
}) {
  const [showBriefing, setShowBriefing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(proposal.title);
  const [editContent, setEditContent] = useState(proposal.content);
  const b = proposal.briefing;
  const hasBriefing = b && (b.clientName || b.company || b.challenge || b.desiredOutcome);
  const hasNotes = !!proposal.clientNotes;
  const hasChanges = editTitle !== proposal.title || editContent !== proposal.content;

  const handleSave = () => {
    if (!editContent.trim()) return;
    onUpdate?.({
      title: editTitle.trim() || extractFirstLine(editContent),
      content: editContent,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(proposal.title);
    setEditContent(proposal.content);
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-brand-light">
      <div className="bg-brand-dark px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-brand-gold flex items-center justify-center">
            <span className="font-display text-white font-bold text-xs">L</span>
          </div>
          <div>
            {editing ? (
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm font-semibold text-white font-display focus:outline-none focus:ring-2 focus:ring-brand-gold/50 w-72"
                placeholder="Proposal title…"
              />
            ) : (
              <p className="font-display text-sm font-semibold text-white">{proposal.title}</p>
            )}
            <p className="text-white/40 text-xs">
              {new Date(proposal.createdAt).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={!editContent.trim() || !hasChanges}
                className="btn-primary text-xs py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
              <button onClick={handleCancel} className="btn-secondary text-xs py-1.5">Cancel</button>
            </>
          ) : (
            <>
              {(hasBriefing || hasNotes) && (
                <button
                  onClick={() => setShowBriefing(v => !v)}
                  className={`btn-secondary text-xs py-1.5 flex items-center gap-1.5 ${showBriefing ? 'bg-brand-gold/10 border-brand-gold/30' : ''}`}
                >
                  {showBriefing ? '◉ Hide Brief' : '◎ Briefing & Notes'}
                </button>
              )}
              {onUpdate && (
                <button onClick={() => setEditing(true)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
                  ✎ Edit
                </button>
              )}
              <button onClick={() => downloadProposalPdf(proposal, { suiteName: 'LIFE', clientName: proposal.briefing?.clientName, clientCompany: proposal.briefing?.company })} className="btn-secondary text-xs py-1.5">
                ↓ Download PDF
              </button>
              <button onClick={() => navigator.clipboard.writeText(proposal.content)} className="btn-secondary text-xs py-1.5">
                ⎘ Copy
              </button>
              <button onClick={onClose} className="btn-secondary text-xs py-1.5">✕ Close</button>
            </>
          )}
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold-dark flex-shrink-0" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Briefing & Notes panel */}
          {showBriefing && !editing && (hasBriefing || hasNotes) && (
            <div className="mb-8 card p-6 space-y-5 border-brand-gold/20 bg-brand-gold/5">
              <div className="flex items-center gap-2 pb-3 border-b border-brand-gold/20">
                <span className="text-brand-gold text-sm">◎</span>
                <h3 className="font-display text-base font-semibold text-brand-dark">Briefing Document & Notes</h3>
              </div>

              {b && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <BriefingRow label="Partner Contact" value={b.clientName} />
                  <BriefingRow label="Brand / Company" value={b.company} />
                  {b.industry && <BriefingRow label="Industry / Category" value={b.industry} />}
                  {b.budget && <BriefingRow label="Investment Level" value={b.budget} />}
                  {b.timeline && <BriefingRow label="Launch / Timeline" value={b.timeline} />}
                </div>
              )}

              {b?.challenge && (
                <BriefingRow label="Partnership Opportunity / Angle" value={b.challenge} />
              )}
              {b?.currentState && (
                <BriefingRow label="Brand's Current Context" value={b.currentState} />
              )}
              {b?.desiredOutcome && (
                <BriefingRow label="What Success Looks Like" value={b.desiredOutcome} />
              )}
              {b?.successMetrics && (
                <BriefingRow label="Key Deliverables / Inclusions" value={b.successMetrics} />
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

          {editing ? (
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full min-h-[60vh] px-4 py-3 bg-white border border-brand-cream rounded-lg text-sm text-brand-dark font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold resize-y"
              placeholder="Proposal content (Markdown supported)…"
            />
          ) : (
            <div
              className="prose-proposal"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.content) }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ClientModal ──────────────────────────────────────────────────────────
const INTEL_API_KEY = 'life_suite_intel_api_key';

export default function ClientModal({
  client,
  defaultStage = 'Engaged',
  onSave,
  onClose,
  onMarkLost,
  onReactivate,
  onDeleteProposal,
  onAddProposal,
  onUpdateProposal,
  onUpdateThread,
  onUpdateMeetingNotes,
  onUpdateNewsCache,
}: ClientModalProps) {
  const [tab, setTab] = useState<'details' | 'proposals' | 'notes' | 'intelligence'>('details');
  const [intelApiKey, setIntelApiKey] = useState(() => localStorage.getItem(INTEL_API_KEY) ?? '');
  const [intelInput, setIntelInput] = useState('');
  const [intelThread, setIntelThread] = useState<ThreadMessage[]>(() => client?.thread ?? []);
  const [intelStreaming, setIntelStreaming] = useState(false);
  const [intelError, setIntelError] = useState('');
  const intelEndRef = useRef<HTMLDivElement>(null);
  const intelTextareaRef = useRef<HTMLTextAreaElement>(null);

  // News state
  const [news, setNews] = useState<{ summary: string; articles: NewsArticle[] } | null>(
    client?.newsCache ? { summary: client.newsCache.summary, articles: client.newsCache.articles } : null
  );
  const [newsFetching, setNewsFetching] = useState(false);
  const [newsError, setNewsError] = useState('');

  // Meeting notes state
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>(() => client?.meetingNotes ?? []);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState({ date: new Date().toISOString().split('T')[0], attendees: '', notes: '', takeaways: '' });
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
        }
      : { ...DEFAULT_FORM, stage: defaultStage }
  );
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (tab === 'intelligence') intelEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [intelThread, tab]);

  // Auto-fetch news when Intel tab opens and API key is available but no cache
  useEffect(() => {
    if (tab === 'intelligence' && intelApiKey.trim() && !news && !newsFetching) {
      fetchNews();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const saveIntelApiKey = (key: string) => {
    setIntelApiKey(key);
    localStorage.setItem(INTEL_API_KEY, key);
  };

  const buildSystemPrompt = (): string => {
    if (!client) return '';
    const proposalSummary = (client.proposals ?? []).length > 0
      ? (client.proposals ?? []).map(p => `  - "${p.title}" (${formatDate(p.createdAt)})`).join('\n')
      : '  None yet';
    return `You are an intelligence assistant embedded in the LIFE Partnership Suite, helping the LIFE team manage their relationship with a specific partner contact. Your role is to provide strategic insights, draft communications, analyse deal status, and help prepare for meetings.

PARTNER CONTEXT:
- Name: ${client.name}
- Company: ${client.company}
- Deal Value: ${formatCurrency(client.value)}
- Pipeline Stage: ${client.stage}${client.industry ? `\n- Industry: ${client.industry}` : ''}
- Status: ${client.outcome}
- Last Contact: ${formatDate(client.lastContact)}
- Tags: ${client.tags.join(', ') || 'None'}
- Notes: ${client.notes || 'No notes yet'}

PROPOSALS:
${proposalSummary}

Be concise, strategic, and focused on helping close this partnership. When asked to draft emails or messages, write them ready to send. When analysing the deal, be direct about risks and next steps.${
  meetingNotes.length > 0
    ? `\n\nMEETING NOTES (most recent first):\n${[...meetingNotes].reverse().slice(0, 3).map(n =>
        `[${n.date}] Attendees: ${n.attendees || 'Not recorded'}\nNotes: ${n.notes}\nKey Takeaways: ${n.takeaways || 'None recorded'}`
      ).join('\n\n')}`
    : ''
}${
  news
    ? `\n\nLATEST NEWS SUMMARY:\n${news.summary}`
    : ''
}`;
  };

  const fetchNews = async () => {
    if (!client || !intelApiKey.trim()) {
      setNewsError('Enter your Anthropic API key to fetch news.');
      return;
    }
    setNewsFetching(true);
    setNewsError('');
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': intelApiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
          messages: [{
            role: 'user',
            content: `Search for the latest news (2025) about ${client.name} at ${client.company}${client.industry ? ` (${client.industry})` : ''}. Find 4-6 recent headlines covering brand campaigns, partnerships, executive moves, earnings, or major announcements. Then write a "Key Insights" paragraph explaining what this means for a LIFE magazine founding partnership pitch — specifically why this company and this person are well-timed targets right now.

Return ONLY a JSON object (no markdown fences, no prose outside it):
{"articles":[{"title":"...","source":"...","url":"..."}],"summary":"2-3 sentences of key insights for the LIFE pitch."}`
          }],
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `API error ${resp.status}`);
      }
      const data = await resp.json() as { content: { type: string; text?: string }[] };
      // Web search returns multiple content blocks — get the last text block (final answer)
      const textBlocks = data.content.filter(b => b.type === 'text' && b.text);
      const lastText = textBlocks[textBlocks.length - 1]?.text ?? '';
      if (!lastText) throw new Error('No text response from API');

      // Extract JSON — try fence first, then bare object
      const fenceMatch = lastText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const bareMatch = lastText.match(/\{[\s\S]*"articles"[\s\S]*\}/);
      const jsonStr = fenceMatch?.[1] ?? bareMatch?.[0] ?? null;
      if (!jsonStr) throw new Error('Could not parse news response — try refreshing');

      const parsed = JSON.parse(jsonStr.replace(/,\s*([}\]])/g, '$1')) as { articles: NewsArticle[]; summary: string };
      const cache: Client['newsCache'] = {
        fetchedAt: new Date().toISOString(),
        summary: parsed.summary,
        articles: parsed.articles ?? [],
      };
      setNews({ summary: parsed.summary, articles: parsed.articles ?? [] });
      onUpdateNewsCache?.(cache);
    } catch (e) {
      setNewsError(e instanceof Error ? e.message : 'Failed to fetch news');
    } finally {
      setNewsFetching(false);
    }
  };

  const saveMeetingNote = () => {
    if (!noteForm.notes.trim()) return;
    const note: MeetingNote = {
      id: generateId(),
      date: noteForm.date,
      attendees: noteForm.attendees,
      notes: noteForm.notes,
      takeaways: noteForm.takeaways,
      createdAt: new Date().toISOString(),
    };
    const updated = [note, ...meetingNotes];
    setMeetingNotes(updated);
    onUpdateMeetingNotes?.(updated);
    setNoteForm({ date: new Date().toISOString().split('T')[0], attendees: '', notes: '', takeaways: '' });
    setShowNoteForm(false);
  };

  const deleteMeetingNote = (id: string) => {
    const updated = meetingNotes.filter(n => n.id !== id);
    setMeetingNotes(updated);
    onUpdateMeetingNotes?.(updated);
  };

  const sendIntelMessage = async () => {
    if (!intelInput.trim() || intelStreaming) return;
    if (!intelApiKey.trim()) { setIntelError('Enter your Anthropic API key above to use Intelligence.'); return; }
    setIntelError('');

    const userMsg: ThreadMessage = {
      id: generateId(),
      role: 'user',
      content: intelInput.trim(),
      timestamp: new Date().toISOString(),
    };
    const updatedThread = [...intelThread, userMsg];
    setIntelThread(updatedThread);
    setIntelInput('');
    setIntelStreaming(true);

    const assistantId = generateId();
    const assistantMsg: ThreadMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    const streamingThread = [...updatedThread, assistantMsg];
    setIntelThread(streamingThread);

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': intelApiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 1024,
          stream: true,
          system: buildSystemPrompt(),
          messages: updatedThread
            .filter(m => m.content.trim().length > 0)
            .map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `API error ${resp.status}`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              accumulated += parsed.delta.text;
              setIntelThread(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: accumulated } : m
              ));
            }
          } catch { /* ignore parse errors */ }
        }
      }

      if (!accumulated.trim()) {
        throw new Error('Claude returned an empty response. Please try again.');
      }
      const finalThread = [...updatedThread, { ...assistantMsg, content: accumulated }];
      setIntelThread(finalThread);
      onUpdateThread?.(finalThread);
    } catch (e) {
      setIntelError(e instanceof Error ? e.message : 'An error occurred.');
      setIntelThread(updatedThread);
      onUpdateThread?.(updatedThread);
    } finally {
      setIntelStreaming(false);
    }
  };

  const clearIntelThread = () => {
    setIntelThread([]);
    onUpdateThread?.([]);
  };

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
        <ProposalViewer
          proposal={viewingProposal}
          onClose={() => setViewingProposal(null)}
          onUpdate={onUpdateProposal ? (updates) => {
            onUpdateProposal(viewingProposal.id, updates);
            setViewingProposal({ ...viewingProposal, ...updates });
          } : undefined}
        />
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
                    ? 'text-[#E8002D] border-b-2 border-[#E8002D]'
                    : 'text-brand-dark/50 hover:text-brand-dark'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setTab('proposals')}
                className={`flex-1 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  tab === 'proposals'
                    ? 'text-[#E8002D] border-b-2 border-[#E8002D]'
                    : 'text-brand-dark/50 hover:text-brand-dark'
                }`}
              >
                Proposals
                {hasProposals && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#E8002D] text-white text-xs font-bold">
                    {proposals.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab('notes')}
                className={`flex-1 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  tab === 'notes'
                    ? 'text-[#E8002D] border-b-2 border-[#E8002D]'
                    : 'text-brand-dark/50 hover:text-brand-dark'
                }`}
              >
                Call Notes
                {meetingNotes.length > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-dark/10 text-brand-dark/60 text-xs font-bold">
                    {meetingNotes.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab('intelligence')}
                className={`flex-1 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  tab === 'intelligence'
                    ? 'text-[#E8002D] border-b-2 border-[#E8002D]'
                    : 'text-brand-dark/50 hover:text-brand-dark'
                }`}
              >
                Intel
                {intelThread.length > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-dark/10 text-brand-dark/60 text-xs font-bold">
                    {intelThread.filter(m => m.role === 'assistant').length}
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
                      placeholder="Name"
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
                      placeholder="Company"
                    />
                    {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input-field" value={form.email} onChange={e => set('email', e.target.value)} placeholder="Email" />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input-field" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Phone" />
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
                        <button onClick={() => downloadProposalPdf(p, { suiteName: 'LIFE', clientName: form.name || p.briefing?.clientName, clientCompany: form.company || p.briefing?.company })} className="btn-secondary py-1 px-2.5 text-xs">↓ PDF</button>
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

          {/* Call Notes tab */}
          {tab === 'notes' && client && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-brand-cream">
                <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">Meeting Notes</p>
                <button
                  onClick={() => setShowNoteForm(v => !v)}
                  className="text-xs font-medium text-[#E8002D] hover:text-[#E8002D]/80 transition-colors"
                >
                  {showNoteForm ? 'Cancel' : '+ Add Note'}
                </button>
              </div>

              {showNoteForm && (
                <div className="px-4 py-3 border-b border-brand-cream bg-brand-light/40 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Date</label>
                      <input type="date" className="input-field text-sm" value={noteForm.date}
                        onChange={e => setNoteForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Attendees</label>
                      <input className="input-field text-sm" placeholder="Jo, Alex, Sarah…" value={noteForm.attendees}
                        onChange={e => setNoteForm(f => ({ ...f, attendees: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Notes</label>
                    <textarea className="input-field text-sm resize-none" rows={3} placeholder="What was discussed…"
                      value={noteForm.notes} onChange={e => setNoteForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Key Takeaways</label>
                    <textarea className="input-field text-sm resize-none" rows={2} placeholder="Decisions made, next steps…"
                      value={noteForm.takeaways} onChange={e => setNoteForm(f => ({ ...f, takeaways: e.target.value }))} />
                  </div>
                  <button onClick={saveMeetingNote} disabled={!noteForm.notes.trim()}
                    className="btn-primary w-full text-sm disabled:opacity-40">
                    Save Note
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {meetingNotes.length === 0 ? (
                  <p className="text-xs text-brand-dark/40 text-center py-6">No meeting notes yet. Click &ldquo;+ Add Note&rdquo; after each call.</p>
                ) : (
                  [...meetingNotes].sort((a, b) => b.date.localeCompare(a.date)).map(note => (
                    <div key={note.id} className="rounded-xl border border-brand-cream bg-white p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-brand-dark">{formatDate(note.date)}</span>
                        <button onClick={() => deleteMeetingNote(note.id)}
                          className="text-brand-dark/20 hover:text-red-500 text-xs transition-colors">✕</button>
                      </div>
                      {note.attendees && (
                        <p className="text-xs text-brand-dark/50"><span className="font-medium">Attendees:</span> {note.attendees}</p>
                      )}
                      <p className="text-xs text-brand-dark/80 leading-relaxed whitespace-pre-wrap">{note.notes}</p>
                      {note.takeaways && (
                        <div className="bg-brand-light rounded-lg px-2.5 py-1.5 mt-1">
                          <p className="text-xs font-medium text-brand-dark/50 mb-0.5">Key Takeaways</p>
                          <p className="text-xs text-brand-dark/70 leading-relaxed whitespace-pre-wrap">{note.takeaways}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="px-4 pb-4">
                <button onClick={onClose} className="btn-secondary w-full">Close</button>
              </div>
            </div>
          )}

          {/* Intelligence tab */}
          {tab === 'intelligence' && client && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* API key bar */}
              <div className="px-4 pt-3 pb-2.5 border-b border-brand-cream bg-brand-light/50">
                <div className="flex items-center gap-2">
                  <div className="bg-[#E8002D] px-1.5 py-0.5 flex-shrink-0">
                    <span className="font-display font-bold text-white text-xs tracking-tighter leading-none">LIFE</span>
                  </div>
                  <span className="text-xs text-brand-dark/50 flex-1">Partner Intelligence · Claude</span>
                  {intelThread.length > 0 && (
                    <button onClick={clearIntelThread} className="text-xs text-brand-dark/30 hover:text-red-500 transition-colors">
                      Clear thread
                    </button>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="password"
                    className="input-field flex-1 py-1.5 text-xs font-mono"
                    placeholder="sk-ant-… Anthropic API key"
                    value={intelApiKey}
                    onChange={e => saveIntelApiKey(e.target.value)}
                  />
                </div>
              </div>

              {/* News feed */}
              <div className="px-4 pt-3 pb-2.5 border-b border-brand-cream">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wider">Latest News</p>
                  <button
                    onClick={fetchNews}
                    disabled={newsFetching}
                    className="text-xs font-medium text-[#E8002D] hover:text-[#E8002D]/80 disabled:opacity-40 transition-colors"
                  >
                    {newsFetching ? 'Fetching…' : news ? '↻ Refresh' : '↓ Fetch News'}
                  </button>
                </div>
                {newsError && <p className="text-xs text-red-500 mb-1">{newsError}</p>}
                {news ? (
                  <div className="space-y-2">
                    <div className="bg-brand-light rounded-lg px-2.5 py-2">
                      <p className="text-xs font-medium text-brand-dark/50 mb-0.5">Key Insights</p>
                      <p className="text-xs text-brand-dark/80 leading-relaxed">{news.summary}</p>
                    </div>
                    <div className="space-y-1">
                      {news.articles.map((a, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-[10px] font-bold text-brand-dark/30 mt-0.5 flex-shrink-0">{a.source}</span>
                          {a.url ? (
                            <a href={a.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-brand-dark/70 hover:text-[#E8002D] leading-snug transition-colors">
                              {a.title}
                            </a>
                          ) : (
                            <span className="text-xs text-brand-dark/70 leading-snug">{a.title}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {client.newsCache?.fetchedAt && (
                      <p className="text-[10px] text-brand-dark/30">
                        Updated {formatDate(client.newsCache.fetchedAt.split('T')[0])}
                      </p>
                    )}
                  </div>
                ) : !newsFetching && (
                  <p className="text-xs text-brand-dark/40">Click &ldquo;Fetch News&rdquo; to load latest headlines for {client.company}.</p>
                )}
              </div>

              {/* Context summary */}
              {intelThread.length === 0 && (
                <div className="px-4 pt-3 pb-2 border-b border-brand-cream">
                  <p className="text-xs text-brand-dark/40 font-medium uppercase tracking-wider mb-2">Partner Context</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-brand-dark/60">
                    <span><span className="font-medium">Company:</span> {client.company}</span>
                    <span><span className="font-medium">Stage:</span> {client.stage}</span>
                    <span><span className="font-medium">Value:</span> {formatCurrency(client.value)}</span>
                    <span><span className="font-medium">Proposals:</span> {(client.proposals ?? []).length}</span>
                  </div>
                  <p className="text-xs text-brand-dark/40 mt-2 leading-relaxed">Ask anything about this partner — draft an email, analyse deal status, prepare for a meeting, or get next-step recommendations.</p>
                </div>
              )}

              {/* Thread */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {intelThread.map(msg => (
                  <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${
                      msg.role === 'user' ? 'bg-brand-dark text-white' : 'bg-[#E8002D] text-white'
                    }`}>
                      {msg.role === 'user' ? 'U' : 'L'}
                    </div>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand-dark text-white rounded-tr-sm'
                        : 'bg-brand-cream text-brand-dark rounded-tl-sm'
                    }`}>
                      {msg.content || <span className="opacity-50 animate-pulse">Thinking…</span>}
                    </div>
                  </div>
                ))}
                {intelError && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{intelError}</p>
                )}
                <div ref={intelEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 pb-4 pt-2 border-t border-brand-cream">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={intelTextareaRef}
                    className="input-field flex-1 resize-none text-sm py-2"
                    rows={2}
                    placeholder="Ask about this partner…"
                    value={intelInput}
                    onChange={e => setIntelInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendIntelMessage(); }
                    }}
                    disabled={intelStreaming}
                  />
                  <button
                    onClick={sendIntelMessage}
                    disabled={intelStreaming || !intelInput.trim()}
                    className="btn-primary py-2 px-4 text-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {intelStreaming ? '…' : '↑'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
