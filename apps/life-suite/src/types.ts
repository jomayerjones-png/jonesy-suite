export type PipelineStage = 'Prospect' | 'Engaged' | 'Meeting Set' | 'Proposal Sent' | 'Feedback' | 'Close';

export const PIPELINE_STAGES: PipelineStage[] = [
  'Prospect',
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

export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO datetime
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
  thread?: ThreadMessage[];
}

export type View = 'pipeline' | 'report' | 'proposal' | 'analytics' | 'roadmap';

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
export const isStale = (lastContact: string, stage: PipelineStage, days = 7): boolean => {
  if (stage === 'Prospect') return false;
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


// LIFE BD pipeline data — April 2026
export const DATA_VERSION = '2026-04-bd-v2';

const _today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(_today);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

const mk = (
  name: string, company: string, stage: PipelineStage,
  value: number, tags: string[], industry: string, notes: string,
  lastContactDays: number, createdDays: number,
  outcome: 'active' | 'won' | 'lost' = 'active',
  lostReason = ''
): Client => ({
  id: generateId(),
  name, company, email: '', phone: '',
  value, stage, notes,
  lastContact: daysAgo(lastContactDays),
  createdAt: daysAgo(createdDays),
  tags, proposals: [], industry,
  outcome, lostReason,
  stageHistory: [{ stage, date: daysAgo(createdDays) }],
});

export const SAMPLE_CLIENTS: Client[] = [

  // ── TRAVEL ───────────────────────────────────────────────────────────────────
  mk('Maggie Jenks Daly', 'Airbnb', 'Engaged', 2500000,
    ['tier-0', 'travel', 'gbv', 'nm'], 'Travel',
    'Lead: GBV. Next: NM to engage. Head of Talent & Entertainment — start there.', 7, 14),

  mk('Stephanie Goldstein', 'Marriott International', 'Engaged', 1500000,
    ['tier-2', 'travel', 'jmj'], 'Travel',
    'Lead: JMJ. Tier 2 outreach.', 10, 21),

  mk('Mark Weinstein', 'Hilton', 'Engaged', 1500000,
    ['tier-2', 'travel', 'jmj'], 'Travel',
    'Lead: JMJ. Tier 2 outreach.', 8, 18),

  mk('Maggie Schmerin', 'United Airlines', 'Engaged', 1500000,
    ['tier-1', 'travel', 'jmj'], 'Travel',
    'Lead: JMJ. Waiting for response.', 5, 22),

  mk('Kamaria Morgan', 'Delta', 'Engaged', 2500000,
    ['tier-0', 'travel', 'gbv', 'jmj'], 'Travel',
    'Lead: GBV / GBV connecting JMJ. Thinking about LIFE from the beginning — in line with their customer priority approach.', 6, 8),

  // ── TECH ─────────────────────────────────────────────────────────────────────
  mk('Jordan Newman', 'Spotify', 'Engaged', 2500000,
    ['tier-0', 'tech', 'jmj', 'rs'], 'Tech',
    'Lead: JMJ / RS. Waiting for response. Secondary: Joe Hadley, Marc Hazan, Alex Norstrom (CEO). KK > Alex — JMJ working through proactive idea.', 4, 15),

  mk('Kaila Roi', 'AT&T', 'Meeting Set', 1500000,
    ['tier-1', 'tech', 'jmj'], 'Tech',
    'Lead: JMJ. Call set Tuesday 31st. Want storytelling, not brand reach. Live video sponsored by AT&T WiFi — how are we promoting a specific part of their business.', 2, 20),

  mk('Alison Stransky', 'Samsung', 'Meeting Set', 1500000,
    ['tier-1', 'tech', 'jmj'], 'Tech',
    'Lead: JMJ. Call set April 21st. Shoot on phone angle.', 1, 25),

  mk('Grace Koh', 'Microsoft', 'Engaged', 750000,
    ['tier-2', 'tech', 'jmj'], 'Tech',
    'Lead: JMJ. Waiting for response. Follow up with Michiel.', 9, 17),

  mk('Franz Paasche', 'Verizon', 'Meeting Set', 1500000,
    ['tier-1', 'tech', 'jmj'], 'Tech',
    'Lead: JMJ. Call set Wed 25th. Mention live streaming note on follow-up.', 1, 14),

  mk('Alex Schultz', 'Meta', 'Proposal Sent', 1500000,
    ['tier-1', 'tech', 'jmj'], 'Tech',
    'Lead: JMJ. Custom proposal sent. Meeting May 1st — still developing proposal.', 1, 18),

  mk('Timothee Verrechia', 'Apple', 'Meeting Set', 2500000,
    ['tier-0', 'tech', 'nm', 'gbv'], 'Tech',
    'Lead: NM / GBV connecting JMJ. Call set for Tuesday. Has shepherded KWK relationship and helped on i-D.', 1, 10),

  mk('Chris Waller', 'Google', 'Proposal Sent', 2500000,
    ['tier-0', 'tech', 'jmj', 'nm'], 'Tech',
    'Lead: JMJ / NM. General proposal sent as follow-up. Secondary: Enshalla.', 3, 20),

  mk('Zenia Muche', 'TikTok', 'Engaged', 750000,
    ['tier-2', 'tech', 'jmj'], 'Tech',
    'Lead: JMJ. Need to send general presentation.', 11, 16),

  mk('Stacy Sharpe', 'Adobe', 'Engaged', 2500000,
    ['tier-0', 'tech', 'jmj'], 'Tech',
    'Lead: JMJ. Waiting for response.', 6, 12),

  mk('TBD', 'Vanta', 'Prospect', 750000,
    ['tier-2', 'tech'], 'Tech',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('TBD', 'Public', 'Prospect', 750000,
    ['tier-2', 'tech'], 'Tech',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('TBD', 'BetterHelp', 'Prospect', 1500000,
    ['tier-1', 'tech'], 'Tech',
    'Tier 1. No contact identified yet.', 14, 14),

  mk('TBD', 'Plaid', 'Prospect', 1500000,
    ['tier-1', 'tech'], 'Tech',
    'Tier 1. No contact identified yet.', 14, 14),

  mk('TBD', 'WorkOS', 'Prospect', 750000,
    ['tier-2', 'tech'], 'Tech',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('TBD', 'Sentry', 'Prospect', 750000,
    ['tier-2', 'tech'], 'Tech',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('Harley Finkelstein', 'Shopify', 'Engaged', 2500000,
    ['tier-0', 'tech', 'kk'], 'Tech',
    'Lead: KK.', 7, 7),

  mk('TBD', 'HubSpot', 'Prospect', 750000,
    ['tier-2', 'tech'], 'Tech',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('TBD', 'Figma', 'Prospect', 1500000,
    ['tier-1', 'tech'], 'Tech',
    'Tier 1. No contact identified yet.', 14, 14),

  mk('TBD', 'Slack', 'Prospect', 1500000,
    ['tier-1', 'tech'], 'Tech',
    'Tier 1. No contact identified yet.', 14, 14),

  mk('TBD', 'Uber', 'Prospect', 1500000,
    ['tier-1', 'tech'], 'Tech',
    'Tier 1. No contact identified yet.', 14, 14),

  mk('TBD', 'Robinhood', 'Prospect', 750000,
    ['tier-2', 'tech'], 'Tech',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('TBD', 'AppLovin', 'Prospect', 750000,
    ['tier-2', 'tech'], 'Tech',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('TBD', 'Crowdstrike', 'Prospect', 750000,
    ['tier-2', 'tech'], 'Tech',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('TBD', 'Gusto', 'Prospect', 750000,
    ['tier-2', 'tech'], 'Tech',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('TBD', 'Okta', 'Prospect', 750000,
    ['tier-2', 'tech'], 'Tech',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('TBD', 'Amazon', 'Prospect', 1500000,
    ['tier-1', 'tech'], 'Tech',
    'Tier 1. No contact identified yet.', 14, 14),

  mk('TBD', 'Nothing Tech', 'Prospect', 1500000,
    ['tier-1', 'consumer-tech'], 'Consumer Tech',
    'Tier 1. No contact identified yet.', 14, 14),

  mk('TBD', 'Whoop', 'Prospect', 750000,
    ['tier-2', 'consumer-tech', 'mimi'], 'Consumer Tech',
    'Lead: Mimi Sheng.', 7, 7),

  mk('TBD', 'Retro', 'Prospect', 750000,
    ['tier-2', 'consumer-tech', 'mimi'], 'Consumer Tech',
    'Lead: Mimi Sheng.', 7, 7),

  // ── RETAIL ───────────────────────────────────────────────────────────────────
  mk('TBD', 'Patagonia', 'Prospect', 750000,
    ['retail'], 'Retail',
    'No contact identified yet.', 14, 14),

  mk('Kathy Baird', 'McDonald\'s', 'Engaged', 300000,
    ['tier-3', 'retail', 'jmj'], 'Retail',
    'Lead: JMJ. Waiting for response.', 8, 13),

  mk('TBD', 'Leica', 'Prospect', 750000,
    ['tier-2', 'retail', 'jmj', 'rs'], 'Retail',
    'Lead: JMJ / RS. Need contact.', 14, 14),

  mk('Doc Noe', 'Yeti', 'Close', 750000,
    ['tier-2', 'retail', 'jmj'], 'Retail',
    'Lead: JMJ. Closed — focused on more endemic publications.',
    30, 60, 'lost', 'Focused on more endemic publications'),

  mk('Denisse Goldbarg', 'Kodak', 'Engaged', 750000,
    ['tier-2', 'retail', 'jmj', 'rs'], 'Retail',
    'Lead: JMJ / RS.', 7, 15),

  mk('Alex Griffin', 'On Running', 'Engaged', 1500000,
    ['tier-1', 'retail', 'rs'], 'Retail',
    'Lead: RS.', 5, 10),

  mk('Michael McSwain', 'Nike', 'Meeting Set', 2500000,
    ['tier-0', 'retail', 'jmj'], 'Retail',
    'Lead: JMJ. Call set for April.', 3, 11),

  mk('Alice Chen', 'adidas', 'Engaged', 1500000,
    ['tier-1', 'retail', 'gbv', 'jmj'], 'Retail',
    'Lead: GBV / GBV connecting JMJ. More advice conversation.', 7, 7),

  mk('Andra Mielnicki', 'Cartier', 'Engaged', 750000,
    ['tier-2', 'luxury', 'retail', 'gbv'], 'Luxury',
    'Lead: GBV. NA CMO first, then Arnaud Carrez (Global CMO). Tier 2 — fleshed out.', 9, 9),

  mk('Rebekah McCabe', 'Chanel', 'Engaged', 1500000,
    ['tier-1', 'luxury', 'retail', 'gbv', 'kk'], 'Luxury',
    'Lead: GBV / KK. Secondary: Leena Nair. Paused.', 21, 21),

  // ── LUXURY ───────────────────────────────────────────────────────────────────
  mk('Delphine Arnault', 'LVMH / Louis Vuitton', 'Engaged', 2500000,
    ['tier-0', 'luxury', 'jmj', 'gbv'], 'Luxury',
    'Lead: JMJ / GBV. GBV to introduce JMJ.', 9, 12),

  mk('Krista Breyer', 'Rolex', 'Engaged', 1500000,
    ['tier-1', 'luxury'], 'Luxury',
    'Engaged. Need to send proposal.', 4, 45),

  mk('TBD', 'Tiffany', 'Prospect', 1500000,
    ['tier-1', 'luxury'], 'Luxury',
    'Tier 1. No contact identified yet.', 14, 14),

  // ── HEALTHCARE ───────────────────────────────────────────────────────────────
  mk('TBD', 'Pfizer', 'Prospect', 750000,
    ['tier-2', 'healthcare'], 'Healthcare',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('TBD', 'Lilly', 'Prospect', 750000,
    ['tier-2', 'healthcare'], 'Healthcare',
    'Tier 2. No contact identified yet.', 14, 14),

  // ── FINANCIAL SERVICES ───────────────────────────────────────────────────────
  mk('Patti Sachs', 'Citi', 'Engaged', 1500000,
    ['tier-1', 'financial', 'jmj'], 'Financial Services',
    'Lead: JMJ. Waiting for response. Wealth management angle.', 7, 20),

  mk('Jess Schnuss', 'Morgan Stanley', 'Engaged', 1500000,
    ['tier-1', 'financial', 'jmj'], 'Financial Services',
    'Lead: JMJ. Waiting for response. Women executives focus.', 6, 18),

  mk('Kim Grant', 'Bank of America', 'Engaged', 1500000,
    ['tier-1', 'financial', 'jmj'], 'Financial Services',
    'Lead: JMJ. Waiting for response. "Bank for all Americans" — World Cup a priority. Newspaper execution?', 5, 16),

  mk('Jill Kramer', 'Mastercard', 'Engaged', 1500000,
    ['tier-1', 'financial', 'jmj'], 'Financial Services',
    'Lead: JMJ. Tier 1. Alternative contact needed.', 10, 15),

  mk('Carla Hassan', 'JPMorgan Chase', 'Engaged', 2500000,
    ['tier-0', 'financial', 'jmj'], 'Financial Services',
    'Lead: JMJ. JMJ to contact.', 14, 14),

  mk('Kirk Peterson', 'Prudential / PGIM', 'Engaged', 750000,
    ['tier-2', 'financial'], 'Financial Services',
    'Tier 2.', 14, 14),

  mk('Lou Aversano', 'Fidelity', 'Meeting Set', 1500000,
    ['tier-1', 'financial', 'jmj'], 'Financial Services',
    'Lead: JMJ. Call set Monday 30th.', 2, 12),

  mk('Elizabeth Rutledge', 'American Express', 'Engaged', 2500000,
    ['tier-0', 'financial', 'kk', 'gbv'], 'Financial Services',
    'Lead: KK / GBV.', 8, 12),

  mk('Mary Ann Reilly', 'Visa', 'Engaged', 1500000,
    ['tier-1', 'financial', 'gbv'], 'Financial Services',
    'Lead: GBV. Secondary: Kim Kadlec (NA + EMEA CMO).', 9, 13),

  mk('TBD', 'Capital One', 'Prospect', 1500000,
    ['tier-1', 'financial', 'gbv'], 'Financial Services',
    'Lead: GBV. Comms Lead Cait is consulting for their CMO — can ask for intro.', 10, 10),

  mk('TBD', 'Ramp', 'Prospect', 2500000,
    ['tier-0', 'financial', 'mimi'], 'Financial Services',
    'Lead: Mimi Sheng. Riley or JK can make intro.', 7, 7),

  mk('Joe Benarroch', 'NYSE', 'Meeting Set', 750000,
    ['tier-2', 'financial', 'jmj'], 'Financial Services',
    'Lead: JMJ. Call on Thursday.', 1, 9),

  mk('TBD', 'Plaid', 'Prospect', 1500000,
    ['tier-1', 'financial'], 'Financial Services',
    'Tier 1. No contact identified yet.', 14, 14),

  // ── AUTOMOTIVE ───────────────────────────────────────────────────────────────
  mk('Shenan Reed', 'GM', 'Engaged', 1500000,
    ['tier-1', 'automotive', 'jmj'], 'Automotive',
    'Lead: JMJ. Waiting for response.', 5, 15),

  mk('TBD', 'BMW', 'Prospect', 1500000,
    ['tier-1', 'automotive'], 'Automotive',
    'Tier 1. No contact identified yet.', 14, 14),

  mk('TBD', 'Volkswagen', 'Prospect', 1500000,
    ['tier-1', 'automotive'], 'Automotive',
    'Tier 1. No contact identified yet.', 14, 14),

  mk('TBD', 'Jaguar Land Rover', 'Prospect', 2500000,
    ['tier-0', 'automotive'], 'Automotive',
    'Tier 0. No contact identified yet.', 14, 14),

  mk('TBD', 'Rivian', 'Prospect', 750000,
    ['tier-2', 'automotive'], 'Automotive',
    'Tier 2. No contact identified yet.', 14, 14),

  mk('TBD', 'Waymo', 'Prospect', 1500000,
    ['tier-1', 'automotive'], 'Automotive',
    'Tier 1. No contact identified yet.', 14, 14),

  // ── ENTERTAINMENT / STREAMING ────────────────────────────────────────────────
  mk('Marian Lee', 'Netflix', 'Engaged', 2500000,
    ['tier-0', 'entertainment', 'streaming'], 'Entertainment',
    'Tier 0. Initial contact stage.', 14, 14),

  // ── BEAUTY ───────────────────────────────────────────────────────────────────
  mk('Johnette Read', "L'Oreal", 'Engaged', 1500000,
    ['tier-1', 'beauty'], 'Beauty',
    'Tier 1. Initial contact stage.', 14, 14),

  mk('Yuna Park', 'Nutrafol', 'Engaged', 750000,
    ['tier-2', 'beauty', 'jmj'], 'Beauty',
    'Lead: JMJ. Waiting for response.', 6, 14),

  mk('Jane Hudis', 'Estée Lauder Companies', 'Engaged', 1500000,
    ['tier-1', 'beauty', 'gbv'], 'Beauty',
    'Lead: GBV. CBO — can deploy to individual brands after first pitch.', 8, 8),

  mk('Ana Trias', 'Puig', 'Engaged', 1500000,
    ['tier-1', 'beauty', 'fashion', 'gbv'], 'Beauty',
    'Lead: GBV. CBO — sits across house of brands, set up individual brands after first pitch.', 8, 8),

  // ── CULTURE ──────────────────────────────────────────────────────────────────
  mk('TBD', 'Art Museums', 'Prospect', 0,
    ['culture', 'arts'], 'Culture',
    'Cultural partnership network.', 14, 14),

].map(c => ({ ...c, value: 0 }));
