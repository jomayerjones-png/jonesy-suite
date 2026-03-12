import { useState, useRef, useCallback, useEffect } from 'react';
import { ProposalFormData } from '../../types';

interface ProposalGeneratorProps {
  companyName: string;
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

const STORAGE_KEY_PROPOSALS = 'life_suite_proposals';
const STORAGE_KEY_DRAFT_FORM = 'life_suite_proposal_draft_form';

interface SavedProposal {
  id: string;
  company: string;
  clientName: string;
  content: string;
  form: ProposalFormData;
  savedAt: string;
}

const LIFE_SYSTEM_PROMPT = () => `You are a senior partnership strategist at LIFE, crafting bespoke founding partner proposals on behalf of the LIFE editorial team.

ABOUT LIFE:
LIFE is returning as a quarterly large-format magazine and cultural platform — not as nostalgia, but as a deliberate answer to modern media's core failure: its inability to help people make meaning. In a media landscape defined by exhaustion, outrage, and fragmentation, LIFE returns to document the present moment with depth, optimism, and craft.

LIFE's editorial commitment: progress and optimism — covering discovery, excellence, and what is actually working in the world. Breakthroughs, ingenuity, human achievement — the stories that defined LIFE's original run and remain almost entirely absent from today's news cycle.

THE PRODUCT:
- Print: Quarterly 200+ page large-format book. One theme per issue. Collectible by design.
- Quarterly Box: Issues ship with additional print objects, merchandise and profile booklets.
- Digital: Members-only BTS content, audio/visual conversations with contributors, quarterly issue trailer.
- LIFE Studios: Events, films, editorial franchises, and partnerships that extend themes into new formats.
- Social & Audio: Podcasts, curated photo series, short-form content.
- Year One audience: 5,000 founding members — intentionally constrained. Curious, forward-looking, influential.

THE PARTNERSHIP MODEL:
LIFE does not sell advertising inventory. It selects a small number of founding partners (maximum 5) who participate in the broader mission. Year-long integrations only. No programmatic. No open marketplace.

PARTNERSHIP TIERS:

Tier 01 — Integration Partnerships
The partner's technology, platform, or product is integrated into the LIFE storytelling ecosystem itself — shaping how stories are captured, experienced, and distributed. Examples: cameras/devices used by LIFE journalists; new storytelling formats built with emerging technology; interactive or immersive experiences.

Tier 02 — Storytelling & Editorial Franchise Partnerships
Original editorial franchises — storytelling that reflects the partner's role in culture, innovation, or exploration. IP lives across the magazine, film, digital formats, and events. Available series include: The Optimized Self, Attention, Long-Term Thinking, The Public Figure, Consciousness, Background Processes, Music as Experience, Culture Without Knowing It.

Tier 03 — Brand Access & Cultural Sponsorship
Association with LIFE's mission and community. Includes: LIFE launch events, cultural salons, editorial discussions, logo presence, co-branded marketing, distribution partnerships, audience collaborations.

THE LIFE PARTNERSHIP PROPOSAL FRAMEWORK — Eight sections:

1. THE MOMENT — "Why Now"
Open with the cultural context LIFE is responding to. Name the media exhaustion, the fragmentation, the search for meaning. Position LIFE's return not as nostalgia but as the precise answer to this moment. Make the partner feel the urgency and opportunity.

2. THE AUDIENCE — "Who You're Reaching"
Describe LIFE's founding membership with precision: curious, forward-looking, optimistic, disproportionately influential. Explain why this audience is qualitatively different from scale — attention, not impressions. Connect the audience profile directly to why it matters for this specific partner.

3. THE ALIGNMENT — "Why You Belong Here"
Articulate the genuine alignment between the partner's brand values, mission, and market position with LIFE's editorial voice. This is not flattery — it is strategic clarity about why this partnership is natural, not transactional. Be specific to the partner's positioning.

4. THE PARTNERSHIP — "What We're Building Together"
Specify the recommended tier (Integration / Storytelling / Sponsorship) and explain why it is the right fit. Be direct and clear about what this partnership is — not an ad buy, but a founding role in a cultural platform.

5. THE STORY — "The Editorial Opportunity"
This is the heart of the proposal. Describe the specific storytelling opportunity, editorial franchise, integration format, or cultural activation in vivid, concrete terms. If it is a Tier 02 partnership, name the editorial series and describe what it could look like across print, digital, events, and social. Make the creative vision real.

6. THE IMPACT — "What Success Looks Like"
Articulate both the commercial and cultural outcomes. What does the partner gain? Cultural credibility, audience access, original IP, community presence. Be specific to their business objectives where possible.

7. THE INVESTMENT — "The Commitment"
Frame the partnership terms as a founding investment in a cultural platform, not a media spend. Reference the year-long integration model, the maximum of 5 founding partners, and the exclusivity this implies. If budget has been provided, reference it thoughtfully. Keep the focus on value, not cost.

8. THE FIRST STEP — "How We Begin"
End with confidence and clarity. Propose a specific next step — a meeting, a creative session, a preliminary term sheet conversation. Make it easy and natural to move forward.

TONE AND STYLE:
- Write with the authority of a trusted cultural institution, not a vendor
- Sophisticated, warm, and direct — this is a conversation between equals
- Avoid media jargon and advertising language — "partnership", "co-creation", "founding role", not "placement", "inventory", "impressions"
- Paragraphs over bullet points wherever possible — this is a letter of invitation, not a slide deck
- Length: 900–1300 words of body content. Comprehensive but readable.
- Each proposal should feel handcrafted for this specific partner — reference their actual positioning, products, and cultural role

Format using markdown with ## for section headings. Begin with a compelling headline title (# heading) that captures the essence of this specific partnership.`;

function buildUserPrompt(form: ProposalFormData): string {
  return `Please write a full LIFE Partnership Proposal for the following partner:

CONTACT: ${form.clientName}
COMPANY / BRAND: ${form.company}${form.industry ? `\nCATEGORY: ${form.industry}` : ''}

BRAND CHALLENGE / STRATEGIC OBJECTIVE:
${form.challenge}

CURRENT MEDIA / MARKETING APPROACH:
${form.currentState || 'Not specified — infer from the brand context described above.'}

PARTNERSHIP GOALS (what success looks like for them):
${form.desiredOutcome}

${form.successMetrics ? `SUCCESS METRICS / KPIs:\n${form.successMetrics}\n` : ''}
${form.budget ? `INVESTMENT RANGE: ${form.budget}\n` : ''}
${form.timeline ? `TIMELINE / LAUNCH CONSIDERATIONS: ${form.timeline}\n` : ''}
${form.additionalContext ? `ADDITIONAL CONTEXT:\n${form.additionalContext}\n` : ''}

Write a complete, polished LIFE Partnership Proposal as if you are a senior member of the LIFE partnerships team presenting this to ${form.clientName} at ${form.company}. This should be ready to share with the partner.`;
}

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

export default function ProposalGenerator({ companyName }: ProposalGeneratorProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState<ProposalFormData>(() => {
    try {
      const draft = localStorage.getItem(STORAGE_KEY_DRAFT_FORM);
      if (draft) return JSON.parse(draft) as ProposalFormData;
    } catch { /* fall through */ }
    return EMPTY_FORM;
  });
  const [proposal, setProposal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedProposals, setSavedProposals] = useState<SavedProposal[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROPOSALS);
      if (stored) return JSON.parse(stored) as SavedProposal[];
    } catch { /* fall through */ }
    return [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const proposalRef = useRef<HTMLDivElement>(null);

  // Auto-save draft form on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DRAFT_FORM, JSON.stringify(form));
  }, [form]);

  // Auto-save completed proposals to history
  useEffect(() => {
    if (!loading && proposal && form.company) {
      const entry: SavedProposal = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        company: form.company,
        clientName: form.clientName,
        content: proposal,
        form,
        savedAt: new Date().toISOString(),
      };
      setSavedProposals(prev => {
        // Replace if same company proposal already exists from this session, otherwise prepend
        const updated = [entry, ...prev.filter(p => p.id !== entry.id)].slice(0, 20);
        localStorage.setItem(STORAGE_KEY_PROPOSALS, JSON.stringify(updated));
        return updated;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const set = <K extends keyof ProposalFormData>(key: K, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const validateForm = (): string | null => {
    if (!apiKey.trim()) return 'Please enter your Anthropic API key.';
    if (!form.clientName.trim()) return 'Contact name is required.';
    if (!form.company.trim()) return 'Brand / company name is required.';
    if (!form.challenge.trim()) return 'The brand challenge / strategic objective is required.';
    if (!form.desiredOutcome.trim()) return 'The partnership goals are required.';
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
          system: LIFE_SYSTEM_PROMPT(),
          messages: [{ role: 'user', content: buildUserPrompt(form) }],
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
  }, [apiKey, form]);

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const copyProposal = async () => {
    await navigator.clipboard.writeText(proposal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearAll = () => {
    setProposal('');
    setForm(EMPTY_FORM);
    setError('');
    localStorage.removeItem(STORAGE_KEY_DRAFT_FORM);
  };

  const loadSaved = (saved: SavedProposal) => {
    setForm(saved.form);
    setProposal(saved.content);
    setShowHistory(false);
    setError('');
  };

  const deleteSaved = (id: string) => {
    setSavedProposals(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEY_PROPOSALS, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Form panel */}
      <div className="w-96 flex-shrink-0 bg-white border-r border-brand-cream flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-cream flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-brand-dark">Partnership Proposal</h2>
            <p className="text-xs text-brand-dark/50 mt-0.5">Powered by the LIFE Partnership Framework & Claude</p>
          </div>
          {savedProposals.length > 0 && (
            <button
              onClick={() => setShowHistory(v => !v)}
              className="text-xs text-brand-gold hover:text-brand-gold-dark font-medium mt-1 flex items-center gap-1"
            >
              {showHistory ? '← Back' : `History (${savedProposals.length})`}
            </button>
          )}
        </div>

        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <p className="text-xs text-brand-dark/40 uppercase tracking-wider font-semibold mb-3">Saved Proposals</p>
            {savedProposals.map(saved => (
              <div key={saved.id} className="card p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-brand-dark">{saved.company}</p>
                    <p className="text-xs text-brand-dark/50">{saved.clientName}</p>
                  </div>
                  <button
                    onClick={() => deleteSaved(saved.id)}
                    className="text-brand-dark/20 hover:text-red-400 text-xs px-1"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-brand-dark/40">
                  {new Date(saved.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <button
                  onClick={() => loadSaved(saved)}
                  className="w-full btn-secondary text-xs py-1.5"
                >
                  Load Proposal
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

            {/* Partner info */}
            <FormSection title="Partner Information">
              <div>
                <label className="label">Contact Name *</label>
                <input className="input-field" value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="e.g. Lisa Materazzo" />
              </div>
              <div>
                <label className="label">Brand / Company *</label>
                <input className="input-field" value={form.company} onChange={e => set('company', e.target.value)} placeholder="e.g. Toyota" />
              </div>
              <div>
                <label className="label">Category</label>
                <input className="input-field" value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="e.g. Automotive, Technology, Luxury…" />
              </div>
            </FormSection>

            {/* Brand context */}
            <FormSection title="Brand Context">
              <div>
                <label className="label">Brand Challenge / Strategic Objective *</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  value={form.challenge}
                  onChange={e => set('challenge', e.target.value)}
                  placeholder="What is their brand trying to achieve? Cultural credibility, audience access, storytelling platform, product launch…"
                />
              </div>
              <div>
                <label className="label">Current Media / Marketing Approach</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  value={form.currentState}
                  onChange={e => set('currentState', e.target.value)}
                  placeholder="How are they currently showing up in culture? What are they investing in? What's working or not…"
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
                  placeholder="What does the partner hope to gain? Credibility, community, original IP, audience reach, cultural association…"
                />
              </div>
              <div>
                <label className="label">KPIs / Success Metrics</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={form.successMetrics}
                  onChange={e => set('successMetrics', e.target.value)}
                  placeholder="Brand perception, reach, content output, event attendance, member engagement…"
                />
              </div>
            </FormSection>

            {/* Partnership details */}
            <FormSection title="Partnership Details">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Investment Range</label>
                  <input className="input-field" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="$1M–2M" />
                </div>
                <div>
                  <label className="label">Timeline</label>
                  <input className="input-field" value={form.timeline} onChange={e => set('timeline', e.target.value)} placeholder="Year One launch" />
                </div>
              </div>
              <div>
                <label className="label">Additional Context</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  value={form.additionalContext}
                  onChange={e => set('additionalContext', e.target.value)}
                  placeholder="Preferred tier (Integration / Storytelling / Sponsorship), specific editorial series, key stakeholders, sensitivities…"
                />
              </div>
            </FormSection>
          </div>
        )}

        {/* Generate button */}
        {!showHistory && (
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
                  <span>◉</span>
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
        )}
      </div>

      {/* Proposal output */}
      <div className="flex-1 flex flex-col overflow-hidden bg-brand-light">
        {proposal && (
          <div className="bg-white border-b border-brand-cream px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-sm font-medium text-brand-dark">
                  {loading ? 'Generating…' : 'Proposal Ready · Auto-saved'}
                </span>
              </div>
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
        )}

        <div className="flex-1 overflow-y-auto">
          {!proposal && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              <div className="w-20 h-20 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mb-6">
                <span className="font-display text-4xl font-bold text-brand-gold/60">L</span>
              </div>
              <h3 className="font-display text-2xl font-semibold text-brand-dark mb-2">
                LIFE Partnership Framework
              </h3>
              <p className="text-brand-dark/50 max-w-sm text-sm leading-relaxed mb-6">
                Fill in the partner brief on the left to generate a bespoke founding partner proposal grounded in LIFE's editorial mission and partnership model.
              </p>
              <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                {[
                  { n: '1', title: 'The Moment', desc: 'Why now. The cultural context.' },
                  { n: '2', title: 'The Audience', desc: 'Who LIFE reaches & why it matters.' },
                  { n: '3', title: 'The Alignment', desc: 'Why this brand belongs here.' },
                  { n: '4', title: 'The Partnership', desc: 'Tier & founding role.' },
                  { n: '5', title: 'The Story', desc: 'The editorial opportunity.' },
                  { n: '6', title: 'The Impact', desc: 'Commercial & cultural outcomes.' },
                  { n: '7', title: 'The Investment', desc: 'Commitment & exclusivity.' },
                  { n: '8', title: 'The First Step', desc: 'How we begin.' },
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
              <div className="mb-8 pb-6 border-b border-brand-cream">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded bg-brand-gold flex items-center justify-center">
                    <span className="font-display text-brand-dark font-bold text-xs">L</span>
                  </div>
                  <span className="font-display text-sm font-semibold text-brand-dark/60">{companyName}</span>
                  <span className="text-brand-dark/20">·</span>
                  <span className="text-xs text-brand-dark/40">Founding Partner Proposal · Confidential</span>
                </div>
                {form.company && (
                  <p className="text-xs text-brand-dark/40 mb-1">Prepared for {form.company}</p>
                )}
              </div>

              <div
                className="prose-proposal"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(proposal) || '',
                }}
              />

              {loading && (
                <span className="inline-block w-0.5 h-4 bg-brand-gold animate-pulse ml-0.5" />
              )}

              {!loading && proposal && (
                <div className="mt-12 pt-6 border-t border-brand-cream flex items-center justify-between">
                  <div>
                    <p className="font-display text-sm font-semibold text-brand-dark">{companyName}</p>
                    <p className="text-xs text-brand-dark/40">
                      {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center">
                    <span className="font-display text-brand-gold font-bold text-sm">L</span>
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
