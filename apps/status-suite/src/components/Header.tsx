import { useState, useRef, useEffect } from 'react';
import { View } from '../types';

interface HeaderProps {
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  activeView: View;
  onViewChange: (view: View) => void;
  clientCount: number;
  commissionEarned: number;
}

const NAV_ITEMS: { id: View; label: string; icon: string; desc: string }[] = [
  { id: 'pipeline', label: 'Pipeline', icon: '⬡', desc: 'Track deals & clients' },
  { id: 'engagement', label: 'Engagement', icon: '◆', desc: 'Contract & deliverables' },
  { id: 'bd', label: 'BD', icon: '◈', desc: 'Business development' },
  { id: 'report', label: 'Weekly Report', icon: '◎', desc: 'Client summary' },
  { id: 'proposal', label: 'Proposal AI', icon: '◇', desc: 'Generate proposals' },
  { id: 'analytics', label: 'Analytics', icon: '◉', desc: 'Revenue & commission' },
];

export default function Header({
  companyName,
  onCompanyNameChange,
  activeView,
  onViewChange,
  clientCount,
  commissionEarned,
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
            <span className="font-display text-white font-bold text-sm">S</span>
          </div>
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
          <span className="text-white/30 text-sm font-light hidden sm:block">Partner Suite</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/70 text-xs font-medium">{clientCount} clients</span>
          </div>
          {commissionEarned > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-brand-gold/20 rounded-full px-3 py-1">
              <span className="text-brand-gold-muted text-xs font-medium">
                Commission: ${commissionEarned.toLocaleString()}
              </span>
            </div>
          )}
          {/* Contract terms badge */}
          <div className="hidden md:flex items-center gap-2 bg-white/5 rounded-full px-3 py-1 text-white/40 text-xs">
            <span>Apr 6 – Jul 3</span>
            <span className="text-white/20">|</span>
            <span>$10K/mo</span>
            <span className="text-white/20">|</span>
            <span className="text-brand-gold-muted">7.5% commission</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-end px-6 overflow-x-auto">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`group flex items-center gap-2 px-5 py-3.5 text-sm font-medium relative transition-all duration-150 whitespace-nowrap ${
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
