import { useState, useRef, useEffect } from 'react';
import { View, formatCurrency } from '../types';

interface HeaderProps {
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  activeView: View;
  onViewChange: (view: View) => void;
  clientCount: number;
  wonRevenue: number;
  gmailEnabled: boolean;
  gmailConnected: boolean;
  gmailSyncing: boolean;
  lastSync: string | null;
  onGmailConnect: () => void;
}

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: 'pipeline',  label: 'Pipeline'      },
  { id: 'report',    label: 'Weekly Report' },
  { id: 'proposal',  label: 'Proposal AI'   },
  { id: 'analytics', label: 'Analytics'     },
  { id: 'projects',  label: 'Live Projects' },
];

function relativeSync(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
}

export default function Header({
  companyName,
  onCompanyNameChange,
  activeView,
  onViewChange,
  clientCount,
  wonRevenue,
  gmailEnabled,
  gmailConnected,
  gmailSyncing,
  lastSync,
  onGmailConnect,
}: HeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(companyName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed) onCompanyNameChange(trimmed);
    else setDraft(companyName);
    setEditing(false);
  };

  return (
    <header className="bg-brand-dark border-b border-white/10 sticky top-0 z-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Logo mark — monochrome */}
          <div
            className="flex-shrink-0 select-none px-2.5 py-1"
            style={{ background: '#fff', fontFamily: "'Bebas Neue', Impact, 'Arial Narrow', sans-serif" }}
          >
            <span className="text-brand-dark leading-none" style={{ fontSize: '1.25rem', letterSpacing: '0.08em' }}>JMJ</span>
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
              className="font-sans text-sm font-medium text-white bg-transparent border-b border-white/40 outline-none w-40"
            />
          ) : (
            <button
              onClick={() => { setDraft(companyName); setEditing(true); }}
              className="font-sans text-sm font-medium text-white/70 hover:text-white transition-colors group flex items-center gap-1"
              title="Click to edit"
            >
              {companyName}
              <span className="opacity-0 group-hover:opacity-40 text-xs transition-opacity">✏</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Gmail sync button */}
          {gmailEnabled && (
            <button
              onClick={onGmailConnect}
              disabled={gmailSyncing}
              title={gmailConnected ? 'Sync Gmail now' : 'Connect Gmail to auto-sync contacts'}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                gmailSyncing
                  ? 'bg-white/10 text-white/40 cursor-wait'
                  : gmailConnected
                    ? 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                    : 'bg-white text-brand-dark hover:bg-white/90'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6ZM20 6L12 13L4 6H20ZM20 18H4V8L12 15L20 8V18Z" fill="currentColor"/>
              </svg>
              {gmailSyncing ? 'Syncing…' : gmailConnected ? 'Gmail' : 'Connect Gmail'}
              {gmailConnected && lastSync && !gmailSyncing && (
                <span className="text-white/40">{relativeSync(lastSync)}</span>
              )}
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 bg-white/8 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/60 text-xs font-medium">{clientCount} clients</span>
          </div>

          {wonRevenue > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/15 rounded-full px-3 py-1">
              <span className="text-emerald-400 text-xs font-semibold">{formatCurrency(wonRevenue)}</span>
              <span className="text-emerald-400/60 text-xs">won</span>
            </div>
          )}

          <div className="text-white/30 text-xs hidden md:block">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-end px-6">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`px-5 py-3.5 text-sm font-medium relative transition-all duration-150 tracking-wide ${
              activeView === item.id
                ? 'text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {item.label}
            {activeView === item.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />
            )}
          </button>
        ))}
      </div>
    </header>
  );
}
