import { useState, useRef, useCallback, useEffect } from 'react';
import { Client, ProposalFormData, SavedProposal, generateId, formatCurrency, daysSince } from '../../types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

// --- Reference Documents ---
interface RefDoc {
  id: string;
  name: string;
  content: string;
  addedAt: string;
}

const REF_DOCS_STORAGE_KEY = 'life_ref_docs';

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
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
  return match?.[1]?.trim() ?? 'Untitled Brief';
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
  { value: 'full', label: 'Full Brief', desc: 'Partnership Brief' },
  { value: 'onesheet', label: 'One Sheet', desc: 'Commercial Strategy Brief' },
  { value: 'reversebrief', label: 'Reverse Brief', desc: 'Qualify & discover' },
];

const SECTION_DEFS = [
  { id: 'moment', label: 'The Moment', desc: 'Why now for LIFE' },
  { id: 'storyInOurs', label: 'Your Story in Ours', desc: 'Why this brand belongs' },
  { id: 'structure', label: 'Partnership Structure', desc: 'Tier & what\'s included' },
  { id: 'vision', label: 'Editorial Vision', desc: 'Stories we\'ll tell together' },
  { id: 'reach', label: 'Reach & Distribution', desc: 'Where the brand lives' },
  { id: 'investment', label: 'The Investment', desc: 'Founding partner value' },
  { id: 'timeline', label: 'Partnership Timeline', desc: 'The first year milestones' },
  { id: 'nextSteps', label: 'Next Steps', desc: 'How we begin' },
] as const;

type SectionId = typeof SECTION_DEFS[number]['id'];

const ALL_SECTIONS: Record<SectionId, boolean> = {
  moment: true, storyInOurs: true, structure: true, vision: true,
  reach: true, investment: true, timeline: true, nextSteps: true,
};

const LENGTH_OPTIONS: { value: ProposalLength; label: string; desc: string }[] = [
  { value: 'concise', label: 'Concise', desc: '~500 words' },
  { value: 'standard', label: 'Standard', desc: '~900–1300 words' },
  { value: 'comprehensive', label: 'Comprehensive', desc: '~1500+ words' },
];

const TONE_OPTIONS: { value: ProposalTone; label: string; desc: string }[] = [
  { value: 'confident', label: 'Confident', desc: 'Authoritative & bold' },
  { value: 'collaborative', label: 'Collaborative', desc: 'Partnership-first' },
  { value: 'formal', label: 'Formal', desc: 'Corporate / institutional' },
];

const SECTION_INSTRUCTIONS: Record<SectionId, string> = {
  moment: `1. THE MOMENT — "Why Now"
Open with the cultural and strategic context for LIFE's return. Frame why this is a singular moment for brands that want to be associated with quality, legacy, and the best storytelling in the world. Make the partner feel the opportunity.`,
  storyInOurs: `2. YOUR STORY IN OURS — "Why [Brand]"
Articulate precisely why this brand belongs inside LIFE. What is the alignment between the brand's positioning, values, and audience and LIFE's editorial world? Be specific, flattering, and strategically sharp.`,
  structure: `3. THE PARTNERSHIP STRUCTURE — "What We're Building Together"
Describe the specific partnership tier and what it includes. Be concrete about editorial integrations, content formats, distribution channels, and brand presence across print, digital, and events. Reference the relevant tier:
- Tier 1 — Integration Partners: Technology and hardware embedded in the LIFE storytelling process itself
- Tier 2 — Storytelling & Editorial Franchise Partners: Branded content franchises, editorial series, destination storytelling
- Tier 3 — Brand Access & Cultural Sponsorship: Logo presence, co-branding, launch event access, co-branded marketing`,
  vision: `4. THE EDITORIAL VISION — "Stories We'll Tell"
Paint a vivid, specific picture of the content and storytelling that will live in this partnership. What will the audience experience? What will the brand's narrative be inside LIFE? This section should feel like a creative pitch — ambitious, specific, exciting.`,
  reach: `5. REACH & DISTRIBUTION — "Where Your Brand Lives"
Describe where the partnership content will appear: the LIFE book (print), lifemagazine.com, LIFE Studios social channels, events, partner distribution. Be specific about the scale and quality of the audience.`,
  investment: `6. THE INVESTMENT — "Founding Partner Value"
Frame the financial commitment as a founding investment — an opportunity that won't exist again. If budget is provided, structure it clearly. Emphasize exclusivity and first-mover advantage. Include what the brand receives in return (exclusivity, credits, co-marketing, events, content assets).`,
  timeline: `7. PARTNERSHIP TIMELINE — "The First Year"
Describe the key milestones of the partnership — when the book launches, when events happen, when content goes live, when the brand gets visibility.`,
  nextSteps: `8. NEXT STEPS — "How We Begin"
End with clear, confident next steps. Make it easy to say yes. Reference any existing relationship or prior conversations naturally.`,
};

