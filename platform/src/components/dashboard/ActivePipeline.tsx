'use client';

import {
  PipelineProspect,
  PROSPECT_STAGE_CONFIG,
  formatCurrency,
  daysSince,
} from '@/lib/types';

interface ActivePipelineProps {
  prospects: PipelineProspect[];
}

const STAGE_PRIORITY: Record<string, number> = {
  stalled: 0,
  negotiation: 1,
  proposal_sent: 2,
  meeting_set: 3,
  intro_call: 4,
  closed_won: 5,
  closed_lost: 6,
};

export default function ActivePipeline({ prospects }: ActivePipelineProps) {
  const sorted = [...prospects].sort((a, b) => {
    const aPri = STAGE_PRIORITY[a.stage] ?? 99;
    const bPri = STAGE_PRIORITY[b.stage] ?? 99;
    return aPri - bPri;
  });

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#1A1A1A]">
          Active Pipeline
        </h2>
        <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-500 tabular-nums">
          {prospects.length} prospect{prospects.length !== 1 ? 's' : ''}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
            <svg className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-gray-400">No prospects yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Prospect
                </th>
                <th className="px-4 pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Company
                </th>
                <th className="px-4 pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Stage
                </th>
                <th className="px-4 pb-3 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Value
                </th>
                <th className="px-4 pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Owner
                </th>
                <th className="px-6 pb-3 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Last Activity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((prospect) => {
                const stageConfig = PROSPECT_STAGE_CONFIG[prospect.stage];
                const daysAgo = daysSince(prospect.last_activity_at);
                const isStale = daysAgo > 7;

                return (
                  <tr
                    key={prospect.id}
                    className="group transition-colors hover:bg-gray-50/50"
                  >
                    <td className="px-6 py-3">
                      <span className="text-sm font-medium text-[#1A1A1A] group-hover:text-[#C9A84C] transition-colors">
                        {prospect.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">
                        {prospect.company || '\u2014'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${stageConfig.bg} ${stageConfig.color}`}
                      >
                        {stageConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold tabular-nums text-[#1A1A1A]">
                        {formatCurrency(prospect.value)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">
                        {prospect.owner || '\u2014'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span
                        className={`text-sm tabular-nums ${
                          isStale
                            ? daysAgo > 14
                              ? 'font-medium text-red-600'
                              : 'font-medium text-amber-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
