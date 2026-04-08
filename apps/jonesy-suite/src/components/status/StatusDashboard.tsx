import { useState } from 'react';
import { Client, generateId, formatCurrency } from '../../types';

const KEY_BRIEF        = 'jonesy_status_brief';
const KEY_DELIVERABLES = 'jonesy_status_deliverables';
const KEY_ACTIVITY     = 'jonesy_status_activity';
const KEY_CONTACTS     = 'jonesy_status_contacts';

type DelivStatus = 'todo' | 'in-progress' | 'done';

interface Deliverable {
  id: string;
  title: string;
  status: DelivStatus;
  dueDate?: string;
  owner?: string;
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  type: 'note' | 'meeting' | 'call' | 'email' | 'milestone';
  content: string;
}

interface KeyContact {
  id: string;
  name: string;
  role: string;
  email?: string;
}

const TYPE_CONFIG: Record<ActivityEntry['type'], { icon: string; color: string; label: string }> = {
  note:      { icon: '◎', color: 'text-brand-dark/50', label: 'Note' },
  meeting:   { icon: '◆', color: 'text-purple-600',    label: 'Meeting' },
  call:      { icon: '◉', color: 'text-blue-600',      label: 'Call' },
  email:     { icon: '◈', color: 'text-amber-600',     label: 'Email' },
  milestone: { icon: '★', color: 'text-brand-gold',    label: 'Milestone' },
};

const STATUS_CONFIG: Record<DelivStatus, { label: string; color: string; bg: string }> = {
  'todo':        { label: 'To Do',       color: 'text-gray-500',   bg: 'bg-gray-100' },
  'in-progress': { label: 'In Progress', color: 'text-amber-700',  bg: 'bg-amber-50' },
  'done':        { label: 'Done',        color: 'text-emerald-700',bg: 'bg-emerald-50' },
};

function formatTs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

interface Props { clients: Client[]; }

