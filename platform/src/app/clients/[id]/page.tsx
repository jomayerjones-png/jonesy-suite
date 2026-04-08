import Sidebar from '@/components/layout/Sidebar';
import ClientHeader from '@/components/dashboard/ClientHeader';
import MetricsRow from '@/components/dashboard/MetricsRow';
import ServiceStageTracker from '@/components/dashboard/ServiceStageTracker';
import RecentUpdates from '@/components/dashboard/RecentUpdates';
import NextActions from '@/components/dashboard/NextActions';
import ActivePipeline from '@/components/dashboard/ActivePipeline';
import CreativeProposals from '@/components/dashboard/CreativeProposals';
import type {
  Client,
  ServiceStage,
  PipelineProspect,
  ActionItem,
  ClientUpdate,
  Proposal,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

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

const MOCK_STAGES: ServiceStage[] = [
  {
    id: 'stage-1',
    client_id: 'client-life',
    stage: 'strategy',
    status: 'complete',
    started_at: '2025-09-01T00:00:00Z',
    completed_at: '2025-10-15T00:00:00Z',
    notes: null,
    sort_order: 0,
    created_at: '2025-09-01T00:00:00Z',
  },
  {
    id: 'stage-2',
    client_id: 'client-life',
    stage: 'pipeline',
    status: 'complete',
    started_at: '2025-10-16T00:00:00Z',
    completed_at: '2025-12-01T00:00:00Z',
    notes: null,
    sort_order: 1,
    created_at: '2025-10-16T00:00:00Z',
  },
  {
    id: 'stage-3',
    client_id: 'client-life',
    stage: 'activation',
    status: 'complete',
    started_at: '2025-12-02T00:00:00Z',
    completed_at: '2026-01-20T00:00:00Z',
    notes: null,
    sort_order: 2,
    created_at: '2025-12-02T00:00:00Z',
  },
  {
    id: 'stage-4',
    client_id: 'client-life',
    stage: 'introductions',
    status: 'in_progress',
    started_at: '2026-01-21T00:00:00Z',
    completed_at: null,
    notes: 'Active intro phase',
    sort_order: 3,
    created_at: '2026-01-21T00:00:00Z',
  },
  {
    id: 'stage-5',
    client_id: 'client-life',
    stage: 'production',
    status: 'not_started',
    started_at: null,
    completed_at: null,
    notes: null,
    sort_order: 4,
    created_at: '2025-09-01T00:00:00Z',
  },
  {
    id: 'stage-6',
    client_id: 'client-life',
    stage: 'execution',
    status: 'not_started',
    started_at: null,
    completed_at: null,
    notes: null,
    sort_order: 5,
    created_at: '2025-09-01T00:00:00Z',
  },
  {
    id: 'stage-7',
    client_id: 'client-life',
    stage: 'renewal',
    status: 'not_started',
    started_at: null,
    completed_at: null,
    notes: null,
    sort_order: 6,
    created_at: '2025-09-01T00:00:00Z',
  },
];

const MOCK_PROSPECTS: PipelineProspect[] = [
  {
    id: 'prospect-1',
    client_id: 'client-life',
    name: 'Nike Brand Partnership',
    company: 'Nike',
    stage: 'proposal_sent',
    value: 250000,
    owner: 'Jonesy',
    key_contact: 'James Williams',
    contact_email: 'jwilliams@nike.com',
    notes: 'Q3 campaign integration',
    last_activity_at: '2026-04-05T14:00:00Z',
    created_at: '2026-02-10T00:00:00Z',
    updated_at: '2026-04-05T14:00:00Z',
  },
  {
    id: 'prospect-2',
    client_id: 'client-life',
    name: 'Spotify Podcast Deal',
    company: 'Spotify',
    stage: 'meeting_set',
    value: 150000,
    owner: 'Jonesy',
    key_contact: 'Priya Patel',
    contact_email: 'priya@spotify.com',
    notes: 'Exclusive content distribution',
    last_activity_at: '2026-04-03T10:30:00Z',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-04-03T10:30:00Z',
  },
  {
    id: 'prospect-3',
    client_id: 'client-life',
    name: 'Amex Event Sponsorship',
    company: 'American Express',
    stage: 'intro_call',
    value: 100000,
    owner: 'Sarah Chen',
    key_contact: 'David Kim',
    contact_email: 'dkim@amex.com',
    notes: 'Exploring live event sponsorship',
    last_activity_at: '2026-04-06T16:00:00Z',
    created_at: '2026-03-20T00:00:00Z',
    updated_at: '2026-04-06T16:00:00Z',
  },
];

const MOCK_ACTIONS: ActionItem[] = [
  {
    id: 'action-1',
    client_id: 'client-life',
    prospect_id: 'prospect-1',
    title: 'Follow up on Nike proposal feedback',
    owner_type: 'jonesy',
    assignee: 'Jonesy',
    due_date: '2026-04-10',
    completed: false,
    completed_at: null,
    created_at: '2026-04-05T14:00:00Z',
  },
  {
    id: 'action-2',
    client_id: 'client-life',
    prospect_id: 'prospect-2',
    title: 'Prepare Spotify meeting deck',
    owner_type: 'jonesy',
    assignee: 'Jonesy',
    due_date: '2026-04-09',
    completed: false,
    completed_at: null,
    created_at: '2026-04-03T10:30:00Z',
  },
  {
    id: 'action-3',
    client_id: 'client-life',
    prospect_id: null,
    title: 'Send weekly pipeline report to Sarah',
    owner_type: 'jonesy',
    assignee: 'Jonesy',
    due_date: '2026-04-08',
    completed: false,
    completed_at: null,
    created_at: '2026-04-01T00:00:00Z',
  },
  {
    id: 'action-4',
    client_id: 'client-life',
    prospect_id: 'prospect-3',
    title: 'Share Amex event brief with LIFE team',
    owner_type: 'client',
    assignee: 'Sarah Chen',
    due_date: '2026-04-11',
    completed: false,
    completed_at: null,
    created_at: '2026-04-06T16:00:00Z',
  },
  {
    id: 'action-5',
    client_id: 'client-life',
    prospect_id: null,
    title: 'Update retainer pricing for Q3 review',
    owner_type: 'jonesy',
    assignee: 'Jonesy',
    due_date: '2026-04-15',
    completed: false,
    completed_at: null,
    created_at: '2026-04-02T00:00:00Z',
  },
];

const MOCK_UPDATES: ClientUpdate[] = [
  {
    id: 'update-1',
    client_id: 'client-life',
    prospect_id: 'prospect-1',
    source: 'email',
    title: 'Nike reviewing proposal internally',
    body: 'James confirmed the proposal is circulating with their brand partnerships team. Expect feedback by end of week.',
    action_required: false,
    gmail_thread_id: null,
    gmail_message_id: null,
    from_address: 'jwilliams@nike.com',
    created_at: '2026-04-05T14:00:00Z',
  },
  {
    id: 'update-2',
    client_id: 'client-life',
    prospect_id: null,
    source: 'meeting',
    title: 'Weekly sync with Sarah Chen',
    body: 'Discussed pipeline priorities and upcoming Spotify meeting. Sarah wants to push Amex timeline up.',
    action_required: true,
    gmail_thread_id: null,
    gmail_message_id: null,
    from_address: null,
    created_at: '2026-04-04T11:00:00Z',
  },
  {
    id: 'update-3',
    client_id: 'client-life',
    prospect_id: 'prospect-2',
    source: 'email',
    title: 'Spotify confirmed meeting for April 12',
    body: 'Priya locked in the meeting with their content partnerships lead. Need deck ready by April 9.',
    action_required: true,
    gmail_thread_id: null,
    gmail_message_id: null,
    from_address: 'priya@spotify.com',
    created_at: '2026-04-03T10:30:00Z',
  },
];

const MOCK_PROPOSALS: Proposal[] = [
  {
    id: 'proposal-1',
    client_id: 'client-life',
    prospect_id: 'prospect-1',
    title: 'Nike x LIFE Brand Partnership — Q3 2026',
    content: 'Integrated campaign proposal for Nike featuring LIFE editorial content across digital and live activations.',
    status: 'approved',
    briefing: { audience: '18-35 lifestyle', format: 'Multi-platform' },
    created_at: '2026-03-25T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
  },
  {
    id: 'proposal-2',
    client_id: 'client-life',
    prospect_id: 'prospect-2',
    title: 'Spotify Exclusive Podcast Distribution',
    content: 'Proposal for exclusive distribution of LIFE\'s flagship podcast series on Spotify, including promotional support.',
    status: 'draft',
    briefing: { audience: 'Podcast listeners 25-44', format: 'Audio series' },
    created_at: '2026-04-02T00:00:00Z',
    updated_at: '2026-04-06T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Find the active client (fall back to LIFE if not found)
  const client =
    MOCK_CLIENTS.find((c) => c.id === id) ?? MOCK_CLIENTS[0];

  // Compute pipeline value from prospects
  const pipelineValue = MOCK_PROSPECTS.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="flex min-h-screen">
      <Sidebar clients={MOCK_CLIENTS} activeClientId={client.id} />

      {/* Scrollable main area */}
      <main className="ml-64 flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          {/* Client Header */}
          <ClientHeader
            client={client}
            stages={MOCK_STAGES}
            prospectCount={MOCK_PROSPECTS.length}
            pipelineValue={pipelineValue}
          />

          {/* Metrics Row */}
          <MetricsRow
            intros={12}
            meetings={5}
            dealsActive={MOCK_PROSPECTS.length}
            daysSinceUpdate={2}
          />

          {/* Service Stage Tracker */}
          <ServiceStageTracker stages={MOCK_STAGES} />

          {/* Two-column: Recent Updates + Next Actions */}
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <RecentUpdates updates={MOCK_UPDATES} />
            </div>
            <div className="lg:col-span-2">
              <NextActions actions={MOCK_ACTIONS} />
            </div>
          </div>

          {/* Active Pipeline — full width */}
          <ActivePipeline prospects={MOCK_PROSPECTS} />

          {/* Creative Proposals — full width */}
          <CreativeProposals proposals={MOCK_PROPOSALS} />
        </div>
      </main>
    </div>
  );
}
