'use client';

import { Proposal, formatDate } from '@/lib/types';

interface CreativeProposalsProps {
  proposals: Proposal[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  approved: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  upcoming: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

export default function CreativeProposals({ proposals }: CreativeProposalsProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#1A1A1A]">
          Creative Proposals
        </h2>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A1A1A] px-4 py-2 text-xs font-semibold text-[#F5F0E8] shadow-sm transition-all hover:bg-[#2a2a2a] hover:shadow-md active:scale-[0.98]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New proposal
        </button>
      </div>

      {proposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F0E8]">
            <svg className="h-6 w-6 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-gray-400">No proposals yet</p>
          <p className="mt-1 text-xs text-gray-300">
            Create your first creative proposal to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proposals.map((proposal) => {
            const style = STATUS_STYLES[proposal.status] ?? STATUS_STYLES.upcoming;

            return (
              <div
                key={proposal.id}
                className="group relative overflow-hidden rounded-xl border border-gray-100 p-5 transition-all hover:border-gray-200 hover:shadow-sm"
              >
                {/* Decorative accent */}
                <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[#C9A84C]/40 to-transparent" />

                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[#1A1A1A] group-hover:text-[#C9A84C] transition-colors line-clamp-2 leading-snug">
                    {proposal.title}
                  </h3>

                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    {proposal.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-400">
                  <span className="tabular-nums">
                    Created {formatDate(proposal.created_at)}
                  </span>
                  {proposal.updated_at !== proposal.created_at && (
                    <>
                      <span className="text-gray-200">|</span>
                      <span className="tabular-nums">
                        Updated {formatDate(proposal.updated_at)}
                      </span>
                    </>
                  )}
                </div>

                {proposal.content && (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-400">
                    {proposal.content}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
