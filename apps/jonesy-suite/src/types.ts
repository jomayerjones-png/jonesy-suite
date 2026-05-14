export type PipelineStage = 'Engaged' | 'Meeting Set' | 'Proposal Sent' | 'Revised Proposal Sent' | 'Feedback' | 'Close';

export const PIPELINE_STAGES: PipelineStage[] = [
  'Engaged',
  'Meeting Set',
  'Proposal Sent',
  'Revised Proposal Sent',
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
  'Revised Proposal Sent': {
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
    icon: '📝',
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

export interface MeetingNote {
  id: string;
  date: string;
  attendees: string;
  notes: string;
  takeaways: string;
  createdAt: string;
}

export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface NewsArticle {
  title: string;
  source: string;
  url?: string;
}

export interface NewsCache {
  fetchedAt: string;
  summary: string;
  articles: NewsArticle[];
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
  documents: ProjectDocument[];
  meetingNotes?: MeetingNote[];
  thread?: ThreadMessage[];
  newsCache?: NewsCache;
  gmailSynced?: boolean;
  emailCount?: number;
}

export type View = 'pipeline' | 'report' | 'proposal' | 'analytics' | 'projects';

export interface ProjectDocument {
  id: string;
  name: string;
  size: number;       // bytes
  type: string;       // MIME type
  dataUrl: string;    // base64 data URL for local storage
  uploadedAt: string; // ISO datetime
}

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

export const SAMPLE_CLIENTS: Client[] = [];
