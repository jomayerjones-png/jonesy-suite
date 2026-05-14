import { useState, useRef, useCallback, useEffect } from 'react';
import { Client, ProposalFormData, SavedProposal, generateId, formatCurrency, daysSince } from '../../types';

// Lazy-load pdfjs-dist only when needed (PDF upload) to avoid crashing the
// component if the worker file fails to load.
let pdfjsLib: typeof import('pdfjs-dist') | null = null;
async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url,
    ).toString();
  }
  return pdfjsLib;
}

// --- Reference Documents ---
interface RefDoc {
  id: string;
  name: string;
  content: string;
  addedAt: string;
}

const REF_DOCS_STORAGE_KEY = 'jonesy_ref_docs';

function loadRefDocs(): RefDoc[] {
  try {
    const stored = localStorage.getItem(REF_DOCS_STORAGE_KEY);
    if (stored) return JSON.parse(stored) as RefDoc[];
  } catch { /* ignore */ }
  return [];
}

function saveRefDocs(docs: RefDoc[]) {
  localStorage.setItem(REF_DOCS_STORAGE_KEY, JSON.stringify(docs));
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

async function readPdfAsText(file: File): Promise<string> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(text);
  }
  return pages.join('\n\n');
}

async function readFileContent(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.pdf')) {
    return readPdfAsText(file);
  }
  return readFileAsText(file);
}

interface ProposalGeneratorProps {
  companyName: string;
  clients: Client[];
  onSaveToClient: (clientId: string, proposal: SavedProposal) => void;
}

