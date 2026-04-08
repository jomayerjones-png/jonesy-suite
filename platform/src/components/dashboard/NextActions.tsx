'use client';

import { ActionItem } from '@/lib/types';

interface NextActionsProps {
  actions: ActionItem[];
}

function isOverdue(item: ActionItem): boolean {
  if (item.completed || !item.due_date) return false;
  return new Date(item.due_date) < new Date();
}

function sortActions(items: ActionItem[]): ActionItem[] {
  return [...items].sort((a, b) => {
    const aOverdue = isOverdue(a);
    const bOverdue = isOverdue(b);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // Completed items go last
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;

    // Then by due date (earliest first, null last)
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return 0;
  });
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff <= 7) return `In ${diff}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActionColumn({
  title,
  items,
}: {
  title: string;
  items: ActionItem[];
}) {
  const sorted = sortActions(items);

  return (
    <div className="flex-1 min-w-0">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
        {title}
      </h3>

      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-300">No actions</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((item) => {
            const overdue = isOverdue(item);

            return (
              <li
                key={item.id}
                className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  overdue
                    ? 'bg-red-50/60'
                    : item.completed
                      ? 'bg-gray-50/50'
                      : 'hover:bg-gray-50/60'
                }`}
              >
                {/* Checkbox */}
                <div className="mt-0.5 shrink-0">
                  <div
                    className={`flex h-4.5 w-4.5 items-center justify-center rounded border-[1.5px] ${
                      item.completed
                        ? 'border-teal-500 bg-teal-500'
                        : overdue
                          ? 'border-red-300'
                          : 'border-gray-300'
                    }`}
                  >
                    {item.completed && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-snug ${
                      item.completed
                        ? 'text-gray-400 line-through'
                        : 'text-[#1A1A1A]'
                    }`}
                  >
                    {item.title}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {item.due_date && (
                      <span
                        className={`text-[11px] font-medium tabular-nums ${
                          overdue
                            ? 'text-red-600'
                            : item.completed
                              ? 'text-gray-300'
                              : 'text-gray-400'
                        }`}
                      >
                        {formatDueDate(item.due_date)}
                      </span>
                    )}
                    {item.assignee && (
                      <span className="text-[11px] text-gray-300">
                        {item.assignee}
                      </span>
                    )}
                  </div>
                </div>

                {overdue && (
                  <span className="mt-1 shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600">
                    Overdue
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function NextActions({ actions }: NextActionsProps) {
  const jonesyActions = actions.filter((a) => a.owner_type === 'jonesy');
  const clientActions = actions.filter((a) => a.owner_type === 'client');

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-5 font-[family-name:var(--font-display)] text-lg font-semibold text-[#1A1A1A]">
        Next Actions
      </h2>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <ActionColumn title="Jonesy&Co Actions" items={jonesyActions} />
        <div className="hidden lg:block w-px bg-gray-100" />
        <ActionColumn title="Client Actions" items={clientActions} />
      </div>
    </div>
  );
}
