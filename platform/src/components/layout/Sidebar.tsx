'use client';

import Link from 'next/link';
import { Client, RETAINER_STATUS_CONFIG } from '@/lib/types';

interface SidebarProps {
  clients: Client[];
  activeClientId?: string;
}

export default function Sidebar({ clients, activeClientId }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-30 flex h-full w-64 flex-col bg-brand-dark text-brand-light">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-gold">
          <span className="font-[family-name:var(--font-display)] text-xl font-bold text-brand-gold">
            J
          </span>
        </div>
        <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-brand-light">
          Jonesy&amp;Co
        </span>
      </div>

      {/* Clients section */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          Clients
        </p>

        <nav className="flex flex-col gap-0.5">
          {clients.map((client) => {
            const isActive = client.id === activeClientId;
            const statusConfig = RETAINER_STATUS_CONFIG[client.retainer_status];

            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'border-l-2 border-brand-gold bg-white/[0.06] text-brand-gold'
                    : 'border-l-2 border-transparent text-gray-400 hover:bg-white/[0.04] hover:text-brand-light'
                }`}
              >
                {/* Status dot */}
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${statusConfig.dot}`}
                />

                <span className="truncate font-medium">{client.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom navigation */}
      <div className="border-t border-white/[0.08] px-3 py-4">
        <nav className="flex flex-col gap-0.5">
          <Link
            href="/bd"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-brand-light"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
            </svg>
            <span className="font-medium">BD Pipeline</span>
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-brand-light"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <span className="font-medium">Settings</span>
          </Link>
        </nav>
      </div>
    </aside>
  );
}
