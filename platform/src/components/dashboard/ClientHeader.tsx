'use client';

import {
  Client,
  ServiceStage,
  RETAINER_STATUS_CONFIG,
  monthsBetween,
  formatCurrency,
} from '@/lib/types';

interface ClientHeaderProps {
  client: Client;
  stages: ServiceStage[];
  prospectCount: number;
  pipelineValue: number;
}

export default function ClientHeader({
  client,
  stages,
  prospectCount,
  pipelineValue,
}: ClientHeaderProps) {
  const statusConfig = RETAINER_STATUS_CONFIG[client.retainer_status];

  const contractProgress =
    client.contract_start && client.contract_end
      ? monthsBetween(client.contract_start, client.contract_end)
      : null;

  const completeCount = stages.filter((s) => s.status === 'complete').length;
  const inProgressCount = stages.filter((s) => s.status === 'in_progress').length;
  const momentum = Math.min(100, completeCount * 14 + inProgressCount * 7);

  const momentumColor =
    momentum >= 70 ? 'text-teal-600' : momentum >= 40 ? 'text-amber-600' : 'text-gray-400';

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: Identity */}
        <div className="flex items-start gap-5">
          {/* Logo initial */}
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-white shadow-inner"
            style={{ backgroundColor: client.brand_color || '#1A1A1A' }}
          >
            {client.logo_initial || client.name.charAt(0)}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[#1A1A1A]">
                {client.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                {statusConfig.label}
              </span>
            </div>

            {client.company && (
              <p className="mt-1 text-sm text-gray-500">{client.company}</p>
            )}

            {client.key_contact && (
              <p className="mt-0.5 text-sm text-gray-400">
                Key contact: {client.key_contact}
                {client.contact_email && (
                  <span className="ml-1 text-gray-300">({client.contact_email})</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Right: Key metrics */}
        <div className="flex flex-wrap items-start gap-8 lg:gap-10">
          {/* Contract progress */}
          {contractProgress && (
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Contract
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#1A1A1A]">
                {contractProgress.current}
                <span className="text-base font-normal text-gray-400">
                  /{contractProgress.total}
                </span>
              </p>
              <p className="text-[11px] text-gray-400">months</p>
            </div>
          )}

          {/* Momentum */}
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Momentum
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${momentumColor}`}>
              {momentum}
              <span className="text-base font-normal text-gray-400">/100</span>
            </p>
            <div className="mx-auto mt-1.5 h-1 w-16 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${
                  momentum >= 70
                    ? 'bg-teal-500'
                    : momentum >= 40
                      ? 'bg-amber-500'
                      : 'bg-gray-300'
                }`}
                style={{ width: `${momentum}%` }}
              />
            </div>
          </div>

          {/* Prospects */}
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Prospects
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#1A1A1A]">
              {prospectCount}
            </p>
          </div>

          {/* Pipeline value */}
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Pipeline
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#C9A84C]">
              {formatCurrency(pipelineValue)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