export default function StatusDashboard({ clients }: Props) {
  const statusClient = clients.find(c => c.company.toUpperCase() === 'STATUS') ?? null;

  const [brief, setBrief] = useState(() => localStorage.getItem(KEY_BRIEF) ?? '');

  const [deliverables, setDeliverables] = useState<Deliverable[]>(() => {
    try { const s = localStorage.getItem(KEY_DELIVERABLES); if (s) return JSON.parse(s); } catch {}
    return [] as Deliverable[];
  });

  const [activity, setActivity] = useState<ActivityEntry[]>(() => {
    try { const s = localStorage.getItem(KEY_ACTIVITY); if (s) return JSON.parse(s); } catch {}
    return [] as ActivityEntry[];
  });

  const [contacts, setContacts] = useState<KeyContact[]>(() => {
    try { const s = localStorage.getItem(KEY_CONTACTS); if (s) return JSON.parse(s); } catch {}
    return [] as KeyContact[];
  });

  const [newNote, setNewNote]     = useState('');
  const [noteType, setNoteType]   = useState<ActivityEntry['type']>('note');
  const [newDeliv, setNewDeliv]   = useState('');
  const [newContact, setNewContact] = useState({ name: '', role: '', email: '' });
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingBrief, setEditingBrief] = useState(false);
  const [briefDraft, setBriefDraft] = useState(brief);

  const saveBrief = (val: string) => {
    setBrief(val); setBriefDraft(val);
    localStorage.setItem(KEY_BRIEF, val);
    setEditingBrief(false);
  };

  const saveDeliverables = (items: Deliverable[]) => {
    setDeliverables(items);
    localStorage.setItem(KEY_DELIVERABLES, JSON.stringify(items));
  };

  const saveActivity = (items: ActivityEntry[]) => {
    setActivity(items);
    localStorage.setItem(KEY_ACTIVITY, JSON.stringify(items));
  };

  const saveContacts = (items: KeyContact[]) => {
    setContacts(items);
    localStorage.setItem(KEY_CONTACTS, JSON.stringify(items));
  };

  const addActivity = () => {
    if (!newNote.trim()) return;
    const entry: ActivityEntry = { id: generateId(), timestamp: new Date().toISOString(), type: noteType, content: newNote.trim() };
    saveActivity([entry, ...activity]);
    setNewNote('');
  };

  const addDeliverable = () => {
    if (!newDeliv.trim()) return;
    saveDeliverables([...deliverables, { id: generateId(), title: newDeliv.trim(), status: 'todo' }]);
    setNewDeliv('');
  };

  const cycleStatus = (id: string) => {
    const order: DelivStatus[] = ['todo', 'in-progress', 'done'];
    saveDeliverables(deliverables.map(d => {
      if (d.id !== id) return d;
      const next = order[(order.indexOf(d.status) + 1) % order.length];
      return { ...d, status: next };
    }));
  };

  const addContact = () => {
    if (!newContact.name.trim()) return;
    saveContacts([...contacts, { id: generateId(), ...newContact }]);
    setNewContact({ name: '', role: '', email: '' });
    setShowAddContact(false);
  };

  const doneCount = deliverables.filter(d => d.status === 'done').length;
  const activeDate = statusClient?.createdAt;
  const proposals  = statusClient?.proposals ?? [];

  return (
    <div className="min-h-full bg-brand-light">
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ── Hero header ── */}
      <div className="bg-brand-dark px-8 pt-8 pb-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest mb-2 font-medium">Client Dashboard</p>
              <div className="flex items-baseline gap-4">
                <h1 className="font-display text-5xl font-bold text-white tracking-tight leading-none">STATUS</h1>
                <span className="bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30 tracking-wide">
                  ACTIVE CLIENT
                </span>
              </div>
              <p className="text-white/40 text-sm mt-2">
                Managed by Jonesy&amp;Co
                {activeDate && ` · Client since ${new Date(activeDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
              </p>
            </div>
            <button onClick={() => window.print()} className="no-print text-white/30 hover:text-white/70 transition-colors text-sm flex items-center gap-1.5 mt-2">
              <span>⎙</span> Export
            </button>
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-8 mt-6 pt-6 border-t border-white/10 pb-6">
            {[
              { label: 'Contract Value', value: statusClient ? formatCurrency(statusClient.value) : '—', gold: true },
              { label: 'Days Active', value: activeDate ? String(daysSince(activeDate)) : '—', gold: false },
              { label: 'Deliverables', value: `${doneCount} / ${deliverables.length}`, gold: false },
              { label: 'Proposals', value: String(proposals.length), gold: false },
              { label: 'Last Activity', value: activity.length ? daysSince(activity[0].timestamp) + 'd ago' : '—', gold: false },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-8">
                {i > 0 && <div className="w-px h-10 bg-white/10" />}
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider font-medium">{s.label}</p>
                  <p className={`font-display text-2xl font-bold mt-0.5 ${s.gold ? 'text-brand-gold' : 'text-white'}`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-8">

          {/* ── Left column (2/3) ── */}
          <div className="col-span-2 space-y-6">

            {/* Brief / Overview */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-dark/40">Client Brief</h2>
                {!editingBrief && (
                  <button
                    onClick={() => { setBriefDraft(brief); setEditingBrief(true); }}
                    className="no-print text-xs text-brand-dark/30 hover:text-brand-gold transition-colors"
                  >
                    ✏ Edit
                  </button>
                )}
              </div>
              {editingBrief ? (
                <div>
                  <textarea
                    autoFocus
                    value={briefDraft}
                    onChange={e => setBriefDraft(e.target.value)}
                    className="w-full text-sm text-brand-dark leading-relaxed bg-brand-light border border-brand-cream rounded-lg p-3 outline-none focus:border-brand-gold resize-none"
                    rows={6}
                    placeholder="Describe the client relationship, goals, key context, and current status..."
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => saveBrief(briefDraft)} className="btn-primary text-xs py-1.5 px-3">Save</button>
                    <button onClick={() => setEditingBrief(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                  </div>
                </div>
              ) : (
                <p
                  className="text-sm text-brand-dark/70 leading-relaxed whitespace-pre-wrap cursor-text"
                  onClick={() => { setBriefDraft(brief); setEditingBrief(true); }}
                >
                  {brief || <span className="text-brand-dark/25 italic">Click to add client brief and context…</span>}
                </p>
              )}
            </div>

            {/* Activity Log */}
            <div className="card p-6">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-dark/40 mb-4">Activity Log</h2>

              {/* Add entry */}
              <div className="no-print flex gap-2 mb-5">
                <select
                  value={noteType}
                  onChange={e => setNoteType(e.target.value as ActivityEntry['type'])}
                  className="input-field w-28 text-xs py-1.5"
                >
                  <option value="note">Note</option>
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="milestone">Milestone</option>
                </select>
                <input
                  className="input-field flex-1 text-sm"
                  placeholder="Log a meeting, call, note, or milestone…"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addActivity()}
                />
                <button onClick={addActivity} className="btn-primary text-sm px-4">+ Add</button>
              </div>

              {activity.length === 0 ? (
                <p className="text-brand-dark/25 text-sm italic">No activity logged yet.</p>
              ) : (
                <div className="space-y-1">
                  {activity.map(entry => {
                    const cfg = TYPE_CONFIG[entry.type];
                    return (
                      <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-brand-cream last:border-0 group">
                        <span className={`text-base flex-shrink-0 mt-0.5 ${cfg.color}`}>{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-brand-dark leading-snug">{entry.content}</p>
                          <p className="text-xs text-brand-dark/35 mt-0.5">
                            <span className="font-medium">{cfg.label}</span> · {formatTs(entry.timestamp)}
                          </p>
                        </div>
                        <button
                          onClick={() => saveActivity(activity.filter(a => a.id !== entry.id))}
                          className="no-print opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-brand-dark/25 hover:text-red-500 transition-all text-xs flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Proposals */}
            {proposals.length > 0 && (
              <div className="card p-6">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-dark/40 mb-4">Proposals</h2>
                <div className="space-y-2">
                  {proposals.map(p => (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-brand-cream last:border-0">
                      <span className="text-brand-gold">◈</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-brand-dark">{p.title}</p>
                        <p className="text-xs text-brand-dark/40">
                          {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column (1/3) ── */}
          <div className="space-y-6">

            {/* Deliverables */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-dark/40">Deliverables</h2>
                {deliverables.length > 0 && (
                  <span className="text-xs text-brand-dark/35">{doneCount}/{deliverables.length}</span>
                )}
              </div>

              {/* Progress bar */}
              {deliverables.length > 0 && (
                <div className="h-1 bg-brand-cream rounded-full mb-4 overflow-hidden">
                  <div
                    className="h-full bg-brand-gold rounded-full transition-all duration-500"
                    style={{ width: `${(doneCount / deliverables.length) * 100}%` }}
                  />
                </div>
              )}

              {/* Add */}
              <div className="no-print flex gap-1.5 mb-3">
                <input
                  className="input-field flex-1 text-xs py-1.5"
                  placeholder="New deliverable…"
                  value={newDeliv}
                  onChange={e => setNewDeliv(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDeliverable()}
                />
                <button onClick={addDeliverable} className="btn-primary text-xs py-1.5 px-2.5">+</button>
              </div>

              {deliverables.length === 0 ? (
                <p className="text-brand-dark/25 text-xs italic">No deliverables yet.</p>
              ) : (
                <div className="space-y-2">
                  {deliverables.map(item => {
                    const cfg = STATUS_CONFIG[item.status];
                    return (
                      <div key={item.id} className="flex items-center gap-2 group">
                        <button
                          onClick={() => cycleStatus(item.id)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 transition-all ${cfg.bg} ${cfg.color} hover:opacity-80`}
                          title="Click to advance status"
                        >
                          {cfg.label}
                        </button>
                        <span className={`text-xs flex-1 min-w-0 leading-snug ${item.status === 'done' ? 'line-through text-brand-dark/30' : 'text-brand-dark/80'}`}>
                          {item.title}
                        </span>
                        <button
                          onClick={() => saveDeliverables(deliverables.filter(d => d.id !== item.id))}
                          className="no-print opacity-0 group-hover:opacity-100 text-brand-dark/20 hover:text-red-500 transition-all text-xs flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Key Contacts */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-dark/40">Key Contacts</h2>
                <button
                  onClick={() => setShowAddContact(v => !v)}
                  className="no-print text-xs text-brand-dark/30 hover:text-brand-gold transition-colors"
                >
                  + Add
                </button>
              </div>

              {showAddContact && (
                <div className="no-print space-y-2 mb-3 p-3 bg-brand-light rounded-lg border border-brand-cream">
                  <input className="input-field w-full text-xs py-1.5" placeholder="Name" value={newContact.name} onChange={e => setNewContact(c => ({ ...c, name: e.target.value }))} />
                  <input className="input-field w-full text-xs py-1.5" placeholder="Role / Title" value={newContact.role} onChange={e => setNewContact(c => ({ ...c, role: e.target.value }))} />
                  <input className="input-field w-full text-xs py-1.5" placeholder="Email (optional)" value={newContact.email} onChange={e => setNewContact(c => ({ ...c, email: e.target.value }))} />
                  <div className="flex gap-1.5">
                    <button onClick={addContact} className="btn-primary text-xs py-1 px-2.5">Save</button>
                    <button onClick={() => setShowAddContact(false)} className="btn-secondary text-xs py-1 px-2.5">Cancel</button>
                  </div>
                </div>
              )}

              {contacts.length === 0 ? (
                <p className="text-brand-dark/25 text-xs italic">No contacts added.</p>
              ) : (
                <div className="space-y-3">
                  {contacts.map(contact => (
                    <div key={contact.id} className="flex items-start gap-2.5 group">
                      <div className="w-7 h-7 rounded-full bg-brand-gold/15 border border-brand-gold/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-gold">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-brand-dark leading-snug">{contact.name}</p>
                        <p className="text-xs text-brand-dark/50">{contact.role}</p>
                        {contact.email && <p className="text-xs text-brand-dark/35 truncate">{contact.email}</p>}
                      </div>
                      <button
                        onClick={() => saveContacts(contacts.filter(c => c.id !== contact.id))}
                        className="no-print opacity-0 group-hover:opacity-100 text-brand-dark/20 hover:text-red-500 transition-all text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status client details */}
            {statusClient && (
              <div className="card p-6">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-dark/40 mb-4">Pipeline Record</h2>
                <div className="space-y-2 text-xs text-brand-dark/60">
                  <div className="flex justify-between">
                    <span>Stage</span>
                    <span className="font-semibold text-brand-dark">{statusClient.stage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Value</span>
                    <span className="font-semibold text-brand-gold">{formatCurrency(statusClient.value) || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Contact</span>
                    <span className="font-semibold text-brand-dark">{statusClient.lastContact}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Industry</span>
                    <span className="font-semibold text-brand-dark">{statusClient.industry || '—'}</span>
                  </div>
                  {statusClient.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {statusClient.tags.map(t => (
                        <span key={t} className="bg-brand-cream text-brand-dark/60 px-1.5 py-0.5 rounded text-xs">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
