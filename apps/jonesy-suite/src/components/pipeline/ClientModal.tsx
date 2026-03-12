import { useState, useEffect } from 'react';
import { Client, SavedProposal, PIPELINE_STAGES } from '../../types';

type ClientFormData = Omit<Client, 'id' | 'createdAt'>;

interface ClientModalProps {
  client?: Client | null;
  onSave: (data: ClientFormData) => void;
  onClose: () => void;
  onDeleteProposal?: (proposalId: string) => void;
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

function ProposalViewer({
  proposal,
  onClose,
}: {
  proposal: SavedProposal;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-brand-light">
      {/* Toolbar */}
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
          <button
            onClick={() => navigator.clipboard.writeText(proposal.content)}
            className="btn-secondary text-xs py-1.5"
          >
            ⎘ Copy
          </button>
          <button onClick={onClose} className="btn-secondary text-xs py-1.5">
            ✕ Close
          </button>
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold-dark flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          <div
            className="prose-proposal"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.content) }}
          />
        </div>
      </div>
    </div>
  );
}

export default function ClientModal({ client, onSave, onClose, onDeleteProposal }: ClientModalProps) {
  const [tab, setTab] = useState<'details' | 'proposals'>('details');
  const [viewingProposal, setViewingProposal] = useState<SavedProposal | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    if (tag && !form.tags.includes(tag)) {
      set('tags', [...form.tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    set('tags', form.tags.filter(t => t !== tag));
  };

  const proposals = client?.proposals ?? [];
  const hasProposals = proposals.length > 0;

  return (
    <>
      {viewingProposal && (
        <ProposalViewer
          proposal={viewingProposal}
          onClose={() => setViewingProposal(null)}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm"
          onClick={onClose}
        />
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

          {/* Tabs — only shown when editing an existing client */}
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

          {/* Details tab / new client form */}
          {tab === 'details' && (
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              <div className="px-6 py-5 space-y-4">
                {/* Name & Company row */}
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

                {/* Email & Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      className="input-field"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="sarah@company.com"
                    />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input
                      className="input-field"
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      placeholder="+1 (415) 555-0192"
                    />
                  </div>
                </div>

                {/* Value & Stage */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Deal Value ($) *</label>
                    <input
                      type="number"
                      min="0"
                      className={`input-field ${errors.value ? 'border-red-400' : ''}`}
                      value={form.value || ''}
                      onChange={e => set('value', parseFloat(e.target.value) || 0)}
                      placeholder="50000"
                    />
                  </div>
                  <div>
                    <label className="label">Pipeline Stage</label>
                    <select
                      className="input-field"
                      value={form.stage}
                      onChange={e => set('stage', e.target.value as Client['stage'])}
                    >
                      {PIPELINE_STAGES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Last Contact */}
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

                {/* Notes */}
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    placeholder="Key details, next steps, context..."
                  />
                </div>

                {/* Tags */}
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
                    <button
                      type="button"
                      onClick={addTag}
                      className="btn-secondary px-3 flex-shrink-0"
                    >
                      Add
                    </button>
                  </div>
                  {form.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-cream text-brand-dark/70 text-xs border border-brand-cream-dark"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-red-500 transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-brand-cream bg-brand-light/50 flex items-center justify-end gap-3">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {client ? 'Save Changes' : 'Add Client'}
                </button>
              </div>
            </form>
          )}

          {/* Proposals tab */}
          {tab === 'proposals' && client && (
            <div className="overflow-y-auto flex-1">
              {proposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                  <div className="w-14 h-14 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mb-4">
                    <span className="text-2xl text-brand-gold/50">◈</span>
                  </div>
                  <p className="font-display text-base font-semibold text-brand-dark mb-1">No proposals yet</p>
                  <p className="text-sm text-brand-dark/40 leading-relaxed">
                    Generate a proposal in the Proposal AI tab, then use "Attach to Client" to save it here.
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {[...proposals].reverse().map(p => (
                    <div
                      key={p.id}
                      className="card p-4 flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-brand-gold/15 border border-brand-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-brand-gold text-sm">◈</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-brand-dark leading-snug line-clamp-2">
                          {p.title}
                        </p>
                        <p className="text-xs text-brand-dark/40 mt-0.5">
                          {new Date(p.createdAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setViewingProposal(p)}
                          className="btn-secondary py-1 px-2.5 text-xs"
                        >
                          View
                        </button>
                        {confirmDeleteId === p.id ? (
                          <button
                            onClick={() => {
                              onDeleteProposal?.(p.id);
                              setConfirmDeleteId(null);
                            }}
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
                <button onClick={onClose} className="btn-secondary w-full">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