function buildSystemPrompt(
  _companyName: string,
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
    concise: 'Keep the brief concise — approximately 400–600 words of body content. Be direct and economical with language. Every sentence should earn its place.',
    standard: 'Aim for a comprehensive but readable brief — approximately 900–1300 words of body content.',
    comprehensive: 'Write a thorough, detailed brief — approximately 1500–2000 words of body content. Expand on each section with deeper analysis, richer creative vision, and more specific deliverables.',
  }[length];

  const toneGuide = {
    confident: 'Write with the authority of LIFE\'s legacy and the excitement of a genuine cultural comeback. Be bold, direct, and assertive. This is a once-in-a-generation opportunity.',
    collaborative: 'Write as a collaborative partner. Use "we" and "together" language. Position the partnership as a joint creative venture. Warm, inviting, and energising.',
    formal: 'Write in a formal, institutional tone. Structured, measured, and precise. Suitable for corporate review processes and brand partnership committees.',
  }[tone];

  return `You are the Head of Brand Partnerships at LIFE, the iconic American magazine relaunched as a premium editorial and cultural platform for the modern era. You write bespoke founding partner briefs — compelling, beautifully crafted documents that invite world-class brands into the first year of LIFE's reimagining.

ABOUT LIFE
LIFE is returning. The most trusted visual storytelling brand in American history is being rebuilt for today — a premium editorial platform at the intersection of culture, ambition, athleticism, and human potential. LIFE Studios produces world-class photography, documentary content, and long-form storytelling across print, digital, and live experiences. The relaunch is a cultural moment, and founding partners are invited to be part of it from day one.

THE LIFE PARTNERSHIP BRIEF FORMAT
Include ONLY the following sections, in this order:

${sectionInstructions}

TONE: ${toneGuide}

LENGTH: ${lengthGuide}

STYLE GUIDELINES:
- Be warm, elevated, and visually-minded — this is a creative partnership, not a media buy
- Reference real cultural context where relevant (LA28, AI era, the creator economy, human storytelling)
- Paragraphs over bullet points — this should read like a letter from an editor, not a rate card
- Use sophisticated vocabulary but never obscure meaning with jargon
- Each brief should feel bespoke — written specifically for this brand and this moment

Format using markdown with ## for section headings. Begin with a compelling headline title (# heading) that captures the essence of the partnership.`

  + (referenceDocs.length > 0 ? `

REFERENCE MATERIAL WEIGHTING
You have been provided with reference documents below. These are the primary source of truth for this brief.
- Draw approximately 60% of your content, frameworks, language, positioning, and specifics from the reference material.
- Use approximately 40% of your own knowledge to fill gaps, add strategic context, ensure coherence, and enhance the brief.
- When the reference material contains specific data points, frameworks, case studies, pricing, or positioning language, prefer those over generic content.
- Mirror the tone, terminology, and strategic framing found in the reference material.

REFERENCE DOCUMENTS:
${referenceDocs.map(d => `--- ${d.name} ---\n${d.content}\n--- END ${d.name} ---`).join('\n\n')}` : '');
}

