import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Client, RETAINER_STATUS_CONFIG, formatCurrency } from '@/lib/types';

// Mock data — Connect to Supabase to load real data
const MOCK_CLIENTS: Client[] = [
  {
    id: 'client-life',
    org_id: 'org-1',
    name: 'LIFE',
    company: 'LIFE Media Group',
    industry: 'Media & Entertainment',
    key_contact: 'Sarah Chen',
    contact_email: 'sarah@lifemedia.com',
    retainer_status: 'active',
    contract_start: '2025-09-01',
    contract_end: '2026-08-31',
    monthly_retainer: 15000,
    commission_rate: 0.1,
    brand_color: '#E63946',
    logo_initial: 'L',
    notes: null,
    created_at: '2025-09-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
  },
  {
    id: 'client-status',
    org_id: 'org-1',
    name: 'Status',
    company: 'Status Ventures',
    industry: 'FinTech',
    key_contact: 'Marcus Reid',
    contact_email: 'marcus@statusventures.com',
    retainer_status: 'at_risk',
    contract_start: '2025-06-01',
    contract_end: '2026-05-31',
    monthly_retainer: 12000,
    commission_rate: 0.08,
    brand_color: '#457B9D',
    logo_initial: 'S',
    notes: null,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-03-28T00:00:00Z',
  },
  {
    id: 'client-profg',
    org_id: 'org-1',
    name: 'Prof G',
    company: 'Prof G Media',
    industry: 'Education & Media',
    key_contact: 'Scott Galloway',
    contact_email: 'team@profgmedia.com',
    retainer_status: 'renewal_due',
    contract_start: '2025-04-01',
    contract_end: '2026-03-31',
    monthly_retainer: 20000,
    commission_rate: 0.12,
    brand_color: '#2D3436',
    logo_initial: 'PG',
    notes: null,
    created_at: '2025-04-01T00:00:00Z',
    updated_at: '2026-04-05T00:00:00Z',
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen">
      <Sidebar clients={MOCK_CLIENTS} />

      {/* Main content area — offset by sidebar width */}
      <main className="ml-64 flex-1 px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-brand-dark">
            All Clients
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Jonesy&amp;Co partnership overview
          </p>
        </div>

        {/* Info banner */}
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Note:</span> Connect to Supabase to load real data.
          Currently displaying mock client data.
        </div>

        {/* Client cards grid */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {MOCK_CLIENTS.map((client) => {
            const statusConfig = RETAINER_STATUS_CONFIG[client.retainer_status];

            return (
              <div
                key={client.id}
                className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
              >
                {/* Top row: initial + name */}
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
                    style={{ backgroundColor: client.brand_color || '#1A1A1A' }}
                  >
                    {client.logo_initial || client.name.charAt(0)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-brand-dark">
                      {client.name}
                    </h2>
                    {client.company && (
                      <p className="mt-0.5 truncate text-sm text-gray-500">
                        {client.company}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div className="mt-4 flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                    {statusConfig.label}
                  </span>
                </div>

                {/* Pipeline value */}
                <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Pipeline Value
                    </p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-brand-gold">
                      {formatCurrency(0)}
                    </p>
                  </div>

                  <Link
                    href={`/clients/${client.id}`}
                    className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-brand-light transition-colors hover:bg-brand-dark/90"
                  >
                    View Dashboard
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
