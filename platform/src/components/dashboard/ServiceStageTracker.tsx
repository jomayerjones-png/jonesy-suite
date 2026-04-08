'use client';

import {
  SERVICE_STAGES,
  STAGE_STATUS_CONFIG,
  ServiceStage,
} from '@/lib/types';

interface ServiceStageTrackerProps {
  stages: ServiceStage[];
}

export default function ServiceStageTracker({ stages }: ServiceStageTrackerProps) {
  const stageMap = new Map(stages.map((s) => [s.stage, s]));

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-6 font-[family-name:var(--font-display)] text-lg font-semibold text-[#1A1A1A]">
        Service Stages
      </h2>

      <div className="overflow-x-auto">
        <div className="flex items-start justify-between gap-0 min-w-[640px]">
          {SERVICE_STAGES.map((stageDef, idx) => {
            const stageData = stageMap.get(stageDef.name);
            const status = stageData?.status ?? 'not_started';
            const config = STAGE_STATUS_CONFIG[status];

            // The connecting line color depends on whether the *previous* stage is complete
            const prevStageDef = SERVICE_STAGES[idx - 1];
            const prevStageData = prevStageDef
              ? stageMap.get(prevStageDef.name)
              : null;
            const prevComplete = prevStageData?.status === 'complete';

            return (
              <div key={stageDef.name} className="flex flex-1 items-start">
                {/* Connecting line (before this stage) */}
                {idx > 0 && (
                  <div className="mt-4 flex-1 px-0">
                    <div
                      className={`h-0.5 w-full ${
                        prevComplete ? 'bg-teal-400' : 'bg-gray-200'
                      }`}
                    />
                  </div>
                )}

                {/* Stage indicator + label */}
                <div className="flex flex-col items-center gap-2 px-1">
                  {/* Circle */}
                  <div
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                      status === 'complete'
                        ? 'border-teal-500 bg-teal-500'
                        : status === 'in_progress'
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    {status === 'complete' && (
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                    {status === 'in_progress' && (
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                    )}
                    {status === 'not_started' && (
                      <div className="h-2 w-2 rounded-full bg-gray-300" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-center text-[11px] font-medium leading-tight ${config.color}`}
                  >
                    {stageDef.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
