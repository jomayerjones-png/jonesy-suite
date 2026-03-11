import { useState, useEffect } from 'react';
import { Client, PIPELINE_STAGES } from '../../types';

type ClientFormData = Omit<Client, 'id' | 'createdAt'>;

interface ClientModalProps {
  client?: Client | null;
  onSave: (data: ClientFormData) => void;
  onClose: () => void;
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
};

export default function ClientModal({ client, onSave, onClose }: ClientModalProps) {
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

  return (
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
              {client ? 'Edit Client' : 'New Client'}
            </h2>
            <p className="text-xs text-brand-dark/50 mt-0.5">
              {client ? `Updating ${client.name}` : 'Add a new client to your pipeline'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-brand-cream flex items-center justify-center text-brand-dark/50 hover:text-brand-dark transition-all"
          >
            ✕
          </button>
        </div>

        {/* Form */}
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
      </div>
    </div>
  );
}
