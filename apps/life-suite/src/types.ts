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
  date: string; // YYYY-MM-DD
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
}

export type View = 'pipeline' | 'report' | 'proposal' | 'analytics' | 'roadmap' | 'bd';

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

// LIFE founding partner pipeline data
const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

export const SAMPLE_CLIENTS: Client[] = [
  // --- Tier 01: Integration Partners ---
  {
    id: generateId(),
    name: 'Chris Cox',
    company: 'Meta',
    email: '',
    phone: '',
    value: 1500000,
    stage: 'Meeting Set',
    notes: 'Exploring Meta glasses as a capture technology for LIFE storytellers. BTS social content angle is strong — aligns with their Orion push. Meeting confirmed with their partnerships team.',
    lastContact: daysAgo(2),
    createdAt: daysAgo(18),
    tags: ['tier-1', 'integration', 'technology'],
    proposals: [],
    industry: '',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'TJ Kang',
    company: 'Samsung',
    email: '',
    phone: '',
    value: 2000000,
    stage: 'Proposal Sent',
    notes: 'Content shot and displayed on Samsung surfaces across the book, social, and LIFE Studios events. Strong visual storytelling angle. Awaiting response from their brand team.',
    lastContact: daysAgo(5),
    createdAt: daysAgo(30),
    tags: ['tier-1', 'integration', 'technology', 'hardware'],
    proposals: [],
    industry: '',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Scott Belsky',
    company: 'Adobe',
    email: '',
    phone: '',
    value: 1200000,
    stage: 'Engaged',
    notes: "Positioning Adobe as the creative backbone of LIFE's first year — the world's best creatives use Adobe. Warm reception from their CMO office. Follow-up call to be scheduled.",
    lastContact: daysAgo(4),
    createdAt: daysAgo(10),
    tags: ['tier-1', 'integration', 'creative', 'software'],
    proposals: [],
    industry: '',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },

  // --- Tier 02: Storytelling & Editorial Franchise Partners ---
  {
    id: generateId(),
    name: 'Lisa Materazzo',
    company: 'Toyota',
    email: '',
    phone: '',
    value: 1800000,
    stage: 'Proposal Sent',
    notes: "Storytelling franchise: conversations with talent on the road, BTS of shoots, connecting stories across America. Excellent fit for their 'Let's Go Places' positioning. Decision expected end of month.",
    lastContact: daysAgo(6),
    createdAt: daysAgo(35),
    tags: ['tier-2', 'storytelling', 'automotive', 'franchise'],
    proposals: [],
    industry: '',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Luc Bondar',
    company: 'United Airlines',
    email: '',
    phone: '',
    value: 1600000,
    stage: 'Meeting Set',
    notes: "Bringing the first year of LIFE to United's premium members. LIFE Studios produces special features on United's key destinations. Second meeting scheduled — they want destination storytelling examples.",
    lastContact: daysAgo(3),
    createdAt: daysAgo(22),
    tags: ['tier-2', 'storytelling', 'aviation', 'premium'],
    proposals: [],
    industry: '',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Diego Scotti',
    company: 'Verizon',
    email: '',
    phone: '',
    value: 1400000,
    stage: 'Engaged',
    notes: "Performance through the lens of sport in the build-up to LA28. Verizon's 5G + sport narrative maps cleanly onto LIFE's athletic storytelling. Exploring the Optimized Self editorial series.",
    lastContact: daysAgo(7),
    createdAt: daysAgo(14),
    tags: ['tier-2', 'storytelling', 'telecom', 'sport', 'la28'],
    proposals: [],
    industry: '',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
  {
    id: generateId(),
    name: 'Arnaud Boetsch',
    company: 'Rolex',
    email: '',
    phone: '',
    value: 2500000,
    stage: 'Feedback',
    notes: "Long-Term Thinking with Rolex Perpetual Planet. Special distribution at Rolex events. Deep in conversation — they've reviewed the proposal and requested clarification on event integration scope.",
    lastContact: daysAgo(4),
    createdAt: daysAgo(45),
    tags: ['tier-2', 'storytelling', 'luxury', 'long-term-thinking', 'high-value'],
    proposals: [],
    industry: '',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },

  // --- Tier 03: Brand Access & Cultural Sponsorship ---
  {
    id: generateId(),
    name: 'Antoine Arnault',
    company: 'LVMH',
    email: '',
    phone: '',
    value: 750000,
    stage: 'Engaged',
    notes: "Cultural sponsorship conversation. Logo presence, launch event co-branding, and co-branded marketing. Strong alignment between LIFE's editorial aesthetic and LVMH house positioning. Early stage.",
    lastContact: daysAgo(9),
    createdAt: daysAgo(12),
    tags: ['tier-3', 'sponsorship', 'luxury', 'fashion'],
    proposals: [],
    industry: '',
    outcome: 'active',
    lostReason: '',
    stageHistory: [],
  },
];
