import { notFound } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import ClientHeader from '@/components/dashboard/ClientHeader';
import MetricsRow from '@/components/dashboard/MetricsRow';
import ServiceStageTracker from '@/components/dashboard/ServiceStageTracker';
import RecentUpdates from '@/components/dashboard/RecentUpdates';
import NextActions from '@/components/dashboard/NextActions';
import ActivePipeline from '@/components/dashboard/ActivePipeline';
import CreativeProposals from '@/components/dashboard/CreativeProposals';
import { daysSince } from '@/lib/types';
import {
  getClients,
  getClient,
  getServiceStages,
  getPipelineProspects,
  getActionItems,
  getClientUpdates,
  getProposals,
} from '@/lib/data';

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Parallel fetch everything we need for this client
  const [clients, client] = await Promise.all([getClients(), getClient(id)]);

  if (!client) {
    notFound();
  }

  const [stages, prospects, actions, updates, proposals] = await Promise.all([
    getServiceStages(client.id),
    getPipelineProspects(client.id),
    getActionItems(client.id),
    getClientUpdates(client.id),
    getProposals(client.id),
  ]);

  // Metrics derived from live data
  const activeProspects = prospects.filter(
    (p) => p.stage !== 'closed_lost' && p.stage !== 'closed_won'
  );
  const pipelineValue = activeProspects.reduce((sum, p) => sum + (p.value ?? 0), 0);

  const introsMade = prospects.filter((p) =>
    ['meeting_set', 'proposal_sent', 'negotiation', 'closed_won'].includes(p.stage)
  ).length;
  const meetingsSet = prospects.filter((p) => p.stage === 'meeting_set').length;
  const dealsActive = activeProspects.length;

  const mostRecentUpdate = updates[0];
  const daysSinceUpdate = mostRecentUpdate
    ? daysSince(mostRecentUpdate.created_at)
    : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar clients={clients} activeClientId={client.id} />

      {/* Scrollable main area */}
      <main className="ml-64 flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          {/* Client Header */}
          <ClientHeader
            client={client}
            stages={stages}
            prospectCount={dealsActive}
            pipelineValue={pipelineValue}
          />

          {/* Metrics Row */}
          <MetricsRow
            intros={introsMade}
            meetings={meetingsSet}
            dealsActive={dealsActive}
            daysSinceUpdate={daysSinceUpdate}
          />

          {/* Service Stage Tracker */}
          <ServiceStageTracker stages={stages} />

          {/* Two-column: Recent Updates + Next Actions */}
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <RecentUpdates updates={updates} />
            </div>
            <div className="lg:col-span-2">
              <NextActions actions={actions} />
            </div>
          </div>

          {/* Active Pipeline — full width */}
          <ActivePipeline prospects={prospects} />

          {/* Creative Proposals — full width */}
          <CreativeProposals proposals={proposals} />
        </div>
      </main>
    </div>
  );
}
