import { useState, useRef, useCallback, useEffect } from 'react';
import { Client, ProposalFormData, SavedProposal, generateId } from '../../types';
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

const REF_DOCS_STORAGE_KEY = 'prof_g_ref_docs';

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

type ProposalFormat = 'full' | 'onesheet';
type ProposalLength = 'concise' | 'standard' | 'comprehensive';
type ProposalTone = 'confident' | 'collaborative' | 'formal';
type ChatMessage = { role: 'user' | 'assistant'; content: string };

const FORMAT_OPTIONS: { value: ProposalFormat; label: string; desc: string }[] = [
  { value: 'full', label: 'Full Brief', desc: 'Partnership Brief' },
  { value: 'onesheet', label: 'One Sheet', desc: 'Commercial Strategy Brief' },
];

const SECTION_DEFS = [
  { id: 'moment', label: 'The Opportunity', desc: 'Why now for Prof G' },
  { id: 'storyInOurs', label: 'Strategic Alignment', desc: 'Why this brand fits' },
  { id: 'structure', label: 'Partnership Structure', desc: 'What\'s included' },
  { id: 'vision', label: 'Content Vision', desc: 'What we\'ll create together' },
  { id: 'reach', label: 'Reach & Distribution', desc: 'Audience & channels' },
  { id: 'investment', label: 'The Investment', desc: 'Partnership value' },
  { id: 'timeline', label: 'Partnership Timeline', desc: 'Key milestones' },
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
  moment: `1. THE OPPORTUNITY — "Why Now"
Open with the strategic and cultural context for why this partnership matters right now. Frame the Prof G media ecosystem — podcasts, education, events, and content — as a unique platform at the intersection of business, technology, and culture. Make the partner feel the urgency and scale.`,
  storyInOurs: `2. STRATEGIC ALIGNMENT — "Why [Brand]"
Articulate precisely why this brand belongs in the Prof G ecosystem. What is the alignment between the brand's positioning, audience, and values and Prof G's audience of ambitious professionals, entrepreneurs, and business leaders? Be specific and strategically sharp.`,
  structure: `3. THE PARTNERSHIP STRUCTURE — "What We're Building Together"
Describe what the partnership includes. Be concrete about content integrations, sponsorship formats, distribution channels, and brand presence across podcasts, digital content, live events, and education platforms.`,
  vision: `4. THE CONTENT VISION — "What We'll Create"
Paint a vivid, specific picture of the content that will live in this partnership. What will the audience experience? How will the brand's narrative integrate into Prof G's content? This should feel like a creative pitch — ambitious, specific, exciting.`,
  reach: `5. REACH & DISTRIBUTION — "Where Your Brand Lives"
Describe where the partnership content will appear: Prof G Pod, Pivot, No Mercy / No Malice newsletter, Prof G Education, live events, social channels. Be specific about audience scale, demographics, and engagement.`,
  investment: `6. THE INVESTMENT — "Partnership Value"
Frame the financial commitment as a strategic investment. If budget is provided, structure it clearly. Emphasize the value of reaching Prof G's engaged, high-income professional audience. Include what the brand receives in return.`,
  timeline: `7. PARTNERSHIP TIMELINE — "Key Milestones"
Describe the key milestones of the partnership — content launches, event integrations, campaign moments, and reporting cadences.`,
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
    confident: 'Write with the authority of Prof G\'s brand and track record. Be bold, direct, and assertive. Channel Scott Galloway\'s signature blend of data-driven insight and provocative honesty.',
    collaborative: 'Write as a collaborative partner. Use "we" and "together" language. Position the partnership as a joint creative venture. Warm, inviting, and energising.',
    formal: 'Write in a formal, institutional tone. Structured, measured, and precise. Suitable for corporate review processes and brand partnership committees.',
  }[tone];

  return `You are the Head of Brand Partnerships at Prof G Media, the media and education company founded by Scott Galloway. You write bespoke partnership briefs — compelling, strategically sharp documents that invite brands to partner with the Prof G ecosystem.

ABOUT PROF G MEDIA
Prof G Media is a leading business media and education company built around NYU Stern professor and bestselling author Scott Galloway. The ecosystem includes the Prof G Pod, Pivot (with Kara Swisher), the No Mercy / No Malice newsletter, Prof G Education (online business courses), and a robust events and speaking business. Prof G reaches millions of ambitious professionals, entrepreneurs, and business leaders who value data-driven analysis, provocative thinking, and actionable business insight.

THE PROF G PARTNERSHIP BRIEF FORMAT
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
  return `Please write a full Prof G Partnership Brief for the following opportunity:

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

Write a complete, polished Prof G Partnership Brief as if you are the Head of Brand Partnerships at Prof G Media presenting this opportunity to ${form.clientName} at ${form.company}. This should feel strategically sharp, data-informed, and compelling. Ready to share.`;
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
        system: format === 'onesheet'
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

    const userMessage: ChatMessage = {
      role: 'user',
      content: format === 'onesheet'
        ? buildOneSheetUserPrompt(form, companyName)
        : buildUserPrompt(form, companyName),
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
            <p className="text-xs text-brand-dark/50 mt-0.5">Prof G Partnership Framework · Powered by Claude</p>
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
          <FormSection title="The Partnership Opportunity">
            <div>
              <label className="label">Partnership Angle / Opportunity *</label>
              <textarea
                className="input-field resize-none"
                rows={3}
                value={form.challenge}
                onChange={e => set('challenge', e.target.value)}
                placeholder="What is the core narrative of this partnership? What makes this brand a natural fit for Prof G? What content opportunity exists?"
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

          {/* Partnership goals */}
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

          {/* Engagement */}
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
            {format === 'full' && (
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
            {format === 'full' && (
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
                {proposal ? 'Regenerate' : 'Generate'} {format === 'onesheet' ? 'One Sheet' : 'Partner Brief'}
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
        {/* Brief toolbar */}
        {proposal && (
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
        <div className="flex-1 overflow-y-auto">
          {!proposal && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              <div className="w-20 h-20 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mb-6">
                <span className="font-display text-4xl font-bold text-brand-gold/60">G</span>
              </div>
              {format === 'onesheet' ? (
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
                    Prof G Partnership Framework
                  </h3>
                  <p className="text-brand-dark/50 max-w-sm text-sm leading-relaxed mb-6">
                    Fill in the brief on the left and generate a bespoke partnership proposal drafted by Claude using the{' '}
                    <span className="text-brand-dark font-medium">Prof G Partnership Framework</span>.
                    {refDocs.length > 0 && (
                      <span className="block mt-2 text-brand-gold font-medium">
                        {refDocs.length} reference doc{refDocs.length > 1 ? 's' : ''} loaded — 60/40 weighting active
                      </span>
                    )}
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
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded bg-brand-gold flex items-center justify-center">
                    <span className="font-display text-brand-dark font-bold text-xs">G</span>
                  </div>
                  <span className="font-display text-sm font-semibold text-brand-dark/60">{companyName}</span>
                  <span className="text-brand-dark/20">·</span>
                  <span className="text-xs text-brand-dark/40">{format === 'onesheet' ? 'Commercial Strategy Brief' : 'Partnership Brief · Confidential'}</span>
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
                  <div>
                    <p className="font-display text-sm font-semibold text-brand-dark">{companyName}</p>
                    <p className="text-xs text-brand-dark/40">
                      {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center">
                    <span className="font-display text-brand-gold font-bold text-sm">G</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Refinement bar */}
        {proposal && !loading && !editing && (
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
