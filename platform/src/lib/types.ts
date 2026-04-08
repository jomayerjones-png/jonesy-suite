// Database types matching Supabase schema

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  org_id: string;
  user_id: string | null;
  role: 'owner' | 'admin' | 'member';
  name: string;
  email: string;
  created_at: string;
}

export type RetainerStatus = 'active' | 'at_risk' | 'renewal_due' | 'churned';

export interface Client {
  id: string;
  org_id: string;
  name: string;
  company: string | null;
  industry: string | null;
  key_contact: string | null;
  contact_email: string | null;
  retainer_status: RetainerStatus;
  contract_start: string | null;
  contract_end: string | null;
  monthly_retainer: number;
  commission_rate: number;
  brand_color: string;
  logo_initial: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ServiceStageName = 'strategy' | 'pipeline' | 'activation' | 'introductions' | 'production' | 'execution' | 'renewal';
export type ServiceStageStatus = 'complete' | 'in_progress' | 'not_started';

export interface ServiceStage {
  id: string;
  client_id: string;
  stage: ServiceStageName;
  status: ServiceStageStatus;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export type ProspectStage = 'intro_call' | 'meeting_set' | 'proposal_sent' | 'negotiation' | 'stalled' | 'closed_won' | 'closed_lost';

export interface PipelineProspect {
  id: string;
  client_id: string;
  name: string;
  company: string | null;
  stage: ProspectStage;
  value: number;
  owner: string | null;
  key_contact: string | null;
  contact_email: string | null;
  notes: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export type ActivityType = 'email' | 'call' | 'meeting' | 'note' | 'stage_change' | 'proposal';

export interface ProspectActivity {
  id: string;
  prospect_id: string;
  activity_type: ActivityType;
  title: string;
  body: string | null;
  created_at: string;
}

export type OwnerType = 'jonesy' | 'client';

export interface ActionItem {
  id: string;
  client_id: string;
  prospect_id: string | null;
  title: string;
  owner_type: OwnerType;
  assignee: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export type UpdateSource = 'email' | 'manual' | 'meeting';

export interface ClientUpdate {
  id: string;
  client_id: string;
  prospect_id: string | null;
  source: UpdateSource;
  title: string;
  body: string | null;
  action_required: boolean;
  gmail_thread_id: string | null;
  gmail_message_id: string | null;
  from_address: string | null;
  created_at: string;
}

export type ProposalStatus = 'draft' | 'approved' | 'upcoming';

export interface Proposal {
  id: string;
  client_id: string;
  prospect_id: string | null;
  title: string;
  content: string;
  status: ProposalStatus;
  briefing: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReport {
  id: string;
  client_id: string;
  week_start: string;
  pipeline_updates: string | null;
  meetings: string | null;
  actions: string | null;
  next_focus: string | null;
  stats: Record<string, unknown> | null;
  created_at: string;
}

export type BDLeadStatus = 'contact' | 'engaged' | 'proposal_sent' | 'closed' | 'need_contact';
export type BDLeadTier = 'tier_0' | 'tier_1' | 'tier_2' | 'tier_3';

export interface BDLead {
  id: string;
  org_id: string;
  team_lead: string | null;
  status: BDLeadStatus;
  partner: string;
  sector: string | null;
  key_contact: string | null;
  tier: BDLeadTier | null;
  editorial_concept: string | null;
  est_value: number;
  source: string | null;
  intro_made: boolean;
  moved_to_suite: boolean;
  next_step: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// UI constants

export const SERVICE_STAGES: { name: ServiceStageName; label: string }[] = [
  { name: 'strategy', label: 'Strategy' },
  { name: 'pipeline', label: 'Pipeline' },
  { name: 'activation', label: 'Activation' },
  { name: 'introductions', label: 'Introductions' },
  { name: 'production', label: 'Production' },
  { name: 'execution', label: 'Execution' },
  { name: 'renewal', label: 'Renewal' },
];

export const STAGE_STATUS_CONFIG: Record<ServiceStageStatus, { color: string; bg: string; label: string }> = {
  complete: { color: 'text-teal-700', bg: 'bg-teal-500', label: 'Complete' },
  in_progress: { color: 'text-amber-700', bg: 'bg-amber-500', label: 'In Progress' },
  not_started: { color: 'text-gray-400', bg: 'bg-gray-300', label: 'Not Started' },
};

export const PROSPECT_STAGE_CONFIG: Record<ProspectStage, { label: string; color: string; bg: string }> = {
  intro_call: { label: 'Intro Call', color: 'text-blue-700', bg: 'bg-blue-50' },
  meeting_set: { label: 'Meeting Set', color: 'text-purple-700', bg: 'bg-purple-50' },
  proposal_sent: { label: 'Proposal Sent', color: 'text-amber-700', bg: 'bg-amber-50' },
  negotiation: { label: 'Negotiation', color: 'text-orange-700', bg: 'bg-orange-50' },
  stalled: { label: 'Stalled', color: 'text-coral-700', bg: 'bg-red-50' },
  closed_won: { label: 'Closed Won', color: 'text-teal-700', bg: 'bg-teal-50' },
  closed_lost: { label: 'Closed Lost', color: 'text-gray-600', bg: 'bg-gray-50' },
};

export const RETAINER_STATUS_CONFIG: Record<RetainerStatus, { label: string; color: string; bg: string; dot: string }> = {
  active: { label: 'Active', color: 'text-teal-700', bg: 'bg-teal-50', dot: 'bg-teal-500' },
  at_risk: { label: 'At Risk', color: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  renewal_due: { label: 'Renewal Due', color: 'text-coral-700', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  churned: { label: 'Churned', color: 'text-gray-600', bg: 'bg-gray-50', dot: 'bg-gray-400' },
};

// Helpers
export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function monthsBetween(start: string, end: string): { current: number; total: number } {
  const s = new Date(start);
  const e = new Date(end);
  const now = new Date();
  const total = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  const elapsed = Math.max(0, Math.min(total, Math.round((now.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30))));
  return { current: elapsed + 1, total };
}
