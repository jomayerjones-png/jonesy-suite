export type PipelineStage = 'Engaged' | 'Meeting Set' | 'Proposal Sent' | 'Feedback' | 'Close';

export const PIPELINE_STAGES: PipelineStage[] = [
  'Engaged',
  'Meeting Set',
  'Proposal Sent',
  'Feedback',
  'Close',
];

export const STAGE_CONFIG: Record<
  PipelineStage,
  { color: string; bg: string; border: string; dot: string; icon: string }
> = {
  Engaged: {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    icon: '💬',
  },
  'Meeting Set': {
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    icon: '📅',
  },
  'Proposal Sent': {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    icon: '📄',
  },
  Feedback: {
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    icon: '💭',
  },
  Close: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    icon: '✅',
  },
};

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  value: number;
  stage: PipelineStage;
  notes: string;
  lastContact: string; // ISO date string (YYYY-MM-DD)
  createdAt: string;   // ISO date string
  tags: string[];
}

export type View = 'pipeline' | 'report' | 'proposal';

export interface ProposalFormData {
  clientName: string;
  company: string;
  industry: string;
  challenge: string;
  currentState: string;
  desiredOutcome: string;
  successMetrics: string;
  budget: string;
  timeline: string;
  additionalContext: string;
}

// Helpers
export const isStale = (lastContact: string, days = 7): boolean => {
  const last = new Date(lastContact).getTime();
  const now = Date.now();
  return (now - last) / (1000 * 60 * 60 * 24) > days;
};

export const formatCurrency = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
};

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const daysSince = (dateStr: string): number => {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
};

export const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Sample data for first load
const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

export const SAMPLE_CLIENTS: Client[] = [
  {
    id: generateId(),
    name: 'Sarah Chen',
    company: 'TechFlow Inc.',
    email: 'sarah@techflow.io',
    phone: '+1 (415) 555-0192',
    value: 45000,
    stage: 'Engaged',
    notes: 'Initial discovery call went well. Looking for brand strategy overhaul ahead of Series B.',
    lastContact: daysAgo(3),
    createdAt: daysAgo(14),
    tags: ['brand', 'startup', 'series-b'],
  },
  {
    id: generateId(),
    name: 'Marcus Johnson',
    company: 'Pinnacle Brands',
    email: 'mjohnson@pinnaclebrands.com',
    phone: '+1 (212) 555-0847',
    value: 120000,
    stage: 'Meeting Set',
    notes: 'Meeting confirmed for next Tuesday. CMO will be joining. Prepare case studies.',
    lastContact: daysAgo(1),
    createdAt: daysAgo(21),
    tags: ['enterprise', 'retail', 'cmo'],
  },
  {
    id: generateId(),
    name: 'Elena Rodriguez',
    company: 'Nexus Capital',
    email: 'erodriguez@nexuscap.com',
    phone: '+1 (305) 555-0334',
    value: 85000,
    stage: 'Proposal Sent',
    notes: 'Proposal submitted last week. Awaiting board review. High probability of close.',
    lastContact: daysAgo(5),
    createdAt: daysAgo(30),
    tags: ['financial', 'high-value'],
  },
  {
    id: generateId(),
    name: 'David Park',
    company: 'Summit Analytics',
    email: 'dpark@summitanalytics.ai',
    phone: '+1 (628) 555-0711',
    value: 200000,
    stage: 'Feedback',
    notes: 'Requested revisions to timeline and pricing. Need to follow up — has not responded.',
    lastContact: daysAgo(9),
    createdAt: daysAgo(45),
    tags: ['enterprise', 'ai', 'needs-followup'],
  },
  {
    id: generateId(),
    name: 'Amanda Foster',
    company: 'Vertex Design Co.',
    email: 'afoster@vertexdesign.com',
    phone: '+1 (512) 555-0229',
    value: 67500,
    stage: 'Close',
    notes: 'Contracts signed. Kickoff call scheduled for next Monday. Celebrate! 🎉',
    lastContact: daysAgo(2),
    createdAt: daysAgo(60),
    tags: ['design', 'won'],
  },
  {
    id: generateId(),
    name: 'James Wright',
    company: 'Meridian Group',
    email: 'jwright@meridiangroup.co',
    phone: '+1 (617) 555-0583',
    value: 55000,
    stage: 'Engaged',
    notes: 'Warm intro from Amanda Foster. Interested in rebranding for new product line.',
    lastContact: daysAgo(10),
    createdAt: daysAgo(12),
    tags: ['referral', 'brand'],
  },
  {
    id: generateId(),
    name: 'Lisa Thompson',
    company: 'Aurora Ventures',
    email: 'lisa@auroraventures.vc',
    phone: '+1 (650) 555-0947',
    value: 150000,
    stage: 'Meeting Set',
    notes: 'Video call next Wednesday. They want a full service retainer — great opportunity.',
    lastContact: daysAgo(4),
    createdAt: daysAgo(18),
    tags: ['vc', 'retainer', 'high-value'],
  },
  {
    id: generateId(),
    name: 'Robert Kim',
    company: 'Cascade Systems',
    email: 'rkim@cascadesys.com',
    phone: '+1 (206) 555-0162',
    value: 95000,
    stage: 'Proposal Sent',
    notes: 'Proposal sent 8 days ago. No response. Consider following up via LinkedIn.',
    lastContact: daysAgo(8),
    createdAt: daysAgo(35),
    tags: ['tech', 'stale'],
  },
];
