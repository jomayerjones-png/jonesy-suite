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

const REF_DOCS_STORAGE_KEY = 'kaleidoscope_ref_docs';

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

type ProposalFormat = 'briefing' | 'sponsor_proposal' | 'slide_deck';
type ProposalTone = 'confident' | 'collaborative' | 'formal';
type ChatMessage = { role: 'user' | 'assistant'; content: string };

const FORMAT_OPTIONS: { value: ProposalFormat; label: string; desc: string }[] = [
  { value: 'briefing', label: 'Internal Briefing', desc: 'Team prep doc' },
  { value: 'sponsor_proposal', label: 'Sponsor Proposal', desc: 'Client-facing pitch' },
  { value: 'slide_deck', label: 'Slide Deck', desc: 'Full presentation' },
];

const TONE_OPTIONS: { value: ProposalTone; label: string; desc: string }[] = [
  { value: 'confident', label: 'Confident', desc: 'Direct & authoritative' },
  { value: 'collaborative', label: 'Collaborative', desc: 'Partnership-first' },
  { value: 'formal', label: 'Formal', desc: 'Corporate / institutional' },
];

const KALEIDOSCOPE_CONTEXT = `
ABOUT KALEIDOSCOPE
Kaleidoscope is a premium podcast studio and iHeart's flagship science and technology network — "the National Geographic of podcasting." Founded by Oz Woloshyn and Mangesh Hattikudur, Kaleidoscope produces deeply reported, world-class audio storytelling at the intersection of science, technology, discovery, and human ambition. $5M Series A raised in 2025.

THE SHOWS
- The Builders with Walter Isaacson — Q4 2026 launch. Isaacson explores the frontiers of technology and innovation with the people building tomorrow. Flagship anchor show.
- Two Percent with Michael Easter — Q2 2026. About the tiny margins separating good from great; bestselling author of The Comfort Crisis.
- TechStuff with Oz Woloshyn — 100M+ downloads since 2008. Flagship evergreen tech show.
- No Such Thing as a Fish — Apple's Best Podcast 2025. Delightful, surprising facts from the QI researchers.
- Shell Game with Evan Ratliff — Apple's #1 Tech podcast. Investigative audio journalism.
- Inventors with Simone Giertz — Q3 2026. The YouTube inventor sensation's first major podcast.
- Superhuman with Chris Gayomali — Q3 2026. Science of human optimization from the WIRED veteran.
- How to Live Forever with Mangesh Hattikudur — longevity and the science of aging.
- De-Extinction — Q4 2026. The science and ethics of bringing back lost species.

THE NUMBERS
- 1 million monthly listeners across the network
- Apple's Best Podcast 2025 (No Such Thing)
- Apple's #1 Tech Podcast (Shell Game)
- 100M+ downloads for TechStuff alone
- iHeart distribution partnership — massive built-in promotional platform

THE COMMERCIAL PRODUCTS
1. Custom Partnerships — Co-produced original shows or series built around a brand's narrative. Highest integration, most premium. Examples: WIRED (Uncanny Valley — AI ethics), The Atlantic (Most Interesting Thing in AI), Google + aiEDU (educational series), Bloomberg (Levittown — Webby Award finalist).
2. Creative Sponsorship — Host-read, deeply integrated show sponsorship. One brand per show, baked into editorial. The "gold standard" of podcast advertising — not programmatic, not ad-breaks.
3. Events + Live Activation — Live shows, brand activations, thought leadership events tied to Kaleidoscope's shows and talent.

THE TEAM + ADVISORY
- Oz Woloshyn — Co-founder, host of TechStuff (100M+ downloads). Silicon Valley insider.
- Mangesh Hattikudur — Co-founder, host of How to Live Forever. Former Mental Floss founder.
- Advisory: Tom Freston (former Viacom CEO), Erin Coles (former Apple Podcasts), Robert Wong (Google Creative Lab).

BRAND VALUES
Inspiration · Entertainment · Optimism · Wonder
Tagline: "Illuminating the Frontiers of Discovery"

THE VOICE
Smart, curious, earned. Kaleidoscope speaks to people who believe that understanding the world is worthwhile. Not clickbait, not fear — wonder, ambition, discovery. Sponsors become part of a cultural project, not a media buy.

TARGET SPONSORS
Technology + AI companies, pharma and biotech, financial services, premium consumer brands, automotive, aviation, luxury goods, challenger brands with a story to tell. CMOs, brand strategy leads, VP Marketing at companies that care about association with quality and ideas.`;


