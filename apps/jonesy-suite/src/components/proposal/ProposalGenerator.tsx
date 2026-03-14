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

type ProposalLength = 'concise' | 'standard' | 'comprehensive';
type ProposalTone = 'confident' | 'collaborative' | 'formal';
type ChatMessage = { role: 'user' | 'assistant'; content: string };

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
- Draw approximately 60% of your content, frameworks, language, positioning, and specifics from the reference material.
- Use approximately 40% of your own knowledge to fill gaps, add strategic context, ensure coherence, and enhance the proposal.
- When the reference material contains specific data points, frameworks, case studies, pricing, or positioning language, prefer those over generic content.
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
${form.currentState || 'Not specified — infer from the challenge described above.'}

DESIRED OUTCOME (what success looks like):
${form.desiredOutcome}

${form.successMetrics ? `SUCCESS METRICS:\n${form.successMetrics}\n` : ''}
${form.budget ? `BUDGET RANGE: ${form.budget}\n` : ''}
${form.timeline ? `DESIRED TIMELINE: ${form.timeline}\n` : ''}
${form.additionalContext ? `ADDITIONAL CONTEXT:\n${form.additionalContext}\n` : ''}

Write a complete, polished Labyrinth Framework proposal as if you are a senior partner at ${companyName} presenting this to ${form.clientName} at ${form.company}. This should be ready to share with the client.`;
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

  // New state for editing, refinement, and options
  const [editing, setEditing] = useState(false);
  const [refinementInput, setRefinementInput] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
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
    if (!form.clientName.trim()) return 'Client name is required.';
    if (!form.company.trim()) return 'Company name is required.';
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
        system: buildSystemPrompt(companyName, length, tone, sections, refDocs),
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
  }, [apiKey, companyName, length, tone, sections, refDocs]);

  const generate = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    setError('');
    setProposal('');
    setLoading(true);
    setEditing(false);

    const userMessage: ChatMessage = { role: 'user', content: buildUserPrompt(form, companyName) };
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

  return (
    <div className="flex h-full overflow-hidden">
      {/* Form panel */}
      <div className="w-96 flex-shrink-0 bg-white border-r border-brand-cream flex flex-col overflow-hidden">
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

          {/* Proposal Options */}
          <FormSection title="Proposal Options">
            {/* Length */}
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

            {/* Sections */}
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
                {proposal ? 'Regenerate Proposal' : 'Generate Proposal'}
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
      <div className="flex-1 flex flex-col overflow-hidden bg-brand-light">
        {/* Proposal toolbar */}
        {proposal && (
          <div className="bg-white border-b border-brand-cream px-6 py-3 space-y-2">
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
                <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5">
                  ⎙ Print
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
        <div className="flex-1 overflow-y-auto">
          {!proposal && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              <div className="w-20 h-20 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mb-6">
                <span className="text-4xl text-brand-gold/60">◈</span>
              </div>
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
                  <span className="text-xs text-brand-dark/40">Confidential Proposal</span>
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

        {/* Refinement bar */}
        {proposal && !loading && !editing && (
          <div className="bg-white border-t border-brand-cream px-6 py-3 flex-shrink-0">
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
  );
}
