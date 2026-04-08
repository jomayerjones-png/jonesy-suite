'use client';

import { ClientUpdate, formatDate } from '@/lib/types';

interface RecentUpdatesProps {
  updates: ClientUpdate[];
}

const SOURCE_STYLES: Record<string, { bg: string; text: string }> = {
  email: { bg: 'bg-blue-50', text: 'text-blue-700' },
  manual: { bg: 'bg-gray-100', text: 'text-gray-600' },
  meeting: { bg: 'bg-purple-50', text: 'text-purple-700' },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export default function RecentUpdates({ updates }: RecentUpdatesProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-5 font-[family-name:var(--font-display)] text-lg font-semibold text-[#1A1A1A]">
        Recent Updates
      </h2>

      {updates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
            <svg className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-gray-400">No updates yet</p>
          <p className="mt-1 text-xs text-gray-300">
            Updates from emails, meetings, and manual entries will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {updates.map((update) => {
            const sourceStyle = SOURCE_STYLES[update.source] ?? SOURCE_STYLES.manual;

            return (
              <li key={update.id} className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                {/* Action required dot */}
                <div className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  {update.action_required && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Source badge */}
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sourceStyle.bg} ${sourceStyle.text}`}
                    >
                      {update.source}
                    </span>

                    <span className="text-sm font-medium text-[#1A1A1A] group-hover:text-[#C9A84C] transition-colors">
                      {update.title}
                    </span>
                  </div>

                  {update.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">
                      {update.body}
                    </p>
                  )}
                </div>

                {/* Timestamp */}
                <span className="shrink-0 text-xs text-gray-300 tabular-nums">
                  {timeAgo(update.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