function buildBriefingSystemPrompt(
  _companyName: string,
  tone: ProposalTone,
  referenceDocs: RefDoc[] = [],
): string {
  const toneGuide = {
    confident: 'Direct and assertive. No hedging. Like a well-prepared account executive who knows exactly what they want from this meeting.',
    collaborative: 'Warm and analytical. First-person plural. Treats this as a joint prep exercise.',
    formal: 'Precise and measured. Institutional tone, structured sentences.',
  }[tone];

  return `You are the Head of Partnerships at Kaleidoscope, writing an internal briefing before a sponsor meeting. Kaleidoscope is a premium podcast studio — write with earned confidence. Short, punchy, no fluff.

${KALEIDOSCOPE_CONTEXT}

DOCUMENT STRUCTURE — follow this exactly:

# Internal Briefing: [Company]
**Kaleidoscope Partnerships | [Current Month Year] | CONFIDENTIAL**

## Account Overview
2–3 sentences max. Who they are, who we're meeting, why they're in the pipeline.

## Why Kaleidoscope is a Fit
3–5 tight bullet points. Why this brand belongs inside Kaleidoscope's world. Specific show alignment, audience overlap, campaign timing, strategic rationale. No paragraphs.

## Meeting Objective
One sentence. What do we walk out with?

## Key Talking Points
5 bullets. Our strongest arguments, tailored to this brand's known priorities. Reference specific Kaleidoscope shows (The Builders, Shell Game, Superhuman, etc.) where relevant. Specific, not generic.

## Proposed Package
2–3 sentences. Custom Partnership / Creative Sponsorship / Events — what makes sense for this brand, rough investment level, why this show specifically.

## Objections + Responses
4 pairs. Short and sharp:
**Objection:** [one sentence]
**Response:** [one sentence]

## Next Steps
3 bullets with timelines.

TONE: ${toneGuide}
LENGTH: 400–500 words. Scannable. Bullet-heavy. No long paragraphs — if it's longer than 2 sentences, break it into bullets.
FORMAT: Markdown with ## headings and bullet points.`
  + (referenceDocs.length > 0 ? `

REFERENCE MATERIAL (60% weight — draw heavily from these):
${referenceDocs.map(d => `--- ${d.name} ---\n${d.content}\n--- END ${d.name} ---`).join('\n\n')}` : '');
}

