import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { RETAINER_STATUS_CONFIG, formatCurrency } from '@/lib/types';
import { getClients, getPipelineProspects, isSupabaseConfigured } from '@/lib/data';

export default async function Home() {
  const clients = await getClients();

  // Pipeline value per client (parallel fetch)
  const pipelineValues = await Promise.all(
    clients.map(async (c) => {
      const prospects = await getPipelineProspects(c.id);
      const total = prospects
        .filter((p) => p.stage !== 'closed_lost' && p.stage !== 'closed_won')
        .reduce((sum, p) => sum + (p.value ?? 0), 0);
      return [c.id, total] as const;
    })
  );
  const pipelineByClient = new Map(pipelineValues);

  const connected = isSupabaseConfigured();

  return (
    <div className="flex min-h-screen">
      <Sidebar clients={clients} />

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

        {/* Info banner — only shown in demo mode */}
        {!connected && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-medium">Demo mode:</span> Supabase isn&apos;t
            configured. Add <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
            and <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in
            Vercel to load real data.
          </div>
        )}

        {/* Empty state */}
        {clients.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center">
            <p className="text-gray-500">
              No clients yet. Run the migration in{' '}
              <code className="font-mono text-xs">
                platform/supabase/migrations/001_initial_schema.sql
              </code>{' '}
              to seed your organization and clients.
            </p>
          </div>
        )}

        {/* Client cards grid */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const statusConfig = RETAINER_STATUS_CONFIG[client.retainer_status];
            const pipelineValue = pipelineByClient.get(client.id) ?? 0;

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
                      {formatCurrency(pipelineValue)}
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
