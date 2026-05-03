import { useState, useEffect } from 'react';
import { fetchTodayStatusProspects, updateStatusProspectStatus, StatusDailyProspect } from '../../lib/supabase';

interface LeadsProps {
  onAddToEngaged: (prospect: StatusDailyProspect) => void;
}

function ProspectCard({
  prospect,
  onAdd,
}: {
  prospect: StatusDailyProspect;
  onAdd: (p: StatusDailyProspect) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const added = prospect.status === 'added';

  const copyEmail = async () => {
    const full = `Subject: ${prospect.draft_subject}\n\n${prospect.draft_body}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`card p-4 transition-all ${added ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-brand-dark">{prospect.name}</span>
            {prospect.email_confidence === 'verified' && (
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">verified email</span>
            )}
          </div>
          <p className="text-xs text-brand-dark/60 mt-0.5">{prospect.title} · {prospect.company}</p>
          {prospect.email && (
            <p className="text-xs text-brand-dark/40 mt-0.5 font-mono">{prospect.email}</p>
          )}
        </div>
        {added && (
          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex-shrink-0">
            ✓ Added
          </span>
        )}
      </div>

      {/* WHY */}
      <p className="mt-2.5 text-xs text-[#E8471C] italic leading-relaxed">{prospect.why}</p>

      {/* Email preview */}
      <div className="mt-3">
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-brand-dark/50 hover:text-brand-dark flex items-center gap-1 transition-colors"
        >
          <span>{expanded ? '▾' : '▸'}</span>
          <span>{expanded ? 'Hide email draft' : 'View email draft'}</span>
        </button>
        {expanded && (
          <div className="mt-2 bg-brand-light border border-brand-cream rounded-lg p-3">
            <p className="text-xs font-semibold text-brand-dark mb-1">Subject: {prospect.draft_subject}</p>
            <pre className="text-xs text-brand-dark/70 whitespace-pre-wrap font-sans leading-relaxed">{prospect.draft_body}</pre>
          </div>
        )}
      </div>

      {/* Actions */}
      {!added && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={copyEmail}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-cream bg-white text-brand-dark/70 hover:text-brand-dark hover:border-brand-cream-dark transition-all"
          >
            {copied ? '✓ Copied' : '⎘ Copy Email'}
          </button>
          <button
            onClick={() => onAdd(prospect)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#E8471C] text-white hover:bg-[#d43d16] transition-all"
          >
            + Add to Pipeline
          </button>
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="h-4 bg-brand-cream rounded w-2/3 mb-2" />
      <div className="h-3 bg-brand-cream rounded w-1/2 mb-3" />
      <div className="h-3 bg-brand-cream rounded w-full mb-1.5" />
      <div className="h-3 bg-brand-cream rounded w-4/5" />
    </div>
  );
}

export default function Leads({ onAddToEngaged }: LeadsProps) {
  const [prospects, setProspects] = useState<StatusDailyProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTodayStatusProspects()
      .then(data => setProspects(data))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load prospects'))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (prospect: StatusDailyProspect) => {
    onAddToEngaged(prospect);
    setProspects(prev =>
      prev.map(p => p.id === prospect.id ? { ...p, status: 'added' } : p)
    );
    updateStatusProspectStatus(prospect.id, 'added').catch(() => {});
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold text-brand-dark">Today's Leads</h1>
            <p className="text-xs text-brand-dark/50 mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 bg-brand-light border border-brand-cream rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8471C] animate-pulse" />
              <span className="text-xs text-brand-dark/60 font-medium">Auto-generated · 8am EST</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Intro card */}
          <div className="bg-brand-dark rounded-xl px-5 py-4">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="bg-[#E8471C] px-2 py-0.5 flex-shrink-0">
                <span className="font-mono font-bold text-white text-xs tracking-tight leading-none">status_</span>
              </div>
              <span className="text-white/40 text-xs font-medium uppercase tracking-widest">Daily Prospect Briefing</span>
            </div>
            <p className="text-white text-sm leading-relaxed">
              3 senior contacts, identified each weekday morning by AI. Research-backed outreach — specific WHY for each company, draft email ready to send.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
              <p className="text-xs text-red-500 mt-1">Check that the <code>status_daily_prospects</code> table exists in Supabase and RLS allows anon SELECT.</p>
            </div>
          )}

          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : prospects.length === 0 && !error ? (
            <div className="text-center py-16">
              <p className="text-brand-dark/50 font-medium mb-1">No prospects generated yet today</p>
              <p className="text-sm text-brand-dark/35">
                The daily cron runs at 8am EST on weekdays. Check back this morning, or trigger the workflow manually in GitHub Actions.
              </p>
            </div>
          ) : (
            prospects.map(p => (
              <ProspectCard key={p.id} prospect={p} onAdd={handleAdd} />
            ))
          )}

          {/* Setup note */}
          {!loading && prospects.length === 0 && !error && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
              <p className="font-semibold mb-1">Setup required</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-amber-800">
                <li>Create <code>status_daily_prospects</code> table in Supabase (see project plan for SQL)</li>
                <li>Add RLS: anon INSERT + SELECT, authenticated UPDATE</li>
                <li>Set <code>ANTHROPIC_API_KEY</code> secret in GitHub → Settings → Secrets</li>
                <li>Push <code>scripts/daily-status-prospects.mjs</code> + GitHub Actions workflow</li>
                <li>Trigger workflow manually to test, or wait until 8am Monday</li>
              </ol>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