function buildUserPrompt(form: ProposalFormData, _companyName: string): string {
  return `Please write a full LIFE Partnership Brief for the following founding partner opportunity:

PARTNER CONTACT: ${form.clientName}
BRAND / COMPANY: ${form.company}${form.industry ? `\nINDUSTRY / CATEGORY: ${form.industry}` : ''}

PARTNERSHIP OPPORTUNITY / ANGLE:
${form.challenge}

CURRENT BRAND SITUATION / CONTEXT:
${form.currentState || 'Not specified — infer from the partnership angle and industry context above.'}

WHAT SUCCESS LOOKS LIKE FOR THIS PARTNER:
${form.desiredOutcome}

${form.successMetrics ? `KEY METRICS / DELIVERABLES:\n${form.successMetrics}\n` : ''}
${form.budget ? `PARTNERSHIP INVESTMENT LEVEL: ${form.budget}\n` : ''}
${form.timeline ? `DESIRED TIMELINE / LAUNCH: ${form.timeline}\n` : ''}
${form.additionalContext ? `ADDITIONAL CONTEXT & NOTES:\n${form.additionalContext}\n` : ''}

Write a complete, polished LIFE Partnership Brief as if you are the Head of Brand Partnerships at LIFE presenting this founding partner opportunity to ${form.clientName} at ${form.company}. This should feel like a document worthy of the LIFE name — beautiful, authoritative, and compelling. Ready to share.`;
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
Draw approximately 60% of content from the reference material below. Use 40% of your own knowledge to fill gaps.

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
${form.currentState || 'Not specified — infer from the challenge described above.'}

DESIRED OUTCOME:
${form.desiredOutcome}

${form.successMetrics ? `SUCCESS METRICS:\n${form.successMetrics}\n` : ''}
${form.budget ? `BUDGET RANGE: ${form.budget}\n` : ''}
${form.timeline ? `DESIRED TIMELINE: ${form.timeline}\n` : ''}
${form.additionalContext ? `ADDITIONAL CONTEXT:\n${form.additionalContext}\n` : ''}

Write the complete one-sheet as ${companyName} presenting this to ${form.clientName} at ${form.company}. This should be ready to share with the client.`;
}

function buildReverseBriefSystemPrompt(
  _companyName: string,
  tone: ProposalTone,
  referenceDocs: RefDoc[] = [],
): string {
  const toneGuide = {
    confident: 'Write with the confidence of someone who has done their homework. Be direct about what you see and what you still need to learn.',
    collaborative: 'Write as a collaborative partner exploring the opportunity together. Warm but analytically rigorous.',
    formal: 'Write in a formal, structured tone. Precise and measured.',
  }[tone];

  return `You are the Head of Brand Partnerships at LIFE, preparing an internal Reverse Brief — a pre-proposal qualifying document that captures your understanding of a prospective founding partner BEFORE writing a formal partnership brief.

ABOUT LIFE:
LIFE is returning — the most trusted visual storytelling brand in American history, rebuilt for today as a premium editorial platform at the intersection of culture, ambition, athleticism, and human potential. LIFE partners through three tiers:
- Tier 1 — Integration Partners: Technology and hardware embedded in the LIFE storytelling process
- Tier 2 — Storytelling & Editorial Franchise Partners: Branded content franchises, editorial series, destination storytelling
- Tier 3 — Brand Access & Cultural Sponsorship: Logo presence, co-branding, launch event access

PURPOSE:
The Reverse Brief is NOT a proposal. It is an internal document that:
1. Forces structured thinking about whether this brand is the right founding partner
2. Surfaces what we know vs. what we're assuming about the brand
3. Identifies specific questions we need answered before committing to a partnership brief
4. Assesses brand fit, commercial fit, and timing fit
5. Sketches what the partnership would look like IF we proceed

IMPORTANT PERSPECTIVE:
- "We" = LIFE / the LIFE partnerships team
- This is written FOR the LIFE team, not for the partner
- Be candid — this is where honest assessment happens
- Flag assumptions explicitly

DOCUMENT STRUCTURE — follow this exact structure:

# Reverse Brief — [Brand/Company]
**Prepared by LIFE Partnerships | [Current Month Year]**
*Internal document — not for partner distribution*

## What We Know
Summary of the brand's business, market position, audience, recent campaigns, and any conversations or introductions so far. Distinguish between conversation intel and public information. End with what the brand has expressed interest in or what angle they seem drawn to.

## What We Think We See
LIFE's hypothesis — the brand alignment story we believe exists. Why does this brand belong inside LIFE? What cultural territory do we share? Which LIFE tier feels like the natural fit? Be bold but flag it as a hypothesis.

## Open Questions
A numbered list of 6–8 specific questions that must be answered before a partnership brief can be written:
1. Partnership investment level — what budget range is realistic for this brand
2. Decision-making structure — brand team vs. agency, who signs off
3. Content appetite — do they want editorial integration or logo placement
4. Exclusivity expectations — category exclusivity, competitive concerns
5. Timeline — launch alignment, campaign calendar, fiscal year timing
6. Creative control — how much brand approval is needed on editorial content
7. Success metrics — what does the brand actually measure (awareness, sentiment, leads)
8. Prior partnerships — what media partnerships have they done, what worked

Each question should include a brief note on WHY we need this answer.

## Fit Assessment
**Brand Fit** — Does this brand elevate the LIFE platform? Is there authentic cultural alignment? Rate: Strong / Moderate / Weak, with reasoning.

**Commercial Fit** — Is the likely investment proportional to the partnership value? Which tier is realistic? Rate: Strong / Moderate / Weak / Unknown, with reasoning.

**Timing Fit** — Are they ready to commit? Does their timeline align with LIFE's launch phases? Rate: Ready / Warming / Early, with evidence.

**Overall Assessment** — One sentence: proceed, proceed with caution, or pass — and why.

## If We Proceed
A sketch of the likely partnership:
- Recommended tier (1, 2, or 3) and why
- Likely content formats and editorial integrations
- Estimated investment range
- Key activation moments (launch events, editorial series, etc.)
- Risks or dependencies

Sign off with:
**LIFE Partnerships** | Internal Use Only

TONE: ${toneGuide}

LENGTH: Thorough but efficient — approximately 600–900 words.

STYLE:
- Analytical and candid — no sales language
- Bold headers and bullets for scannability
- Flag assumptions with [ASSUMPTION] tags
- Use markdown formatting throughout`

  + (referenceDocs.length > 0 ? `

REFERENCE MATERIAL:
${referenceDocs.map(d => `--- ${d.name} ---\n${d.content}\n--- END ${d.name} ---`).join('\n\n')}` : '');
}

function buildReverseBriefUserPrompt(form: ProposalFormData, _companyName: string, clientContext: string): string {
  return `Prepare a Reverse Brief for the following prospective founding partner:

PARTNER CONTACT: ${form.clientName}
BRAND / COMPANY: ${form.company}${form.industry ? `\nINDUSTRY / CATEGORY: ${form.industry}` : ''}

WHAT WE KNOW SO FAR:
${form.challenge || 'Limited information — use reference documents and public knowledge to build the picture.'}

${form.currentState ? `CURRENT BRAND SITUATION / CONTEXT:\n${form.currentState}\n` : ''}
${form.desiredOutcome ? `WHAT THEY'VE EXPRESSED INTEREST IN:\n${form.desiredOutcome}\n` : ''}
${form.additionalContext ? `ADDITIONAL CONTEXT & NOTES:\n${form.additionalContext}\n` : ''}
${clientContext ? `\nPIPELINE DATA:\n${clientContext}\n` : ''}

Write the complete Reverse Brief as LIFE's internal qualifying document. Be candid and analytical — this is for our partnerships team, not the brand.`;
}

