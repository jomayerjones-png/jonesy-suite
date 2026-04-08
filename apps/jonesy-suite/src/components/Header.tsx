import { useState, useRef, useEffect } from 'react';
import { View, formatCurrency } from '../types';

interface HeaderProps {
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  activeView: View;
  onViewChange: (view: View) => void;
  clientCount: number;
  wonRevenue: number;
}

const NAV_ITEMS: { id: View; label: string; icon: string; desc: string }[] = [
  { id: 'pipeline', label: 'Pipeline', icon: '⬡', desc: 'Track deals & clients' },
  { id: 'report', label: 'Weekly Report', icon: '◎', desc: 'Client summary' },
  { id: 'proposal', label: 'Proposal AI', icon: '◈', desc: 'Generate proposals' },
  { id: 'analytics', label: 'Analytics', icon: '◉', desc: 'Performance insights' },
  { id: 'projects', label: 'Live Projects', icon: '◆', desc: 'Sold project folders' },
  { id: 'status', label: 'STATUS', icon: '▣', desc: 'STATUS client dashboard' },
];

export default function Header({
  companyName,
  onCompanyNameChange,
  activeView,
  onViewChange,
  clientCount,
  wonRevenue,
}: HeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(companyName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed) onCompanyNameChange(trimmed);
    else setDraft(companyName);
    setEditing(false);
  };

  return (
    <header className="bg-brand-dark border-b border-brand-dark/20 sticky top-0 z-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-lg bg-brand-gold flex items-center justify-center">
            <span className="font-display text-brand-dark font-bold text-sm">J</span>
          </div>
          {/* Editable company name */}
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') { setDraft(companyName); setEditing(false); }
              }}
              className="font-display text-lg font-semibold text-white bg-transparent border-b-2 border-brand-gold outline-none w-48"
            />
          ) : (
            <button
              onClick={() => { setDraft(companyName); setEditing(true); }}
              className="font-display text-lg font-semibold text-white hover:text-brand-gold transition-colors group flex items-center gap-1.5"
              title="Click to edit company name"
            >
              {companyName}
              <span className="opacity-0 group-hover:opacity-60 text-brand-gold text-xs transition-opacity">
                ✏
              </span>
            </button>
          )}
          <span className="text-white/30 text-sm font-light hidden sm:block">Business Suite</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/70 text-xs font-medium">{clientCount} clients</span>
          </div>
          {wonRevenue > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/15 rounded-full px-3 py-1">
              <span className="text-emerald-400 text-xs font-semibold">{formatCurrency(wonRevenue)}</span>
              <span className="text-emerald-400/60 text-xs">won</span>
            </div>
          )}
          <div className="text-white/40 text-xs hidden md:block">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-end px-6">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`group flex items-center gap-2 px-5 py-3.5 text-sm font-medium relative transition-all duration-150 ${
              activeView === item.id
                ? 'text-brand-gold'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <span className={`text-base leading-none transition-transform duration-150 ${activeView === item.id ? '' : 'group-hover:scale-110'}`}>
              {item.icon}
            </span>
            <span className="tracking-wide">{item.label}</span>
            {activeView === item.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-gold rounded-t-full" />
            )}
          </button>
        ))}
      </div>
    </header>
  );
}
