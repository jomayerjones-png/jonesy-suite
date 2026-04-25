import { View } from '../types';

interface HeaderProps {
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  activeView: View;
  onViewChange: (view: View) => void;
  clientCount: number;
  onSignOut: () => void;
  guestMode?: boolean;
}

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'pipeline', label: 'Pipeline',     icon: '⬡' },
  { id: 'roadmap',  label: 'Roadmap',      icon: '◆' },
  { id: 'report',   label: 'Report',       icon: '◎' },
  { id: 'proposal', label: 'Proposals',    icon: '◈' },
  { id: 'analytics',label: 'Analytics',   icon: '◉' },
];

export default function Header({
  companyName: _companyName,
  onCompanyNameChange: _onCompanyNameChange,
  activeView,
  onViewChange,
  clientCount,
  onSignOut,
  guestMode,
}: HeaderProps) {
  return (
    <>
      {/* ── Desktop header (hidden on mobile) ── */}
      <header className="hidden sm:block bg-brand-dark border-b border-brand-dark/20 sticky top-0 z-50">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="flex-shrink-0 select-none flex items-center justify-center px-3 pt-1.5 pb-1"
              style={{ background: '#E8002D', fontFamily: "'Bebas Neue', Impact, 'Arial Narrow', sans-serif" }}
            >
              <span className="text-white leading-none" style={{ fontSize: '1.6rem', letterSpacing: '0.06em' }}>LIFE</span>
            </div>
            <span className="text-white/30 text-sm font-light">Partner Suite</span>
            {guestMode && (
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-2 py-0.5">
                View only
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/70 text-xs font-medium">{clientCount} clients</span>
            </div>
            <div className="text-white/40 text-xs hidden md:block">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-4">
              <span className="text-white/50 text-xs font-medium tracking-wide">lifemagazine.com</span>
            </div>
            <button
              onClick={onSignOut}
              title={guestMode ? 'Sign in' : 'Sign out'}
              className="text-white/30 hover:text-white/70 transition-colors ml-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Desktop tab nav */}
        <div className="flex items-end px-6">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`group flex items-center gap-2 px-5 py-3.5 text-sm font-medium relative transition-all duration-150 ${
                activeView === item.id ? 'text-brand-gold' : 'text-white/50 hover:text-white/80'
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

      {/* ── Mobile top bar (shown on mobile only) ── */}
      <header className="sm:hidden bg-brand-dark sticky top-0 z-50 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex-shrink-0 select-none flex items-center justify-center px-2.5 pt-1 pb-0.5"
            style={{ background: '#E8002D', fontFamily: "'Bebas Neue', Impact, 'Arial Narrow', sans-serif" }}
          >
            <span className="text-white leading-none" style={{ fontSize: '1.3rem', letterSpacing: '0.06em' }}>LIFE</span>
          </div>
          <span className="text-white/60 text-xs font-medium tracking-wide">{NAV_ITEMS.find(n => n.id === activeView)?.label}</span>
          {guestMode && (
            <span className="text-[9px] font-semibold uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">
              View only
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-white/60 text-[11px] font-medium">{clientCount}</span>
          </div>
          <button onClick={onSignOut} title={guestMode ? 'Sign in' : 'Sign out'} className="text-white/40 hover:text-white/70 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-brand-dark border-t border-white/10 flex safe-area-bottom">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors active:opacity-60 ${
              activeView === item.id ? 'text-brand-gold' : 'text-white/35 hover:text-white/60'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[9px] font-semibold tracking-wider uppercase mt-0.5">{item.label}</span>
            {activeView === item.id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-gold rounded-b-full" />
            )}
          </button>
        ))}
      </nav>
    </>
  );
}
