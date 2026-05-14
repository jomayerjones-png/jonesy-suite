export type PipelineStage = 'Prospect' | 'Engaged' | 'Meeting Set' | 'Proposal Sent' | 'Feedback' | 'Revised Proposal Sent' | 'Close';

export const PIPELINE_STAGES: PipelineStage[] = [
  'Prospect',
  'Engaged',
  'Meeting Set',
  'Proposal Sent',
  'Feedback',
  'Revised Proposal Sent',
  'Close',
];

export const STAGE_CONFIG: Record<
  PipelineStage,
  { color: string; bg: string; border: string; dot: string; icon: string }
> = {
  Prospect: {
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    icon: '◌',
  },
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
  'Revised Proposal Sent': {
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    icon: '📝',
  },
  Close: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    icon: '✅',
  },
};

export interface StageEvent {
  stage: PipelineStage;
  date: string; // YYYY-MM-DD
}

export interface ClientContact {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  callNotes: string;
}

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
  proposals: SavedProposal[];
  industry: string;
  outcome: 'active' | 'won' | 'lost';
  lostReason: string;
  stageHistory: StageEvent[];
  callNotes?: string;
  contacts?: ClientContact[];
}

export type View = 'pipeline' | 'bd' | 'roadmap' | 'report' | 'proposal' | 'analytics';

export interface SavedProposal {
  id: string;
  title: string;    // extracted from first H1 heading
  content: string;  // full markdown
  createdAt: string; // ISO datetime
  briefing?: ProposalFormData;  // the form inputs used to generate
  clientNotes?: string;         // pipeline notes at time of generation
}

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
export const isStale = (lastContact: string, days = 15): boolean => {
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

// Prof G pipeline data
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
    company: 'Spotify',
    email: '',
    phone: '',
    value: 500000,
    stage: 'Meeting Set',
    notes: 'Podcast distribution partnership. Prof G pod ad-supported tier integration. Meeting with their partnerships VP next week.',
    lastContact: daysAgo(2),
    createdAt: daysAgo(14),
    tags: ['media', 'podcast', 'distribution'],
    proposals: [],
    industry: 'Media',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Mark Thompson',
    company: 'CNN',
    email: '',
    phone: '',
    value: 750000,
    stage: 'Proposal Sent',
    notes: 'Weekly segment deal — Prof G analysis on markets and tech. Awaiting feedback from programming team.',
    lastContact: daysAgo(4),
    createdAt: daysAgo(28),
    tags: ['media', 'broadcast', 'recurring'],
    proposals: [],
    industry: 'Media',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Julia Hartz',
    company: 'Eventbrite',
    email: '',
    phone: '',
    value: 300000,
    stage: 'Engaged',
    notes: 'Sprint education series — live events platform for Prof G masterclasses. Initial conversation warm.',
    lastContact: daysAgo(5),
    createdAt: daysAgo(10),
    tags: ['edtech', 'events', 'education'],
    proposals: [],
    industry: 'Technology',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Ryan Clark',
    company: 'HubSpot',
    email: '',
    phone: '',
    value: 400000,
    stage: 'Feedback',
    notes: 'Content partnership for SMB audience. Prof G brand strategy course co-marketed through HubSpot Academy. Reviewing terms.',
    lastContact: daysAgo(3),
    createdAt: daysAgo(35),
    tags: ['saas', 'education', 'content'],
    proposals: [],
    industry: 'Technology',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Dara Treseder',
    company: 'Autodesk',
    email: '',
    phone: '',
    value: 600000,
    stage: 'Proposal Sent',
    notes: 'Speaking engagement series — future of work and AI in creative industries. Proposal sent to CMO office.',
    lastContact: daysAgo(6),
    createdAt: daysAgo(20),
    tags: ['speaking', 'technology', 'ai'],
    proposals: [],
    industry: 'Technology',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
];
