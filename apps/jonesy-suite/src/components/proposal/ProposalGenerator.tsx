import { useState, useRef, useCallback } from 'react';
import { Client, ProposalFormData, SavedProposal, generateId } from '../../types';

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

const LABYRINTH_SYSTEM_PROMPT = (companyName: string) => `You are a senior strategist and principal writer at ${companyName}, crafting bespoke client proposals using the Labyrinth Framework.

THE LABYRINTH FRAMEWORK
The Labyrinth Framework structures proposals as an intentional journey — from confusion and complexity into clarity and possibility. Each section is a step deeper into understanding, culminating in a vision of transformation.

The seven sections of the framework:

1. ENTRY POINT — "Where You Stand"
Open with a precise, resonant articulation of the client's current world. Name their reality without judgment. Show that you truly understand where they are before proposing where they could go.

2. THE MAZE — "The Complexity You Navigate"
Describe the challenges, competing pressures, and systemic tensions they face. Be specific and insightful — this is where you demonstrate deep sector knowledge and empathy for their situation.

3. MAPPING — "How We See It"
Present your diagnostic lens on their situation. What patterns do you recognize? What do others miss that you see clearly? This section establishes your intellectual authority.

4. THE THREAD — "Our Guiding Philosophy"
Articulate the core principle or approach that will guide all the work. This is ${companyName}'s distinctive methodology — why your approach is not merely competent but uniquely suited.

5. PATHWAYS — "What We'll Do Together"
Detail the specific deliverables, phases, and workstreams. Be concrete about process, collaboration rhythms, and what the client can expect to receive at each stage.

6. EMERGENCE — "Where You'll Arrive"
Paint a vivid, specific picture of the transformed state. Use precise language to describe what success looks like — commercially, culturally, strategically. Make the destination feel real and worth the journey.

7. THE INVESTMENT — "Your Commitment"
Frame pricing and timeline as an investment in transformation, not a cost. If budget is provided, structure it thoughtfully. If not, describe the engagement model and value proposition.

8. FIRST STEPS — "How We Begin"
End with clear, confident next steps. Create momentum. Make it easy to say yes.

TONE AND STYLE GUIDELINES:
- Write with the confidence of a trusted advisor who has seen this situation before
- Use sophisticated vocabulary but never obscure meaning with jargon
- Balance warmth with authority — this is not a vendor pitch, it is a strategic partnership offer
- Each section should be substantive but not exhaustive — leave room for conversation
- The proposal should read as a coherent narrative, not a checklist
- Paragraphs over bullet points wherever possible — this is strategic writing, not a slide deck
- Length: Aim for a comprehensive but readable proposal (approximately 800-1200 words of body content)

Format using markdown with ## for section headings. Begin with a compelling headline title (# heading) that captures the essence of the engagement.`;

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

  const generate = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    setError('');
    setProposal('');
    setLoading(true);

    abortRef.current = new AbortController();

    try {
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
          system: LABYRINTH_SYSTEM_PROMPT(companyName),
          messages: [{ role: 'user', content: buildUserPrompt(form, companyName) }],
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
              setProposal(prev => prev + parsed.delta!.text);
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [apiKey, form, companyName]);

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
    const saved: SavedProposal = {
      id: generateId(),
      title: extractTitle(proposal),
      content: proposal,
      createdAt: new Date().toISOString(),
    };
    onSaveToClient(selectedClientId, saved);
    setSavedClientId(selectedClientId);
  };

  const clearAll = () => {
    setProposal('');
    setForm(EMPTY_FORM);
    setError('');
    setSavedClientId('');
  };

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
              </div>
              <div className="flex items-center gap-2">
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
                {[
                  { n: '1', title: 'Entry Point', desc: 'Client\'s current reality' },
                  { n: '2', title: 'The Maze', desc: 'Complexity they face' },
                  { n: '3', title: 'Mapping', desc: 'Your diagnostic lens' },
                  { n: '4', title: 'The Thread', desc: 'Your philosophy' },
                  { n: '5', title: 'Pathways', desc: 'What you\'ll do together' },
                  { n: '6', title: 'Emergence', desc: 'The transformed state' },
                  { n: '7', title: 'Investment', desc: 'Value & commitment' },
                  { n: '8', title: 'First Steps', desc: 'How you begin' },
                ].map(item => (
                  <div key={item.n} className="flex items-start gap-2.5 bg-white rounded-lg p-3 border border-brand-cream text-left">
                    <span className="w-5 h-5 rounded-full bg-brand-gold/15 text-brand-gold font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {item.n}
                    </span>
                    <div>
                      <p className="font-semibold text-xs text-brand-dark">{item.title}</p>
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

              {/* Proposal text */}
              <div
                className="prose-proposal"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(proposal) || '',
                }}
              />

              {/* Loading cursor */}
              {loading && (
                <span className="inline-block w-0.5 h-4 bg-brand-gold animate-pulse ml-0.5" />
              )}

              {/* Proposal footer */}
              {!loading && proposal && (
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
      </div>
    </div>
  );
}