function extractTitle(markdown: string): string {
  const match = markdown.match(/^# (.+)$/m);
  return match?.[1]?.trim() ?? 'Untitled Proposal';
}

const EMPTY_FORM: ProposalFormData = {
  clientName: '',
  company: '',
  industry: '',
  challenge: '',
  currentState: '',
  desiredOutcome: '',
  successMetrics: '',
  budget: '',
  timeline: '',
  additionalContext: '',
};

type ProposalFormat = 'full' | 'onesheet' | 'reversebrief';
type ProposalLength = 'concise' | 'standard' | 'comprehensive';
type ProposalTone = 'confident' | 'collaborative' | 'formal';
type ChatMessage = { role: 'user' | 'assistant'; content: string };

const FORMAT_OPTIONS: { value: ProposalFormat; label: string; desc: string }[] = [
  { value: 'full', label: 'Full Proposal', desc: 'Labyrinth Framework' },
  { value: 'onesheet', label: 'One Sheet', desc: 'Commercial Strategy Brief' },
  { value: 'reversebrief', label: 'Reverse Brief', desc: 'Qualify & discover' },
];

const SECTION_DEFS = [
  { id: 'context', label: 'Context & Diagnosis', desc: 'Where they stand & what we see' },
  { id: 'approach', label: 'Approach', desc: 'The Labyrinth Framework™' },
  { id: 'engagement', label: 'Engagement', desc: 'What we\'ll do together' },
  { id: 'outcomes', label: 'Outcomes', desc: 'Where they\'ll arrive' },
  { id: 'commercial', label: 'Commercial Terms', desc: 'Investment structure' },
  { id: 'gettingStarted', label: 'Getting Started', desc: 'How we begin' },
] as const;

type SectionId = typeof SECTION_DEFS[number]['id'];

const ALL_SECTIONS: Record<SectionId, boolean> = {
  context: true, approach: true, engagement: true,
  outcomes: true, commercial: true, gettingStarted: true,
};

const LENGTH_OPTIONS: { value: ProposalLength; label: string; desc: string }[] = [
  { value: 'concise', label: 'Concise', desc: '~500 words' },
  { value: 'standard', label: 'Standard', desc: '~800–1200 words' },
  { value: 'comprehensive', label: 'Comprehensive', desc: '~1500+ words' },
];

const TONE_OPTIONS: { value: ProposalTone; label: string; desc: string }[] = [
  { value: 'confident', label: 'Confident', desc: 'Authoritative advisor' },
  { value: 'collaborative', label: 'Collaborative', desc: 'Partnership-first' },
  { value: 'formal', label: 'Formal', desc: 'Corporate / institutional' },
];

const SECTION_INSTRUCTIONS: Record<SectionId, string> = {
  context: `1. CONTEXT & DIAGNOSIS — "Where You Stand — And What We See"
Open with the client's reality — what they have built, what momentum exists. Then name the specific tension between where they are and where they want to be. Be precise and show deep understanding. Then deliver "Our read:" — a single sentence naming the root cause, followed by a reframe that shifts how they think about the problem.`,
  approach: `2. APPROACH — "How We Work: The Labyrinth Framework™"
Present the four-phase framework as a table:
| Phase | Workstream Focus | Key Deliverable |
Show which phases are most critical for this client.`,
  engagement: `3. ENGAGEMENT — "What We Will Do Together"
State the engagement duration and number of workstreams upfront. Then detail each phase/workstream with a name, the months it covers, and a substantive paragraph describing the work. Be concrete — vague proposals lose.`,
  outcomes: `4. OUTCOMES — "Where You Will Arrive"
Paint a vivid, specific picture of the transformed state at the end of the engagement. One powerful paragraph, not a list.`,
  commercial: `5. COMMERCIAL TERMS — "Your Investment"
Frame the investment before stating the number. Anchor it to outcomes, not hours. Present as a markdown table:
| Milestone | Period | Investment |
With a total row at the bottom. Always state "A fixed fee of $X for the [duration] engagement" before the table.`,
  gettingStarted: `6. GETTING STARTED — "How We Begin"
Three specific actions in the first two weeks. Week one: what happens. Week two: what begins. End of month one: first deliverable.`,
};

function buildSystemPrompt(
  companyName: string,
  length: ProposalLength,
  tone: ProposalTone,
  sections: Record<SectionId, boolean>,
  referenceDocs: RefDoc[] = [],
): string {
  const activeSections = SECTION_DEFS.filter(s => sections[s.id]);
  const sectionInstructions = activeSections
    .map(s => SECTION_INSTRUCTIONS[s.id])
    .join('\n\n');

  const lengthGuide = {
    concise: 'Keep the proposal concise — approximately 400–600 words of body content. Be direct and economical with language. Every sentence should earn its place.',
    standard: 'Aim for a comprehensive but readable proposal — approximately 800–1200 words of body content.',
    comprehensive: 'Write a thorough, detailed proposal — approximately 1500–2000 words of body content. Expand on each section with deeper analysis, more specifics, and richer narrative.',
  }[length];

  const toneGuide = {
    confident: 'Write with the confidence of a trusted advisor who has seen this situation before. Be direct, authoritative, and assertive in your diagnosis and recommendations.',
    collaborative: 'Write as a collaborative partner. Use "we" language, invite dialogue, and position the engagement as a joint venture. Warm but professional.',
    formal: 'Write in a formal, institutional tone. Structured, measured, and precise. Suitable for corporate procurement processes and board presentations.',
  }[tone];

  return `You are a senior strategist and principal writer at ${companyName}, crafting bespoke client proposals using The Labyrinth Framework™.

THE LABYRINTH FRAMEWORK™
Every ${companyName} engagement runs through four connected phases. Most organisations run these separately — strategy in one room, sales in another, execution somewhere else. We operate across all four.

Phase I — Definition: Clarify what is being sold, to whom, and why it wins. Delivers: Commercial thesis + refined value proposition.
Phase II — Commercial Development: Build pipeline, make introductions, convert conversations into signed agreements. Delivers: Qualified pipeline + market feedback.
Phase III — Execution & Delivery: Structure agreements, protect scope and margin, oversee delivery. Delivers: Live campaigns + commercial playbook.
Phase IV — Renewal & Expansion: Measure performance, strengthen relationships, identify growth. Delivers: Renewal strategy + expanded pipeline.

PROPOSAL STRUCTURE
Include ONLY the following sections, in this order:

${sectionInstructions}

${activeSections.some(s => s.id === 'gettingStarted') ? `Always end the proposal with this exact closing line:
"If any element of this proposal deserves challenge or refinement, we welcome that conversation."

Then sign off with:
${companyName}
revenue@jonesyco.com` : ''}

COVER FORMAT
The proposal title should follow this pattern:
# [Compelling Headline That Captures The Engagement Essence]
Then immediately below:
**A [Service Type] Partnership for [Client Company]**
**Prepared for [Contact Name], [Client Company]**
**[Current Month, Year]**
*Confidential · Prepared exclusively for [Client Company]*

TONE: ${toneGuide}

LENGTH: ${lengthGuide}

STYLE GUIDELINES:
- Lead with their reality before presenting your solution
- Use sophisticated vocabulary but never obscure meaning with jargon
- Paragraphs over bullet points wherever possible — this is strategic writing, not a slide deck
- Each section should be substantive but not exhaustive — leave room for conversation
- The proposal should read as a coherent narrative, not a checklist
- Use markdown tables for the Framework overview and Investment structure

Format using markdown. Use ## for section headings. Begin with the cover block as described above.`

  + (referenceDocs.length > 0 ? `

REFERENCE MATERIAL WEIGHTING
You have been provided with reference documents below. These are the primary source of truth for this proposal.
- All content must be grounded in the reference material and the brief provided. Do not invent facts, case studies, metrics, or client details not present in those sources.
- Use the reference documents for frameworks, language, positioning, pricing, and examples.
- Where the brief leaves gaps, write around them or flag with [TO CONFIRM] rather than inventing specifics.
- Mirror the tone, terminology, and strategic framing found in the reference material.

REFERENCE DOCUMENTS:
${referenceDocs.map(d => `--- ${d.name} ---\n${d.content}\n--- END ${d.name} ---`).join('\n\n')}` : '');
}

function buildUserPrompt(form: ProposalFormData, companyName: string): string {
  return `Please write a full Labyrinth Framework proposal for the following engagement:

CLIENT: ${form.clientName}
COMPANY: ${form.company}${form.industry ? `\nINDUSTRY: ${form.industry}` : ''}

CHALLENGE / PROBLEM THEY FACE:
${form.challenge}

CURRENT STATE (where they are now):
${form.currentState || 'Not specified — work from the challenge and context provided only.'}

DESIRED OUTCOME (what success looks like):
${form.desiredOutcome}

${form.successMetrics ? `SUCCESS METRICS:\n${form.successMetrics}\n` : ''}
${form.budget ? `BUDGET RANGE: ${form.budget}\n` : ''}
${form.timeline ? `DESIRED TIMELINE: ${form.timeline}\n` : ''}
${form.additionalContext ? `ADDITIONAL CONTEXT:\n${form.additionalContext}\n` : ''}

Write a complete, polished Labyrinth Framework proposal as if you are a senior partner at ${companyName} presenting this to ${form.clientName} at ${form.company}. This should be ready to share with the client.`;
}

function buildOneSheetSystemPrompt(
  companyName: string,
  tone: ProposalTone,
  referenceDocs: RefDoc[] = [],
): string {
  const toneGuide = {
    confident: 'Write with the confidence of a trusted advisor who has done the listening. Be direct and authoritative.',
    collaborative: 'Write as a collaborative partner. Warm but professional, positioning the engagement as a joint venture.',
    formal: 'Write in a formal, institutional tone. Structured, measured, and precise.',
  }[tone];

  return `You are a senior strategist at ${companyName}, writing a one-page Commercial Strategy Brief for a prospective client.

IMPORTANT PERSPECTIVE:
This document is written FROM ${companyName}'s perspective ABOUT the client. You are the expert who has done the listening.
- "We" always refers to ${companyName}
- Refer to the client by their company name or "you" / "your"
- Position ${companyName} as the knowledgeable advisor presenting back what they have understood

DOCUMENT STRUCTURE — follow this exact structure:

# [CLIENT COMPANY] — Commercial Strategy Brief
**Prepared for [Contact Name] | [Current Month Year]**

## The Business
A concise paragraph describing the client's business, key brands/products, and market position. Demonstrate that ${companyName} has done the research and understands their world. End with a single sentence identifying the core strategic tension — product-market fit exists, but what's missing.

## The Opportunity
Describe the specific commercial opportunity ${companyName} has identified. Include concrete numbers from the brief if available (pipeline size, deal velocity issues, new concepts needing validation). Be specific about what's working and where friction exists.

## Scope
Break the engagement into clearly defined workstreams. For each workstream:
**Workstream [N] — [Name]**
* Bullet-pointed deliverables and activities
* Each bullet should be concrete and actionable
* 3–5 bullets per workstream

## What Success Looks Like
* 4–6 bullet points describing measurable or observable outcomes
* Each bullet should be specific enough to evaluate against
* Include both immediate deliverables and lasting capability improvements
* Final bullet should reference the team's ability to operate independently

## Constraints
* 3–4 bullet points identifying non-negotiable boundaries
* These show awareness of the client's reality and build trust
* Include operational, editorial/brand, and timeline constraints

## Investment
A single paragraph: "We propose a fixed-fee engagement structured around milestones and outcomes, not hours. The engagement will be phased, with actionable findings from an initial diagnostic stage delivered within the first 30 days."

Then sign off with:
**${companyName}** | Johanna Mayer-Jones | jomayerjones@gmail.com

TONE: ${toneGuide}

LENGTH: This is a one-sheet brief — keep it tight and scannable. Approximately 400–600 words total. Every sentence must earn its place. No padding.

STYLE:
- Clean, confident, no jargon
- Bullet points are appropriate here — this is a brief, not a narrative proposal
- No emojis, no decorative elements
- The document should feel like something a senior consultant hands across the table
- Use markdown formatting throughout`

  + (referenceDocs.length > 0 ? `

REFERENCE MATERIAL WEIGHTING
All content must come from the reference material and brief. Do not invent facts, metrics, or case studies not present in those sources. Flag missing information as [TO CONFIRM] rather than filling gaps with invented content.

REFERENCE DOCUMENTS:
${referenceDocs.map(d => `--- ${d.name} ---\n${d.content}\n--- END ${d.name} ---`).join('\n\n')}` : '');
}

function buildOneSheetUserPrompt(form: ProposalFormData, companyName: string): string {
  return `Write a Commercial Strategy Brief (one-sheet) for the following engagement:

CLIENT: ${form.clientName}
COMPANY: ${form.company}${form.industry ? `\nINDUSTRY: ${form.industry}` : ''}

CHALLENGE / OPPORTUNITY:
${form.challenge}

CURRENT STATE:
${form.currentState || 'Not specified — work from the challenge and context provided only.'}

DESIRED OUTCOME:
${form.desiredOutcome}

${form.successMetrics ? `SUCCESS METRICS:\n${form.successMetrics}\n` : ''}
${form.budget ? `BUDGET RANGE: ${form.budget}\n` : ''}
${form.timeline ? `DESIRED TIMELINE: ${form.timeline}\n` : ''}
${form.additionalContext ? `ADDITIONAL CONTEXT:\n${form.additionalContext}\n` : ''}

Write the complete one-sheet as ${companyName} presenting this to ${form.clientName} at ${form.company}. This should be ready to share with the client.`;
}

function buildReverseBriefSystemPrompt(
  companyName: string,
  tone: ProposalTone,
  referenceDocs: RefDoc[] = [],
): string {
  const toneGuide = {
    confident: 'Write with the confidence of someone who has done their homework. Be direct about what you see and what you still need to learn.',
    collaborative: 'Write as a collaborative partner exploring the opportunity together. Warm but analytically rigorous.',
    formal: 'Write in a formal, structured tone. Precise and measured.',
  }[tone];

  return `You are a senior strategist at ${companyName}, preparing an internal Reverse Brief — a pre-proposal qualifying document that captures your understanding of a prospective client BEFORE writing a formal proposal.

PURPOSE:
The Reverse Brief is NOT a proposal. It is an internal document that:
1. Forces structured thinking about whether this is the right engagement
2. Surfaces what we know vs. what we're assuming
3. Identifies the specific questions we need answered before committing to a proposal
4. Assesses strategic, commercial, and timing fit
5. Sketches what the engagement would look like IF we proceed

IMPORTANT PERSPECTIVE:
- "We" = ${companyName}
- This is written FOR the ${companyName} team, not for the client
- Be candid — this is where honest assessment happens
- Flag assumptions explicitly
- Distinguish between what we know (from conversations, public info) and what we're inferring

DOCUMENT STRUCTURE — follow this exact structure:

# Reverse Brief — [Client Company]
**Prepared by ${companyName} | [Current Month Year]**
*Internal document — not for client distribution*

## What We Know
A substantive summary of the prospect's business, market position, current situation, and what has surfaced in conversations so far. Be specific. Cite what came from conversation vs. public information. If reference documents are provided, draw heavily from them. End with a clear statement of what the prospect has asked for or expressed interest in.

## What We Think We See
${companyName}'s hypothesis — the strategic tension or opportunity we believe exists, even if the prospect hasn't fully articulated it. This is the "diagnosis before the pitch." Be bold but flag it as a hypothesis. Frame it as: "Based on what we know, our read is..."

## Open Questions
A numbered list of 6–8 specific questions that MUST be answered before a proposal can be written. These should surface:
1. Budget / investment appetite — not "what's your budget?" but smarter versions
2. Decision-making structure — who decides, who influences, what's the process
3. Timeline and urgency — why now, what happens if they wait
4. Prior attempts — what they've tried, why it didn't work
5. Success criteria — what does the client actually measure
6. Internal constraints — politics, sensitivities, competing priorities
7. Competitive landscape — who else they're talking to
8. Scope boundaries — what's in, what's explicitly out

Each question should include a brief note on WHY we need this answer and what it would change about our approach.

## Fit Assessment
A candid, structured assessment using three dimensions:

**Strategic Fit** — Does this align with what ${companyName} does best? Is this the kind of problem we solve? Rate: Strong / Moderate / Weak, with a sentence explaining why.

**Commercial Fit** — Is the likely value proportional to the effort? Is there a path to the right fee level? Rate: Strong / Moderate / Weak / Unknown, with reasoning.

**Timing Fit** — Are they ready to act? Is there urgency or is this exploratory? Rate: Ready / Warming / Early, with evidence.

**Overall Assessment** — One sentence: proceed, proceed with caution, or pass — and why.

## If We Proceed
A sketch of what the engagement would likely look like — not a full proposal, but enough to test the shape:
- Likely workstreams (2–3, named and described in one sentence each)
- Estimated duration
- Investment range (if enough information exists to estimate)
- Which phase of the Labyrinth Framework™ this maps to
- Key risks or dependencies

Sign off with:
**${companyName}** | Internal Use Only

TONE: ${toneGuide}

LENGTH: Thorough but efficient — approximately 600–900 words. This is a working document, not a presentation.

STYLE:
- Analytical and candid — no sales language
- Use bold headers and bullets for scannability
- Flag assumptions with [ASSUMPTION] tags where relevant
- Distinguish facts from inferences
- Use markdown formatting throughout`

  + (referenceDocs.length > 0 ? `

REFERENCE MATERIAL:
These documents contain information about the prospect. Use them as primary source material.

${referenceDocs.map(d => `--- ${d.name} ---\n${d.content}\n--- END ${d.name} ---`).join('\n\n')}` : '');
}

function buildReverseBriefUserPrompt(form: ProposalFormData, companyName: string, clientContext: string): string {
  return `Prepare a Reverse Brief for the following prospect:

CLIENT: ${form.clientName}
COMPANY: ${form.company}${form.industry ? `\nINDUSTRY: ${form.industry}` : ''}

WHAT WE KNOW SO FAR:
${form.challenge || 'Limited information — use reference documents and public knowledge to build the picture.'}

${form.currentState ? `CURRENT SITUATION:\n${form.currentState}\n` : ''}
${form.desiredOutcome ? `WHAT THEY'VE EXPRESSED INTEREST IN:\n${form.desiredOutcome}\n` : ''}
${form.additionalContext ? `ADDITIONAL CONTEXT & NOTES:\n${form.additionalContext}\n` : ''}
${clientContext ? `\nPIPELINE DATA:\n${clientContext}\n` : ''}

Write the complete Reverse Brief as ${companyName}'s internal qualifying document. Be candid and analytical — this is for our team, not the client.`;
}

function buildClientContext(client: Client): string {
  const parts: string[] = [];
  parts.push(`Pipeline Stage: ${client.stage}`);
  parts.push(`Deal Value: ${formatCurrency(client.value)}`);
  if (client.industry) parts.push(`Industry: ${client.industry}`);
  if (client.tags.length > 0) parts.push(`Tags: ${client.tags.join(', ')}`);
  parts.push(`Days in Pipeline: ${daysSince(client.createdAt)}`);
  if (client.proposals.length > 0) {
    parts.push(`Previous Proposals: ${client.proposals.length} (latest: "${client.proposals[client.proposals.length - 1].title}", ${new Date(client.proposals[client.proposals.length - 1].createdAt).toLocaleDateString()})`);
  }
  if (client.notes) parts.push(`Pipeline Notes: ${client.notes}`);
  if (client.outcome !== 'active') parts.push(`Outcome: ${client.outcome}${client.lostReason ? ` — ${client.lostReason}` : ''}`);
  return parts.join('\n');
}

// Simple markdown-to-HTML renderer for display
function renderMarkdown(text: string): string {
  return text
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|u|o|b|l])/gm, '')
    .trim();
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-semibold text-brand-dark text-sm uppercase tracking-wider border-b border-brand-cream pb-2.5">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function ProposalGenerator({ companyName, clients, onSaveToClient }: ProposalGeneratorProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState<ProposalFormData>(EMPTY_FORM);
  const [proposal, setProposal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [savedClientId, setSavedClientId] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const proposalRef = useRef<HTMLDivElement>(null);

  // New state for editing, refinement, and options
  const [editing, setEditing] = useState(false);
  const [refinementInput, setRefinementInput] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [format, setFormat] = useState<ProposalFormat>('full');
  const [length, setLength] = useState<ProposalLength>('standard');
  const [tone, setTone] = useState<ProposalTone>('confident');
  const [sections, setSections] = useState<Record<SectionId, boolean>>({ ...ALL_SECTIONS });
  const refinementRef = useRef<HTMLInputElement>(null);

  // Reference documents
  const [refDocs, setRefDocs] = useState<RefDoc[]>(loadRefDocs);
  const [uploadingRef, setUploadingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Proposal Library
  const [view, setView] = useState<'generator' | 'library'>('generator');
  const [libraryProposal, setLibraryProposal] = useState<{ proposal: SavedProposal; clientName: string; company: string } | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<'final' | 'all'>('final');

  useEffect(() => {
    saveRefDocs(refDocs);
  }, [refDocs]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingRef(true);
    try {
      const newDocs: RefDoc[] = [];
      for (const file of Array.from(files)) {
        const content = await readFileContent(file);
        newDocs.push({
          id: generateId(),
          name: file.name,
          content,
          addedAt: new Date().toISOString(),
        });
      }
      setRefDocs(prev => [...prev, ...newDocs]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeRefDoc = (id: string) => {
    setRefDocs(prev => prev.filter(d => d.id !== id));
  };

  const toggleSection = (id: SectionId) => {
    setSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const set = <K extends keyof ProposalFormData>(key: K, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const validateForm = (): string | null => {
    if (!apiKey.trim()) return 'Please enter your Anthropic API key.';
    if (!form.clientName.trim()) return 'Client name is required.';
    if (!form.company.trim()) return 'Company name is required.';
    if (format === 'reversebrief') return null; // reverse brief needs minimal input
    if (!form.challenge.trim()) return 'The challenge/problem description is required.';
    if (!form.desiredOutcome.trim()) return 'The desired outcome is required.';
    return null;
  };

  const streamResponse = useCallback(async (messages: ChatMessage[]) => {
    abortRef.current = new AbortController();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        stream: true,
        system: format === 'reversebrief'
          ? buildReverseBriefSystemPrompt(companyName, tone, refDocs)
          : format === 'onesheet'
            ? buildOneSheetSystemPrompt(companyName, tone, refDocs)
            : buildSystemPrompt(companyName, length, tone, sections, refDocs),
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
      signal: abortRef.current.signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = (errData as { error?: { message?: string } })?.error?.message ?? `HTTP ${response.status}`;
      throw new Error(msg);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data) as {
            type: string;
            delta?: { type: string; text?: string };
          };
          if (
            parsed.type === 'content_block_delta' &&
            parsed.delta?.type === 'text_delta' &&
            parsed.delta.text
          ) {
            fullText += parsed.delta.text;
            setProposal(fullText);
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    return fullText;
  }, [apiKey, companyName, format, length, tone, sections, refDocs]);

  const generate = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    setError('');
    setProposal('');
    setLoading(true);
    setEditing(false);

    const selectedClient = clients.find(c => c.id === selectedClientId);
    const clientCtx = selectedClient ? buildClientContext(selectedClient) : '';

    // For non-reverse-brief formats, inject reverse brief from client's proposals if available
    let enrichedForm = form;
    if (format !== 'reversebrief' && selectedClient) {
      const existingReverseBrief = selectedClient.proposals.find(p => p.title.startsWith('Reverse Brief'));
      if (existingReverseBrief) {
        const reverseBriefContext = `\n\n--- REVERSE BRIEF (internal qualifying document) ---\n${existingReverseBrief.content}\n--- END REVERSE BRIEF ---`;
        enrichedForm = { ...form, additionalContext: (form.additionalContext || '') + reverseBriefContext };
      }
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: format === 'reversebrief'
        ? buildReverseBriefUserPrompt(form, companyName, clientCtx)
        : format === 'onesheet'
          ? buildOneSheetUserPrompt(enrichedForm, companyName)
          : buildUserPrompt(enrichedForm, companyName),
    };
    const messages = [userMessage];

    try {
      const fullText = await streamResponse(messages);
      setHistory([userMessage, { role: 'assistant', content: fullText }]);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [apiKey, form, companyName, streamResponse]);

  const refine = useCallback(async () => {
    if (!refinementInput.trim() || !proposal) return;
    if (!apiKey.trim()) { setError('Please enter your Anthropic API key.'); return; }

    setError('');
    setLoading(true);
    setEditing(false);

    const refinementMessage: ChatMessage = {
      role: 'user',
      content: `Here is the current proposal:\n\n${proposal}\n\n---\n\nPlease revise the proposal based on this feedback: ${refinementInput}\n\nReturn the COMPLETE revised proposal in full — do not return only the changed section. Maintain the same format and structure.`,
    };

    const messages = [...history, refinementMessage];
    setProposal('');

    try {
      const fullText = await streamResponse(messages);
      setHistory(prev => [...prev, refinementMessage, { role: 'assistant', content: fullText }]);
      setRefinementInput('');
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [apiKey, proposal, refinementInput, history, streamResponse]);

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const copyProposal = async () => {
    await navigator.clipboard.writeText(proposal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadFromClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    setForm(prev => ({
      ...prev,
      clientName: client.name,
      company: client.company,
      industry: client.industry || prev.industry,
      additionalContext: client.notes ? `Pipeline notes: ${client.notes}` : prev.additionalContext,
    }));
    setSelectedClientId(clientId);
  };

  const saveToClient = () => {
    if (!selectedClientId || !proposal) return;
    const client = clients.find(c => c.id === selectedClientId);
    const saved: SavedProposal = {
      id: generateId(),
      title: extractTitle(proposal),
      content: proposal,
      createdAt: new Date().toISOString(),
      briefing: { ...form },
      clientNotes: client?.notes || '',
    };
    onSaveToClient(selectedClientId, saved);
    setSavedClientId(selectedClientId);
  };

  const clearAll = () => {
    setProposal('');
    setForm(EMPTY_FORM);
    setError('');
    setSavedClientId('');
    setHistory([]);
    setEditing(false);
    setRefinementInput('');
  };

  const enabledCount = Object.values(sections).filter(Boolean).length;

  const shareProposal = () => {
    const title = proposal ? extractTitle(proposal) : 'Proposal';
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`Please find the attached proposal: ${title}\n\nTo download the PDF, open the proposal in ${companyName} Suite and click "Download PDF".`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  };

  // Proposal Library data
  const allProposals = clients.flatMap(c =>
    (c.proposals ?? []).map(p => ({ proposal: p, clientName: c.name, company: c.company }))
  ).sort((a, b) => new Date(b.proposal.createdAt).getTime() - new Date(a.proposal.createdAt).getTime());

  const finalProposals = allProposals.filter(p => p.proposal.title.toLowerCase().includes('final'));
  const libraryItems = libraryFilter === 'final' ? finalProposals : allProposals;

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1cm; size: A4; }
          body { background: white !important; font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .proposal-form-panel { display: none !important; }
          .proposal-toolbar { display: none !important; }
          .proposal-refinement { display: none !important; }
          .proposal-output { overflow: visible !important; }
          .proposal-output > div { overflow: visible !important; }
          .prose-proposal { font-size: 10pt; line-height: 1.4; }
          .prose-proposal h1 { font-size: 18pt !important; }
          .prose-proposal h2 { font-size: 13pt !important; }
          .prose-proposal h3 { font-size: 11pt !important; }
        }
      `}</style>
      <div className="flex h-full overflow-hidden">
        {/* Form panel */}
        <div className="w-96 flex-shrink-0 bg-white border-r border-brand-cream flex flex-col overflow-hidden proposal-form-panel">
        <div className="px-5 py-4 border-b border-brand-cream">
          <h2 className="font-display text-xl font-semibold text-brand-dark">Proposal Generator</h2>
          <p className="text-xs text-brand-dark/50 mt-0.5">Powered by the Labyrinth Framework & Claude</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Load from client */}
          {clients.length > 0 && (
            <div className="bg-brand-light border border-brand-cream rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-brand-gold text-sm">⬡</span>
                <label className="text-xs font-semibold text-brand-dark uppercase tracking-wider">Load from Pipeline</label>
              </div>
              <select
                className="input-field text-sm"
                value={selectedClientId}
                onChange={e => loadFromClient(e.target.value)}
              >
                <option value="">Select a client to pre-fill…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.company}</option>
                ))}
              </select>
              <p className="text-xs text-brand-dark/40">Pre-fills name, company & notes</p>
            </div>
          )}

          {/* API Key */}
          <div className="bg-brand-light border border-brand-cream rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-brand-gold text-sm">🔑</span>
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wider">Anthropic API Key</label>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                className="input-field pr-16 font-mono text-xs"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-brand-dark/40 hover:text-brand-dark px-1.5 py-0.5 rounded"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-brand-dark/40 leading-relaxed">
              Your key is used only in-browser and never stored or transmitted to any third party.
              Get one at{' '}
              <span className="text-brand-gold underline cursor-default">console.anthropic.com</span>
            </p>
          </div>

          {/* Reference Documents */}
          <div className="bg-brand-light border border-brand-cream rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-brand-gold text-sm">📄</span>
                <label className="text-xs font-semibold text-brand-dark uppercase tracking-wider">Reference Documents</label>
              </div>
              {refDocs.length > 0 && (
                <span className="text-xs text-brand-dark/40 bg-brand-gold/10 rounded-full px-2 py-0.5 font-medium">
                  60% weighted
                </span>
              )}
            </div>

            {refDocs.length > 0 && (
              <div className="space-y-1.5">
                {refDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-brand-cream">
                    <span className="text-xs">📎</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-brand-dark truncate">{doc.name}</p>
                      <p className="text-xs text-brand-dark/35">{(doc.content.length / 1000).toFixed(1)}k chars</p>
                    </div>
                    <button
                      onClick={() => removeRefDoc(doc.id)}
                      className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 px-1"
                      title="Remove document"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,.json,.html,.rtf,.pdf"
              multiple
              className="hidden"
              onChange={e => handleFileUpload(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingRef}
              className="btn-secondary w-full text-xs py-2 flex items-center justify-center gap-1.5"
            >
              {uploadingRef ? (
                <span className="animate-shimmer">Reading files…</span>
              ) : (
                <>+ Upload Reference Files</>
              )}
            </button>
            <p className="text-xs text-brand-dark/40 leading-relaxed">
              Upload briefs, frameworks, past proposals, brand docs, or any reference files. Content is weighted 60/40 against Claude's knowledge.
              Accepts .pdf, .md, .txt, .csv, .json, .html, .rtf
            </p>
          </div>

          {/* Client info */}
          <FormSection title="Client Information">
            <div>
              <label className="label">Client Name *</label>
              <input className="input-field" value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Sarah Chen" />
            </div>
            <div>
              <label className="label">Company *</label>
              <input className="input-field" value={form.company} onChange={e => set('company', e.target.value)} placeholder="TechFlow Inc." />
            </div>
            <div>
              <label className="label">Industry</label>
              <input className="input-field" value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="FinTech, Healthcare, Retail…" />
            </div>
          </FormSection>

          {/* Reverse brief context badge */}
          {format !== 'reversebrief' && selectedClientId && (() => {
            const cl = clients.find(c => c.id === selectedClientId);
            const rb = cl?.proposals.find(p => p.title.startsWith('Reverse Brief'));
            return rb ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
                <span className="text-emerald-500 text-sm mt-0.5">◈</span>
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Reverse Brief available — context loaded</p>
                  <p className="text-xs text-emerald-600/60 mt-0.5">"{rb.title}" will be injected as qualifying context into your proposal.</p>
                </div>
              </div>
            ) : null;
          })()}

          {/* Reverse brief: simplified input */}
          {format === 'reversebrief' ? (
            <FormSection title="What We Know">
              <div>
                <label className="label">What we know so far</label>
                <textarea
                  className="input-field resize-none"
                  rows={5}
                  value={form.challenge}
                  onChange={e => set('challenge', e.target.value)}
                  placeholder="Everything we know about this prospect — conversations, public info, mutual connections, what they've expressed interest in…"
                />
              </div>
              <div>
                <label className="label">Current situation</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  value={form.currentState}
                  onChange={e => set('currentState', e.target.value)}
                  placeholder="Their market position, team, recent moves, competitive landscape…"
                />
              </div>
              <div>
                <label className="label">What they've expressed interest in</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={form.desiredOutcome}
                  onChange={e => set('desiredOutcome', e.target.value)}
                  placeholder="Any specific ask or area of interest they've mentioned…"
                />
              </div>
              <div>
                <label className="label">Additional notes</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={form.additionalContext}
                  onChange={e => set('additionalContext', e.target.value)}
                  placeholder="Internal context, who introduced them, sensitivities, anything relevant…"
                />
              </div>
            </FormSection>
          ) : (
            <>
              {/* The challenge */}
              <FormSection title="The Challenge">
                <div>
                  <label className="label">Core Challenge / Problem *</label>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    value={form.challenge}
                    onChange={e => set('challenge', e.target.value)}
                    placeholder="What problem are they trying to solve? What's broken or missing? Be specific…"
                  />
                </div>
                <div>
                  <label className="label">Current State</label>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    value={form.currentState}
                    onChange={e => set('currentState', e.target.value)}
                    placeholder="Describe where they are today — operations, market position, team, technology…"
                  />
                </div>
              </FormSection>

              {/* Outcomes */}
              <FormSection title="Desired Outcomes">
                <div>
                  <label className="label">Desired Outcome *</label>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    value={form.desiredOutcome}
                    onChange={e => set('desiredOutcome', e.target.value)}
                    placeholder="What does success look like? What should be true 6 months from now?"
                  />
                </div>
                <div>
                  <label className="label">Success Metrics</label>
                  <textarea
                    className="input-field resize-none"
                    rows={2}
                    value={form.successMetrics}
                    onChange={e => set('successMetrics', e.target.value)}
                    placeholder="Revenue growth, NPS, operational efficiency, brand awareness…"
                  />
                </div>
              </FormSection>

              {/* Engagement */}
              <FormSection title="Engagement Details">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Budget Range</label>
                    <input className="input-field" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="$50K–75K" />
                  </div>
                  <div>
                    <label className="label">Timeline</label>
                    <input className="input-field" value={form.timeline} onChange={e => set('timeline', e.target.value)} placeholder="3–6 months" />
                  </div>
                </div>
                <div>
                  <label className="label">Additional Context</label>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    value={form.additionalContext}
                    onChange={e => set('additionalContext', e.target.value)}
                    placeholder="Key stakeholders, prior work done, competitors, sensitivities, tone notes…"
                  />
                </div>
              </FormSection>
            </>
          )}

          {/* Proposal Options */}
          <FormSection title="Proposal Options">
            {/* Format */}
            <div>
              <label className="label">Format</label>
              <div className="flex gap-1.5">
                {FORMAT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormat(opt.value)}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                      format === opt.value
                        ? 'bg-brand-gold text-brand-dark border-brand-gold-dark'
                        : 'bg-white text-brand-dark/60 border-brand-cream hover:border-brand-cream-dark'
                    }`}
                  >
                    <span className="block font-semibold">{opt.label}</span>
                    <span className={`block mt-0.5 ${format === opt.value ? 'text-brand-dark/60' : 'text-brand-dark/35'}`}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Length — full proposal only */}
            {format !== 'onesheet' && format !== 'reversebrief' && (
              <div>
                <label className="label">Length</label>
                <div className="flex gap-1.5">
                  {LENGTH_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLength(opt.value)}
                      className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                        length === opt.value
                          ? 'bg-brand-gold text-brand-dark border-brand-gold-dark'
                          : 'bg-white text-brand-dark/60 border-brand-cream hover:border-brand-cream-dark'
                      }`}
                    >
                      <span className="block font-semibold">{opt.label}</span>
                      <span className={`block mt-0.5 ${length === opt.value ? 'text-brand-dark/60' : 'text-brand-dark/35'}`}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tone */}
            <div>
              <label className="label">Tone</label>
              <div className="flex gap-1.5">
                {TONE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTone(opt.value)}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                      tone === opt.value
                        ? 'bg-brand-gold text-brand-dark border-brand-gold-dark'
                        : 'bg-white text-brand-dark/60 border-brand-cream hover:border-brand-cream-dark'
                    }`}
                  >
                    <span className="block font-semibold">{opt.label}</span>
                    <span className={`block mt-0.5 ${tone === opt.value ? 'text-brand-dark/60' : 'text-brand-dark/35'}`}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sections — full proposal only */}
            {format !== 'onesheet' && format !== 'reversebrief' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Sections to Include</label>
                  <button
                    type="button"
                    onClick={() => {
                      const allOn = enabledCount === SECTION_DEFS.length;
                      const next = {} as Record<SectionId, boolean>;
                      SECTION_DEFS.forEach(s => { next[s.id] = !allOn; });
                      setSections(next);
                    }}
                    className="text-xs text-brand-gold hover:text-brand-gold-dark"
                  >
                    {enabledCount === SECTION_DEFS.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {SECTION_DEFS.map(s => (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                        sections[s.id] ? 'bg-brand-gold/10 border border-brand-gold/25' : 'bg-brand-light border border-brand-cream hover:border-brand-cream-dark'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={sections[s.id]}
                        onChange={() => toggleSection(s.id)}
                        className="accent-brand-gold w-3.5 h-3.5 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-brand-dark">{s.label}</span>
                        <span className="text-xs text-brand-dark/40 ml-1.5">{s.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </FormSection>
        </div>

        {/* Generate button */}
        <div className="p-4 border-t border-brand-cream space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <span className="text-red-500 flex-shrink-0 mt-0.5">⚠</span>
              <p className="text-xs text-red-700 leading-relaxed">{error}</p>
            </div>
          )}
          <div className="flex gap-2">
            {loading ? (
              <button onClick={stop} className="flex-1 btn-danger py-2.5">
                ◼ Stop Generation
              </button>
            ) : (
              <button
                onClick={generate}
                className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2"
                disabled={loading}
              >
                <span>◈</span>
                {proposal ? 'Regenerate' : 'Generate'} {format === 'reversebrief' ? 'Reverse Brief' : format === 'onesheet' ? 'One Sheet' : 'Proposal'}
              </button>
            )}
            {proposal && !loading && (
              <button onClick={clearAll} className="btn-secondary px-3">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Proposal output */}
      <div className="flex-1 flex flex-col overflow-hidden bg-brand-light proposal-output">
        {/* View toggle: Generator / Library */}
        <div className="bg-white border-b border-brand-cream px-6 py-2 flex items-center gap-1 no-print">
          <button
            onClick={() => { setView('generator'); setLibraryProposal(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'generator' ? 'bg-brand-gold/15 text-brand-dark border border-brand-gold/30' : 'text-brand-dark/40 hover:text-brand-dark/60'}`}
          >
            Generator
          </button>
          <button
            onClick={() => setView('library')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${view === 'library' ? 'bg-brand-gold/15 text-brand-dark border border-brand-gold/30' : 'text-brand-dark/40 hover:text-brand-dark/60'}`}
          >
            Proposal Library
            {finalProposals.length > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${view === 'library' ? 'bg-brand-gold/20 text-brand-dark' : 'bg-brand-cream text-brand-dark/50'}`}>
                {finalProposals.length}
              </span>
            )}
          </button>
        </div>

        {/* Library view */}
        {view === 'library' && (
          <div className="flex-1 overflow-y-auto">
            {libraryProposal ? (
              <div className="max-w-3xl mx-auto p-8">
                <button
                  onClick={() => setLibraryProposal(null)}
                  className="text-xs text-brand-dark/50 hover:text-brand-dark mb-4 flex items-center gap-1"
                >
                  ← Back to library
                </button>
                <div className="mb-6 pb-4 border-b border-brand-cream">
                  <h2 className="font-display text-xl font-semibold text-brand-dark">{libraryProposal.proposal.title}</h2>
                  <p className="text-xs text-brand-dark/50 mt-1">
                    {libraryProposal.clientName} — {libraryProposal.company} · {new Date(libraryProposal.proposal.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div
                  className="prose-proposal"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(libraryProposal.proposal.content) || '' }}
                />
                <div className="mt-8 pt-4 border-t border-brand-cream flex gap-2">
                  <button
                    onClick={async () => { await navigator.clipboard.writeText(libraryProposal.proposal.content); }}
                    className="btn-secondary text-xs"
                  >
                    Copy
                  </button>
                  <button onClick={() => window.print()} className="btn-primary text-xs">
                    Download PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-brand-dark">Proposal Library</h3>
                      <p className="text-xs text-brand-dark/50 mt-0.5">
                        {libraryFilter === 'final'
                          ? `${finalProposals.length} final proposal${finalProposals.length !== 1 ? 's' : ''} across all clients`
                          : `${allProposals.length} proposal${allProposals.length !== 1 ? 's' : ''} across all clients`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-brand-light rounded-lg p-0.5 border border-brand-cream">
                      <button
                        onClick={() => setLibraryFilter('final')}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${libraryFilter === 'final' ? 'bg-white shadow-sm text-brand-dark' : 'text-brand-dark/40 hover:text-brand-dark/60'}`}
                      >
                        Finals Only
                      </button>
                      <button
                        onClick={() => setLibraryFilter('all')}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${libraryFilter === 'all' ? 'bg-white shadow-sm text-brand-dark' : 'text-brand-dark/40 hover:text-brand-dark/60'}`}
                      >
                        All Proposals
                      </button>
                    </div>
                  </div>

                  {libraryItems.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl text-brand-gold/60">📋</span>
                      </div>
                      <p className="text-sm text-brand-dark/50 mb-1">
                        {libraryFilter === 'final' ? 'No final proposals yet' : 'No proposals yet'}
                      </p>
                      <p className="text-xs text-brand-dark/30">
                        {libraryFilter === 'final'
                          ? 'Save proposals with "final" in the title to collect them here'
                          : 'Generate and save proposals to clients to build your library'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {libraryItems.map(item => {
                        const isFinal = item.proposal.title.toLowerCase().includes('final');
                        return (
                          <button
                            key={item.proposal.id}
                            onClick={() => setLibraryProposal(item)}
                            className="w-full text-left bg-white rounded-xl border border-brand-cream hover:border-brand-gold/30 hover:shadow-sm transition-all p-4 group"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-sm text-brand-dark truncate group-hover:text-brand-gold transition-colors">
                                    {item.proposal.title}
                                  </h4>
                                  {isFinal && (
                                    <span className="flex-shrink-0 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                                      FINAL
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-brand-dark/50">
                                  {item.clientName} — {item.company}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs text-brand-dark/40">
                                  {new Date(item.proposal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-brand-dark/30 mt-0.5">
                                  {(item.proposal.content.length / 1000).toFixed(1)}k chars
                                </p>
                              </div>
                            </div>
                            {item.proposal.content && (
                              <p className="text-xs text-brand-dark/40 mt-2 line-clamp-2 leading-relaxed">
                                {item.proposal.content.slice(0, 200).replace(/[#*_\-]/g, '')}…
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generator view */}
        {view === 'generator' && proposal && (
          <div className="bg-white border-b border-brand-cream px-6 py-3 space-y-2 proposal-toolbar">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-medium text-brand-dark">Proposal Ready</span>
                </div>
                {loading && (
                  <span className="text-xs text-brand-dark/50 animate-shimmer">Generating…</span>
                )}
                {history.length > 2 && !loading && (
                  <span className="text-xs text-brand-dark/40 bg-brand-light rounded-full px-2 py-0.5">
                    {Math.floor(history.length / 2)} revision{Math.floor(history.length / 2) > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!loading && (
                  <button
                    onClick={() => setEditing(v => !v)}
                    className={`btn-secondary flex items-center gap-1.5 ${editing ? 'bg-brand-gold/10 border-brand-gold/30 text-brand-dark' : ''}`}
                  >
                    {editing ? '◉ Preview' : '✎ Edit'}
                  </button>
                )}
                <button onClick={copyProposal} className="btn-secondary flex items-center gap-1.5">
                  {copied ? '✓ Copied!' : '⎘ Copy'}
                </button>
                <button onClick={shareProposal} className="btn-secondary flex items-center gap-1.5">
                  Share
                </button>
                <button onClick={() => window.print()} className="btn-primary flex items-center gap-1.5">
                  Download PDF
                </button>
              </div>
            </div>
            {/* Attach to client */}
            {!loading && clients.length > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-brand-cream">
                <span className="text-xs text-brand-dark/50 flex-shrink-0">Attach to:</span>
                <select
                  className="input-field py-1 text-xs flex-1"
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                >
                  <option value="">Select client…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.company}</option>
                  ))}
                </select>
                {savedClientId && savedClientId === selectedClientId ? (
                  <span className="text-xs text-emerald-600 font-semibold flex-shrink-0">✓ Saved</span>
                ) : (
                  <button
                    onClick={saveToClient}
                    disabled={!selectedClientId}
                    className="btn-primary py-1 px-3 text-xs flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save to record
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content area */}
        {view === 'generator' && (
        <div className="flex-1 overflow-y-auto">
          {!proposal && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              <div className="w-20 h-20 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mb-6">
                <span className="text-4xl text-brand-gold/60">◈</span>
              </div>
              {format === 'reversebrief' ? (
                <>
                  <h3 className="font-display text-2xl font-semibold text-brand-dark mb-2">
                    Reverse Brief
                  </h3>
                  <p className="text-brand-dark/50 max-w-sm text-sm leading-relaxed mb-6">
                    An internal qualifying document — captures what{' '}
                    <span className="text-brand-dark font-medium">{companyName}</span>{' '}
                    knows, what we think we see, and what we need to learn before writing a proposal.
                  </p>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                    {[
                      { label: 'What We Know', desc: 'Facts from conversations & research' },
                      { label: 'What We Think We See', desc: 'Our hypothesis & diagnosis' },
                      { label: 'Open Questions', desc: 'What must be answered first' },
                      { label: 'Fit Assessment', desc: 'Strategic, commercial & timing fit' },
                      { label: 'If We Proceed', desc: 'Sketch of likely engagement' },
                    ].map((item, i) => (
                      <div key={item.label} className="flex items-start gap-2.5 bg-white rounded-lg p-3 border border-brand-cream text-left">
                        <span className="w-5 h-5 rounded-full bg-brand-gold/15 text-brand-gold font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-xs text-brand-dark">{item.label}</p>
                          <p className="text-xs text-brand-dark/40">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : format === 'onesheet' ? (
                <>
                  <h3 className="font-display text-2xl font-semibold text-brand-dark mb-2">
                    Commercial Strategy Brief
                  </h3>
                  <p className="text-brand-dark/50 max-w-sm text-sm leading-relaxed mb-6">
                    A one-page brief written from{' '}
                    <span className="text-brand-dark font-medium">{companyName}</span>'s perspective — positioning you as the expert who has done the listening.
                  </p>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                    {[
                      { label: 'The Business', desc: 'Your understanding of their world' },
                      { label: 'The Opportunity', desc: 'What you see they\'re missing' },
                      { label: 'Scope', desc: 'Defined workstreams & deliverables' },
                      { label: 'What Success Looks Like', desc: 'Measurable outcomes' },
                      { label: 'Constraints', desc: 'Non-negotiable boundaries' },
                      { label: 'Investment', desc: 'Fixed-fee, milestone-based' },
                    ].map((item, i) => (
                      <div key={item.label} className="flex items-start gap-2.5 bg-white rounded-lg p-3 border border-brand-cream text-left">
                        <span className="w-5 h-5 rounded-full bg-brand-gold/15 text-brand-gold font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-xs text-brand-dark">{item.label}</p>
                          <p className="text-xs text-brand-dark/40">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-display text-2xl font-semibold text-brand-dark mb-2">
                    The Labyrinth Framework
                  </h3>
                  <p className="text-brand-dark/50 max-w-sm text-sm leading-relaxed mb-6">
                    Fill in the brief on the left and generate a bespoke proposal drafted by Claude using{' '}
                    <span className="text-brand-dark font-medium">{companyName}</span>'s Labyrinth Framework.
                  </p>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                    {SECTION_DEFS.map((item, i) => (
                      <div key={item.id} className="flex items-start gap-2.5 bg-white rounded-lg p-3 border border-brand-cream text-left">
                        <span className="w-5 h-5 rounded-full bg-brand-gold/15 text-brand-gold font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-xs text-brand-dark">{item.label}</p>
                          <p className="text-xs text-brand-dark/40">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {(proposal || loading) && (
            <div ref={proposalRef} className="max-w-3xl mx-auto p-8">
              {/* Proposal header */}
              <div className="mb-8 pb-6 border-b border-brand-cream">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded bg-brand-gold flex items-center justify-center">
                    <span className="font-display text-brand-dark font-bold text-xs">J</span>
                  </div>
                  <span className="font-display text-sm font-semibold text-brand-dark/60">{companyName}</span>
                  <span className="text-brand-dark/20">·</span>
                  <span className="text-xs text-brand-dark/40">{format === 'reversebrief' ? 'Reverse Brief · Internal' : format === 'onesheet' ? 'Commercial Strategy Brief' : 'Confidential Proposal'}</span>
                </div>
                {form.company && (
                  <p className="text-xs text-brand-dark/40 mb-1">Prepared for {form.company}</p>
                )}
              </div>

              {/* Proposal text — edit mode or preview */}
              {editing ? (
                <textarea
                  value={proposal}
                  onChange={e => setProposal(e.target.value)}
                  className="w-full min-h-[600px] px-4 py-3 bg-white border border-brand-cream-dark rounded-lg text-sm text-brand-dark font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold resize-y"
                />
              ) : (
                <div
                  className="prose-proposal"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(proposal) || '',
                  }}
                />
              )}

              {/* Loading cursor */}
              {loading && (
                <span className="inline-block w-0.5 h-4 bg-brand-gold animate-pulse ml-0.5" />
              )}

              {/* Proposal footer */}
              {!loading && proposal && !editing && (
                <div className="mt-12 pt-6 border-t border-brand-cream flex items-center justify-between">
                  <div>
                    <p className="font-display text-sm font-semibold text-brand-dark">{companyName}</p>
                    <p className="text-xs text-brand-dark/40">
                      {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center">
                    <span className="font-display text-brand-gold font-bold text-sm">J</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Refinement bar */}
        {view === 'generator' && proposal && !loading && !editing && (
          <div className="bg-white border-t border-brand-cream px-6 py-3 flex-shrink-0 proposal-refinement">
            <div className="flex items-center gap-2 max-w-3xl mx-auto">
              <div className="relative flex-1">
                <input
                  ref={refinementRef}
                  type="text"
                  value={refinementInput}
                  onChange={e => setRefinementInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && refinementInput.trim()) refine(); }}
                  placeholder="Refine this proposal… e.g. 'Make the diagnosis sharper' or 'Add a case study reference'"
                  className="input-field pr-20 py-2.5 text-sm"
                />
                <button
                  onClick={refine}
                  disabled={!refinementInput.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 btn-primary py-1.5 px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Refine →
                </button>
              </div>
            </div>
            <p className="text-xs text-brand-dark/30 mt-1.5 max-w-3xl mx-auto">
              Evolve the proposal with follow-up instructions instead of regenerating from scratch
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
