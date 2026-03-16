# Reverse Brief + Proposal Generator Improvements

## 1. Reverse Brief — New Format Option

Add a third format option alongside "Full Proposal" and "One Sheet": **Reverse Brief**.

The Reverse Brief is a qualifying document — it captures Jonesy&Co's understanding of the prospect BEFORE a proposal is written. It serves two purposes:
- **Qualification**: Forces structured thinking about whether this is the right engagement
- **Proposal Input**: Its structured output feeds directly into the proposal generator as context

### Reverse Brief Structure (based on Caliber document pattern, but inverted)
The AI generates this from minimal inputs (client name, company, what you know so far):

```
# Reverse Brief — [Client Company]
Prepared by [CompanyName] | [Date]

## What We Know
Summary of the prospect's business, market position, and current situation.
Sources: public info, conversations, reference docs.

## What We Think We See
The strategic tension or opportunity — our hypothesis about what they need
before they've confirmed it. This is the "diagnosis before the pitch."

## Open Questions
Numbered list of 5–8 specific questions that need answers before a proposal
can be written. These should surface:
- Budget / investment appetite
- Decision-making structure
- Timeline and urgency
- Prior attempts / what's been tried
- Success criteria from their perspective
- Internal constraints or politics

## Fit Assessment
A candid assessment of whether this is the right engagement for [CompanyName]:
- Strategic fit (does this align with what we do best?)
- Commercial fit (is the value proportional to the effort?)
- Timing fit (are they ready to act?)

## If We Proceed
What the engagement would likely look like — workstreams, duration, investment
range. This becomes the seed for the full proposal.
```

### Implementation
- Add `'reversebrief'` to `ProposalFormat` type
- Add `buildReverseBriefSystemPrompt()` and `buildReverseBriefUserPrompt()`
- The reverse brief requires FEWER form fields — only clientName, company, industry, and a freeform "What we know" field
- When format is `'reversebrief'`, hide challenge/outcome/budget/timeline fields (they're what the reverse brief is trying to discover)
- Show a different empty state explaining the reverse brief purpose
- The generated reverse brief can be saved to the client record like any proposal

### Reverse Brief → Proposal Flow
When a reverse brief exists on a client record, and the user switches to "Full Proposal" or "One Sheet" format:
- Auto-populate the `additionalContext` field with the reverse brief content
- Show a badge: "Reverse Brief available — context loaded"
- The system prompt gets the reverse brief injected as primary context

## 2. Make the Generator More Suite-Specific

### A. Jonesy-suite (Consulting)
Currently the most generic. Improvements:
- **Auto-inject client pipeline data**: When loading from pipeline, pull in `client.notes`, `client.tags`, `client.industry`, `client.value`, `client.stage`, and `client.stageHistory` into the system prompt as context. Right now only `notes` are partially used.
- **Engagement history awareness**: If the client has previous proposals saved, mention this in the prompt so Claude can build on prior work rather than starting fresh.
- **Industry-specific framing**: Add industry context to the system prompt when industry is provided — consulting proposals for fintech vs healthcare vs media should feel different.

### B. Life-suite (Cultural Partnerships)
- **Tier-aware prompting**: The system prompt already mentions tiers. Enhancement: when loading from pipeline, auto-detect the tier from client tags/notes and adjust the prompt to focus on the right tier's value proposition.
- **Auto-inject the client's brand context**: Life partnerships are about brand alignment. Pull the client's notes (which contain brand positioning info) directly into the system prompt, not just additionalContext.

### C. Prof-G-suite (Media/Education)
- **Channel-specific prompting**: Prof G has multiple channels (Pod, Pivot, Newsletter, Education, Events). When loading from pipeline, detect which channels are relevant from notes/tags and weight the proposal toward those.
- **Audience data injection**: Prof G's value proposition is audience quality. Add audience stats to the system prompt.

### D. Shared Improvements (All Suites)
- **Richer client context injection**: Modify `loadFromClient()` to inject more structured data into the prompt:
  ```
  CLIENT CONTEXT (from pipeline):
  - Stage: ${client.stage}
  - Deal Value: ${formatCurrency(client.value)}
  - Industry: ${client.industry}
  - Tags: ${client.tags.join(', ')}
  - Pipeline Notes: ${client.notes}
  - Days in Pipeline: ${daysSince(client.createdAt)}
  - Previous Proposals: ${client.proposals.length}
  ```
- **Previous proposal awareness**: If the client has saved proposals, include the most recent proposal title and date in the context so the AI knows this isn't a cold start.

## 3. Files to Modify

### Types (all three suites)
- `apps/*/src/types.ts` — No changes needed; ProposalFormData and Client already have the fields we need

### ProposalGenerator (all three suites)
- `apps/*/src/components/proposal/ProposalGenerator.tsx`:
  - Add `'reversebrief'` to ProposalFormat
  - Add FORMAT_OPTIONS entry
  - Add `buildReverseBriefSystemPrompt()` and `buildReverseBriefUserPrompt()`
  - Update `streamResponse` to use reverse brief prompt when format is reversebrief
  - Update `generate` to use reverse brief user prompt
  - Conditionally hide/show form fields based on format
  - Update empty state for reverse brief
  - Enhance `loadFromClient()` to inject richer client context
  - Add reverse brief detection when switching to proposal formats