function buildBriefingUserPrompt(form: ProposalFormData, _companyName: string, clientContext: string): string {
  return `Write an internal briefing for the following sponsor meeting:

CONTACT: ${form.clientName}
COMPANY: ${form.company}${form.industry ? `\nINDUSTRY: ${form.industry}` : ''}

WHAT WE KNOW / SPONSORSHIP ANGLE:
${form.challenge || 'Use reference documents and public knowledge to build the picture.'}

${form.currentState ? `BRAND CONTEXT:\n${form.currentState}\n` : ''}
${form.desiredOutcome ? `WHAT THEY\'VE EXPRESSED INTEREST IN:\n${form.desiredOutcome}\n` : ''}
${form.budget ? `BUDGET DISCUSSED: ${form.budget}\n` : ''}
${form.timeline ? `TIMELINE: ${form.timeline}\n` : ''}
${form.additionalContext ? `ADDITIONAL NOTES:\n${form.additionalContext}\n` : ''}
${clientContext ? `\nPIPELINE DATA:\n${clientContext}\n` : ''}

Write the complete briefing for the Status partnerships team.`;
}

function buildSponsorProposalSystemPrompt(
  _companyName: string,
  tone: ProposalTone,
  referenceDocs: RefDoc[] = [],
): string {
  const toneGuide = {
    confident: 'Direct and authoritative. Kaleidoscope knows its value — this document reflects that. Not a pitch, a statement of opportunity.',
    collaborative: 'Warm and partnership-minded. Frame this as a shared editorial vision, not a transaction.',
    formal: 'Polished and precise. Suitable for brand committee review.',
  }[tone];

  return `You are the Head of Partnerships at Kaleidoscope, writing a client-facing sponsorship proposal. Kaleidoscope is a premium podcast studio — keep this tight, specific, and confident. This goes directly to the sponsor.

${KALEIDOSCOPE_CONTEXT}

DOCUMENT STRUCTURE — follow this exactly:

# Kaleidoscope × [Company]: Sponsorship Partnership

---

## Kaleidoscope
2 sentences. What Kaleidoscope is, what shows define the network, why it matters. Direct. Lead with the quality of the storytelling and the caliber of the talent.

## Why [Company]
2–3 short paragraphs (2–3 sentences each). Make the brand feel specifically chosen. Reference a real campaign, product launch, brand positioning move, or cultural moment from 2024–2025. Why is the Kaleidoscope audience the right room for this brand right now? Which show(s) align specifically?

## The Opportunity
2 short paragraphs. Which product (Custom Partnership / Creative Sponsorship / Events) fits this brand best and why. Reference a case study where relevant (WIRED's Uncanny Valley, The Atlantic's AI series, Bloomberg's Levittown — Webby finalist). What the brand's presence looks like inside Kaleidoscope's world. Specific. No vague language.

## The Numbers
- 1 million monthly listeners across the network
- Apple's Best Podcast 2025 (No Such Thing as a Fish)
- Apple's #1 Tech Podcast (Shell Game with Evan Ratliff)
- 100M+ downloads (TechStuff)
- Upcoming: The Builders with Walter Isaacson (Q4 2026), Inventors with Simone Giertz (Q3 2026)
- iHeart distribution partnership
- Advisory: Tom Freston (former Viacom CEO), Erin Coles (former Apple Podcasts)

## Next Steps
2 sentences. Direct CTA. Name the next step.

---
Kaleidoscope Partnerships | partnerships@k-scope.com

TONE: ${toneGuide}
LENGTH: 350–450 words. Punchy. Short paragraphs — 2–3 sentences max each. No filler, no long narrative blocks.
FORMAT: Markdown with ## headings and horizontal rules (---) as shown.`
  + (referenceDocs.length > 0 ? `

REFERENCE MATERIAL (60% weight — draw heavily from these):
${referenceDocs.map(d => `--- ${d.name} ---\n${d.content}\n--- END ${d.name} ---`).join('\n\n')}` : '');
}

function buildSponsorProposalUserPrompt(form: ProposalFormData, _companyName: string): string {
  return `Write a sponsor proposal for the following prospect:

CONTACT: ${form.clientName}
COMPANY: ${form.company}${form.industry ? `\nINDUSTRY: ${form.industry}` : ''}

SPONSORSHIP ANGLE:
${form.challenge}

${form.currentState ? `BRAND CONTEXT:\n${form.currentState}\n` : ''}
${form.desiredOutcome ? `WHAT SUCCESS LOOKS LIKE FOR THEM:\n${form.desiredOutcome}\n` : ''}
${form.successMetrics ? `KEY DELIVERABLES:\n${form.successMetrics}\n` : ''}
${form.budget ? `INVESTMENT LEVEL: ${form.budget}\n` : ''}
${form.timeline ? `TIMELINE: ${form.timeline}\n` : ''}
${form.additionalContext ? `ADDITIONAL CONTEXT:\n${form.additionalContext}\n` : ''}

Write the complete proposal as Status Partnerships presenting this to ${form.clientName} at ${form.company}. This goes directly to the sponsor.`;
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

const INTEL_API_KEY = 'kaleidoscope_suite_intel_api_key';

export default function ProposalGenerator({ companyName, clients, onSaveToClient }: ProposalGeneratorProps) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(INTEL_API_KEY) ?? '');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (apiKey) localStorage.setItem(INTEL_API_KEY, apiKey);
  }, [apiKey]);
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
  const [format, setFormat] = useState<ProposalFormat>('briefing');
  const [tone, setTone] = useState<ProposalTone>('confident');
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

  const set = <K extends keyof ProposalFormData>(key: K, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const validateForm = (): string | null => {
    if (!apiKey.trim()) return 'Please enter your Anthropic API key.';
    if (!form.clientName.trim()) return 'Contact name is required.';
    if (!form.company.trim()) return 'Company name is required.';
    if (!form.challenge.trim()) return 'Sponsorship angle / opportunity is required.';
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
        system: format === 'sponsor_proposal'
          ? buildSponsorProposalSystemPrompt(companyName, tone, refDocs)
          : buildBriefingSystemPrompt(companyName, tone, refDocs),
        messages: messages
          .filter(m => m.content.trim().length > 0)
          .map(m => ({ role: m.role, content: m.content })),
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
  }, [apiKey, companyName, format, tone, refDocs]);

  const generate = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    setError('');
    setProposal('');
    setLoading(true);
    setEditing(false);

    const selectedClient = clients.find(c => c.id === selectedClientId);
    const clientCtx = selectedClient ? buildClientContext(selectedClient) : '';

    const userMessage: ChatMessage = {
      role: 'user',
      content: format === 'sponsor_proposal'
        ? buildSponsorProposalUserPrompt(form, companyName)
        : buildBriefingUserPrompt(form, companyName, clientCtx),
    };
    const messages = [userMessage];

    try {
      const fullText = await streamResponse(messages);
      if (!fullText.trim()) throw new Error('Claude returned an empty response. Please try again.');
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
      if (!fullText.trim()) throw new Error('Claude returned an empty response. Please try again.');
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
            <h2 className="font-display text-xl font-semibold text-brand-dark">Proposal Generator</h2>
            <p className="text-xs text-brand-dark/50 mt-0.5">Kaleidoscope Commercial Suite · Powered by Claude</p>
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

          {/* Sponsor info */}
          <FormSection title="Sponsor Information">
            <div>
              <label className="label">Contact Name *</label>
              <input className="input-field" value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Sarah Chen" />
            </div>
            <div>
              <label className="label">Company *</label>
              <input className="input-field" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Netflix" />
            </div>
            <div>
              <label className="label">Industry / Category</label>
              <input className="input-field" value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="Streaming, Tech, Finance, Entertainment…" />
            </div>
          </FormSection>

          <FormSection title="The Opportunity">
            <div>
              <label className="label">Sponsorship Angle *</label>
              <textarea
                className="input-field resize-none"
                rows={3}
                value={form.challenge}
                onChange={e => set('challenge', e.target.value)}
                placeholder="Why does this brand need to be in front of Status readers? What's the specific angle — product launch, recruitment, brand awareness in the media industry?"
              />
            </div>
            <div>
              <label className="label">Brand Context</label>
              <textarea
                className="input-field resize-none"
                rows={3}
                value={form.currentState}
                onChange={e => set('currentState', e.target.value)}
                placeholder="Their current marketing focus, known campaigns, audience they're trying to reach…"
              />
            </div>
          </FormSection>

          <FormSection title="Details">
            <div>
              <label className="label">What Success Looks Like</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.desiredOutcome}
                onChange={e => set('desiredOutcome', e.target.value)}
                placeholder="Brand awareness with media execs, leads, event presence…"
              />
            </div>
            <div>
              <label className="label">Proposed Package</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.successMetrics}
                onChange={e => set('successMetrics', e.target.value)}
                placeholder="Solo newsletter, branded content, events, podcast…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Budget Range</label>
                <input className="input-field" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="$25K–$50K" />
              </div>
              <div>
                <label className="label">Timeline</label>
                <input className="input-field" value={form.timeline} onChange={e => set('timeline', e.target.value)} placeholder="Q3 2025" />
              </div>
            </div>
            <div>
              <label className="label">Additional Notes</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.additionalContext}
                onChange={e => set('additionalContext', e.target.value)}
                placeholder="Prior conversations, intro source, sensitivities, internal context…"
              />
            </div>
          </FormSection>

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
                {proposal ? 'Regenerate' : 'Generate'} {format === 'briefing' ? 'Briefing' : 'Proposal'}
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
              <div className="bg-[#E8471C] px-5 py-2 mb-6">
                <span className="font-mono font-bold text-white text-3xl tracking-tight leading-none">status_</span>
              </div>
              {format === 'briefing' ? (
                <>
                  <h3 className="font-display text-2xl font-semibold text-brand-dark mb-2">Internal Briefing</h3>
                  <p className="text-brand-dark/50 max-w-sm text-sm leading-relaxed mb-6">
                    A confidential team prep doc — account overview, strategic fit, talking points, objection handling, and next steps before a sponsor meeting.
                  </p>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                    {[
                      { label: 'Account Overview', desc: 'Who we\'re meeting and why' },
                      { label: 'Why Status is a Fit', desc: 'The strategic case' },
                      { label: 'Meeting Objective', desc: 'What we\'re trying to achieve' },
                      { label: 'Talking Points', desc: '5 tailored arguments' },
                      { label: 'Proposed Package', desc: 'Product + investment level' },
                      { label: 'Objections + Responses', desc: 'How to handle pushback' },
                    ].map((item, i) => (
                      <div key={item.label} className="flex items-start gap-2.5 bg-white rounded-lg p-3 border border-brand-cream text-left">
                        <span className="w-5 h-5 rounded-full bg-brand-gold/15 text-brand-gold font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
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
                  <h3 className="font-display text-2xl font-semibold text-brand-dark mb-2">Sponsor Proposal</h3>
                  <p className="text-brand-dark/50 max-w-sm text-sm leading-relaxed mb-6">
                    A client-facing sponsorship proposal written in the Status voice — direct, specific, and built around why this brand needs to be in front of Status readers.
                  </p>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                    {[
                      { label: 'Status', desc: '110K+, 40% open rate, media power brokers' },
                      { label: 'Why [Company]', desc: 'Specific, researched brand fit' },
                      { label: 'The Opportunity', desc: 'What sponsorship looks like' },
                      { label: 'The Numbers', desc: 'Audience data that matters' },
                      { label: 'Next Steps', desc: 'Confident CTA' },
                    ].map((item, i) => (
                      <div key={item.label} className="flex items-start gap-2.5 bg-white rounded-lg p-3 border border-brand-cream text-left">
                        <span className="w-5 h-5 rounded-full bg-brand-gold/15 text-brand-gold font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
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
                  <div className="bg-[#E8471C] px-2 py-0.5">
                    <span className="font-mono font-bold text-white text-sm tracking-tight leading-none">status_</span>
                  </div>
                  <span className="text-brand-dark/20">·</span>
                  <span className="text-xs text-brand-dark/40 uppercase tracking-widest">{format === 'briefing' ? 'Internal Briefing · Confidential' : 'Sponsor Proposal'}</span>
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
                  <div className="bg-[#E8471C] px-3 py-1">
                    <span className="font-display font-bold text-white text-lg tracking-tighter leading-none">STATUS</span>
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
                  placeholder="Refine this… e.g. 'Make the WHY section more specific to their Q3 campaign' or 'Add more on the podcast audience'"
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