function buildClientContext(client: Client): string {
  const parts: string[] = [];
  parts.push(`Pipeline Stage: ${client.stage}`);
  parts.push(`Deal Value: ${formatCurrency(client.value)}`);
  if (client.industry) parts.push(`Industry: ${client.industry}`);
  if (client.tags.length > 0) parts.push(`Tags: ${client.tags.join(', ')}`);
  parts.push(`Days in Pipeline: ${daysSince(client.createdAt)}`);
  if (client.proposals.length > 0) {
    parts.push(`Previous Briefs: ${client.proposals.length} (latest: "${client.proposals[client.proposals.length - 1].title}", ${new Date(client.proposals[client.proposals.length - 1].createdAt).toLocaleDateString()})`);
  }
  if (client.notes) parts.push(`Pipeline Notes: ${client.notes}`);
  if (client.outcome !== 'active') parts.push(`Outcome: ${client.outcome}${client.lostReason ? ` — ${client.lostReason}` : ''}`);
  return parts.join('\n');
}

// Simple markdown-to-HTML renderer for display
function renderMarkdown(text: string): string {
  return text
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$2</h2>'.replace('$2', '$1'))
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

  // Editing, refinement, and options state
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
    if (!form.clientName.trim()) return 'Partner contact name is required.';
    if (!form.company.trim()) return 'Brand / company name is required.';
    if (format === 'reversebrief') return null;
    if (!form.challenge.trim()) return 'The partnership opportunity / angle is required.';
    if (!form.desiredOutcome.trim()) return 'What success looks like is required.';
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
      content: `Here is the current brief:\n\n${proposal}\n\n---\n\nPlease revise the brief based on this feedback: ${refinementInput}\n\nReturn the COMPLETE revised brief in full — do not return only the changed section. Maintain the same format and structure.`,
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
    const title = proposal ? extractTitle(proposal) : 'Brief';
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`Please find the attached brief: ${title}\n\nTo download the PDF, open the brief in ${companyName} Suite and click "Download PDF".`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  };

  // Proposal Library data
  const allProposals = clients.flatMap(c =>
    c.proposals.map(p => ({ proposal: p, clientName: c.name, company: c.company }))
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
            <h2 className="font-display text-xl font-semibold text-brand-dark">Partner Brief Generator</h2>
            <p className="text-xs text-brand-dark/50 mt-0.5">LIFE Founding Partner Framework · Powered by Claude</p>
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
                <option value="">Select a partner to pre-fill…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.company}</option>
                ))}
              </select>
              <p className="text-xs text-brand-dark/40">Pre-fills contact, brand & pipeline notes</p>
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

          {/* Partner info */}
          <FormSection title="Partner Information">
            <div>
              <label className="label">Contact Name *</label>
              <input className="input-field" value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Antoine Arnault" />
            </div>
            <div>
              <label className="label">Brand / Company *</label>
              <input className="input-field" value={form.company} onChange={e => set('company', e.target.value)} placeholder="LVMH" />
            </div>
            <div>
              <label className="label">Industry / Category</label>
              <input className="input-field" value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="Luxury, Technology, Automotive…" />
            </div>
          </FormSection>

          {/* Partnership angle */}
          {/* Reverse brief context badge */}
          {format !== 'reversebrief' && selectedClientId && (() => {
            const cl = clients.find(c => c.id === selectedClientId);
            const rb = cl?.proposals.find(p => p.title.startsWith('Reverse Brief'));
            return rb ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
                <span className="text-emerald-500 text-sm mt-0.5">◈</span>
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Reverse Brief available — context loaded</p>
                  <p className="text-xs text-emerald-600/60 mt-0.5">"{rb.title}" will be injected as qualifying context into your brief.</p>
                </div>
              </div>
            ) : null;
          })()}

          {format === 'reversebrief' ? (
            <FormSection title="What We Know">
              <div>
                <label className="label">What we know so far</label>
                <textarea
                  className="input-field resize-none"
                  rows={5}
                  value={form.challenge}
                  onChange={e => set('challenge', e.target.value)}
                  placeholder="Everything we know about this brand — conversations, public info, mutual connections, what they've expressed interest in…"
                />
              </div>
              <div>
                <label className="label">Current brand situation</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  value={form.currentState}
                  onChange={e => set('currentState', e.target.value)}
                  placeholder="Their positioning, campaigns, cultural moment, marketing goals…"
                />
              </div>
              <div>
                <label className="label">What they've expressed interest in</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={form.desiredOutcome}
                  onChange={e => set('desiredOutcome', e.target.value)}
                  placeholder="Any specific partnership tier, content format, or activation they've mentioned…"
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
              <FormSection title="The Partnership Opportunity">
                <div>
                  <label className="label">Partnership Angle / Opportunity *</label>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    value={form.challenge}
                    onChange={e => set('challenge', e.target.value)}
                    placeholder="What is the core narrative of this partnership? What makes this brand a natural fit for LIFE? What storytelling opportunity exists?"
                  />
                </div>
                <div>
                  <label className="label">Brand's Current Context</label>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    value={form.currentState}
                    onChange={e => set('currentState', e.target.value)}
                    placeholder="Where is this brand today? Their positioning, campaigns, cultural moment, marketing goals…"
                  />
                </div>
              </FormSection>

              <FormSection title="Partnership Goals">
                <div>
                  <label className="label">What Success Looks Like *</label>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    value={form.desiredOutcome}
                    onChange={e => set('desiredOutcome', e.target.value)}
                    placeholder="What does the brand get from this partnership? Brand equity, audience access, content assets, cultural association…"
                  />
                </div>
                <div>
                  <label className="label">Key Deliverables / Inclusions</label>
                  <textarea
                    className="input-field resize-none"
                    rows={2}
                    value={form.successMetrics}
                    onChange={e => set('successMetrics', e.target.value)}
                    placeholder="Cover placement, editorial series, event access, social content, co-branded assets…"
                  />
                </div>
              </FormSection>

              <FormSection title="Partnership Details">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Investment Level</label>
                    <input className="input-field" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="$750K–$1.5M" />
                  </div>
                  <div>
                    <label className="label">Launch / Timeline</label>
                    <input className="input-field" value={form.timeline} onChange={e => set('timeline', e.target.value)} placeholder="Q3 2025 launch" />
                  </div>
                </div>
                <div>
                  <label className="label">Additional Context</label>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    value={form.additionalContext}
                    onChange={e => set('additionalContext', e.target.value)}
                    placeholder="Prior conversations, key stakeholders, competitive considerations, tone notes, pipeline history…"
                  />
                </div>
              </FormSection>
            </>
          )}

          {/* Brief Options */}
          <FormSection title="Brief Options">
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

            {/* Length — full brief only */}
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

            {/* Sections — full brief only */}
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
                {proposal ? 'Regenerate' : 'Generate'} {format === 'reversebrief' ? 'Reverse Brief' : format === 'onesheet' ? 'One Sheet' : 'Partner Brief'}
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

      {/* Brief output */}
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
            Brief Library
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
                      <h3 className="font-display text-lg font-semibold text-brand-dark">Brief Library</h3>
                      <p className="text-xs text-brand-dark/50 mt-0.5">
                        {libraryFilter === 'final'
                          ? `${finalProposals.length} final brief${finalProposals.length !== 1 ? 's' : ''} across all partners`
                          : `${allProposals.length} brief${allProposals.length !== 1 ? 's' : ''} across all partners`}
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
                        All Briefs
                      </button>
                    </div>
                  </div>

                  {libraryItems.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl text-brand-gold/60">📋</span>
                      </div>
                      <p className="text-sm text-brand-dark/50 mb-1">
                        {libraryFilter === 'final' ? 'No final briefs yet' : 'No briefs yet'}
                      </p>
                      <p className="text-xs text-brand-dark/30">
                        {libraryFilter === 'final'
                          ? 'Save briefs with "final" in the title to collect them here'
                          : 'Generate and save briefs to partners to build your library'}
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
                  <span className="text-sm font-medium text-brand-dark">Brief Ready</span>
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
            {/* Attach to partner */}
            {!loading && clients.length > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-brand-cream">
                <span className="text-xs text-brand-dark/50 flex-shrink-0">Attach to:</span>
                <select
                  className="input-field py-1 text-xs flex-1"
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                >
                  <option value="">Select partner…</option>
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
              <div className="bg-[#E8002D] px-6 py-3 mb-6">
                <span className="font-display font-bold text-white text-4xl tracking-tighter leading-none">LIFE</span>
              </div>
              {format === 'reversebrief' ? (
                <>
                  <h3 className="font-display text-2xl font-semibold text-brand-dark mb-2">
                    Reverse Brief
                  </h3>
                  <p className="text-brand-dark/50 max-w-sm text-sm leading-relaxed mb-6">
                    An internal qualifying document — captures what the LIFE partnerships team knows, what we think we see, and what we need to learn before writing a partnership brief.
                  </p>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                    {[
                      { label: 'What We Know', desc: 'Facts from conversations & research' },
                      { label: 'What We Think We See', desc: 'Brand alignment hypothesis' },
                      { label: 'Open Questions', desc: 'What must be answered first' },
                      { label: 'Fit Assessment', desc: 'Brand, commercial & timing fit' },
                      { label: 'If We Proceed', desc: 'Likely tier & partnership shape' },
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
                    LIFE Founding Partner Framework
                  </h3>
                  <p className="text-brand-dark/50 max-w-sm text-sm leading-relaxed mb-6">
                    Fill in the brief on the left and generate a bespoke founding partner proposal drafted by Claude using the{' '}
                    <span className="text-brand-dark font-medium">LIFE Partnership Framework</span>.
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
              {/* Brief header */}
              <div className="mb-8 pb-6 border-b border-brand-cream">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-[#E8002D] px-2 py-0.5">
                    <span className="font-display font-bold text-white text-sm tracking-tighter leading-none">LIFE</span>
                  </div>
                  <span className="text-brand-dark/20">·</span>
                  <span className="text-xs text-brand-dark/40 uppercase tracking-widest">{format === 'reversebrief' ? 'Reverse Brief · Internal' : format === 'onesheet' ? 'Commercial Strategy Brief' : 'Founding Partner Brief · Confidential'}</span>
                </div>
                {form.company && (
                  <p className="text-xs text-brand-dark/40 mb-1">Prepared for {form.company}</p>
                )}
              </div>

              {/* Brief text — edit mode or preview */}
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

              {/* Brief footer */}
              {!loading && proposal && !editing && (
                <div className="mt-12 pt-6 border-t border-brand-cream flex items-center justify-between">
                  <p className="text-xs text-brand-dark/40">
                    {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <div className="bg-[#E8002D] px-3 py-1">
                    <span className="font-display font-bold text-white text-lg tracking-tighter leading-none">LIFE</span>
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
                  placeholder="Refine this brief… e.g. 'Emphasise the LA28 angle' or 'Make the editorial vision more specific'"
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
              Evolve the brief with follow-up instructions instead of regenerating from scratch
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
