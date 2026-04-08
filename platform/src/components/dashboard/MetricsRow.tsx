'use client';

interface MetricsRowProps {
  intros: number;
  meetings: number;
  dealsActive: number;
  daysSinceUpdate: number;
}

function MetricIcon({ type }: { type: 'intros' | 'meetings' | 'deals' | 'days' }) {
  const shared = 'h-5 w-5';
  switch (type) {
    case 'intros':
      return (
        <svg className={shared} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      );
    case 'meetings':
      return (
        <svg className={shared} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
      );
    case 'deals':
      return (
        <svg className={shared} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
        </svg>
      );
    case 'days':
      return (
        <svg className={shared} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      );
  }
}

const cards: {
  key: 'intros' | 'meetings' | 'deals' | 'days';
  label: string;
  propKey: keyof MetricsRowProps;
}[] = [
  { key: 'intros', label: 'Intros Made', propKey: 'intros' },
  { key: 'meetings', label: 'Meetings Set', propKey: 'meetings' },
  { key: 'deals', label: 'Deals Active', propKey: 'dealsActive' },
  { key: 'days', label: 'Days Since Update', propKey: 'daysSinceUpdate' },
];

export default function MetricsRow(props: MetricsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ key, label, propKey }) => {
        const value = props[propKey];
        const isDanger = key === 'days' && value > 7;

        return (
          <div
            key={key}
            className={`group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
              isDanger ? 'border-red-200' : 'border-gray-100'
            }`}
          >
            {/* Subtle background accent */}
            <div
              className={`absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-[0.06] ${
                isDanger ? 'bg-red-500' : 'bg-[#C9A84C]'
              }`}
            />

            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {label}
              </p>
              <span className={`${isDanger ? 'text-red-400' : 'text-gray-300'}`}>
                <MetricIcon type={key} />
              </span>
            </div>

            <p
              className={`mt-3 text-3xl font-bold tabular-nums ${
                isDanger ? 'text-red-600' : 'text-[#1A1A1A]'
              }`}
            >
              {value}
            </p>

            {isDanger && (
              <p className="mt-1 text-xs font-medium text-red-500">
                Needs attention
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
