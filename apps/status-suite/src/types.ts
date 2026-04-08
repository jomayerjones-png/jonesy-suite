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

export interface StageEvent {
  stage: PipelineStage;
  date: string;
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
  lastContact: string;
  createdAt: string;
  tags: string[];
  proposals: SavedProposal[];
  industry: string;
  outcome: 'active' | 'won' | 'lost';
  lostReason: string;
  stageHistory: StageEvent[];
}

export type View = 'pipeline' | 'report' | 'proposal' | 'analytics' | 'engagement' | 'bd';

export interface SavedProposal {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  briefing?: ProposalFormData;
  clientNotes?: string;
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

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

export const SAMPLE_CLIENTS: Client[] = [
  {
    id: generateId(),
    name: 'Maggie Schmerin',
    company: 'United Airlines',
    email: '',
    phone: '',
    value: 200000,
    stage: 'Engaged',
    notes: 'Travel partnership — destination storytelling. Waiting for response.',
    lastContact: daysAgo(3),
    createdAt: daysAgo(14),
    tags: ['travel', 'storytelling'],
    proposals: [],
    industry: 'Travel',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Alison Stransky',
    company: 'Samsung',
    email: '',
    phone: '',
    value: 300000,
    stage: 'Meeting Set',
    notes: 'Call set for April 21st. Shoot on phone concept.',
    lastContact: daysAgo(2),
    createdAt: daysAgo(10),
    tags: ['tech', 'creative'],
    proposals: [],
    industry: 'Technology',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Alex Schultz',
    company: 'Meta',
    email: '',
    phone: '',
    value: 500000,
    stage: 'Proposal Sent',
    notes: 'Custom proposal sent. Meeting May 1st — still developing proposal.',
    lastContact: daysAgo(4),
    createdAt: daysAgo(21),
    tags: ['tech', 'social'],
    proposals: [],
    industry: 'Technology',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Franz Paasche',
    company: 'Verizon',
    email: '',
    phone: '',
    value: 250000,
    stage: 'Meeting Set',
    notes: 'Call set for Wed 25th. Follow up next week — mention live streaming.',
    lastContact: daysAgo(5),
    createdAt: daysAgo(12),
    tags: ['tech', 'telecom'],
    proposals: [],
    industry: 'Technology',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Kaila Roi',
    company: 'AT&T',
    email: '',
    phone: '',
    value: 350000,
    stage: 'Engaged',
    notes: 'Want storytelling, not brand reach. Live video sponsored by ATT wifi concept.',
    lastContact: daysAgo(6),
    createdAt: daysAgo(18),
    tags: ['tech', 'telecom', 'video'],
    proposals: [],
    industry: 'Technology',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
];
