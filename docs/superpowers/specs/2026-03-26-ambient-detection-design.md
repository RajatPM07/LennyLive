# Ambient Detection Rebuild — Design Spec
**Date:** 2026-03-26
**Status:** Approved for implementation
**Scope:** Replace `scanForBuzzwords` + broad `MutationObserver` with an intent-driven PM activity sensor

---

## Problem

The current ambient detection reads `document.body.innerText` unconditionally on every DOM mutation. This means:
- The glow dot fires when a PM keyword exists *anywhere* on the page — nav bars, sidebars, comments — not when the user is actively working with PM content
- It cannot distinguish "user is writing about retention" from "the word retention appears somewhere on this Notion page"
- No signal quality — every keyword match is treated equally regardless of user intent

The result: the glow dot shows up at the wrong times, trains users to ignore it, and fails to deliver on the core promise of showing up "in the hour of need."

---

## Design Goal

Replace content-based sensing with **user-state sensing**. Detect *what the user is doing*, not *what content exists on the page*.

Three triggers, ranked by signal quality:

| Trigger | Signal | Interaction model |
|---------|--------|-------------------|
| Selection highlight | Highest — user pointed at something specific | Click dot → instant insight, no voice |
| Write + pause | High — user actively writing PM content, paused/stuck | Click dot → question chips → tap → insight |
| Reading mode | Medium — user passively reading PM content | Same as current glow dot (existing flow) |

Double-tap Ctrl + voice is **kept unchanged** as the explicit "I have a specific question" path.

---

## Trigger 1: Selection Sensor

### How it works
- Listens to `document.addEventListener('selectionchange')`
- On each event, reads `window.getSelection().toString().trim()`
- If selection is 2–200 chars AND contains a PM keyword → show selection dot

### Dot positioning
- Positioned near the selection using `Range.getBoundingClientRect()`
- Appears at the top-right corner of the selection bounding box
- Small (10px), pulsing orange — same visual language as write+pause dot

### Interaction
- `mousedown` on dot calls `event.preventDefault()` — prevents the browser from clearing the selection before the click handler can capture it
- Click → fires `QUERY` with selection as primary signal, empty transcript
- No voice, no mic, no additional step

### Edge cases handled
- `mousedown` preventDefault preserves selection through click
- Selection cleared by user (click elsewhere) → dot hides immediately via next `selectionchange` event
- Postcard already visible → selection dot suppressed (one active state at a time)

---

## Trigger 2: Write + Pause Sensor

### Detection strategy
Uses **keystroke tracking**, not MutationObserver scoped to `activeElement`. Rationale: Google Docs uses a canvas editor and Notion uses deeply nested contenteditable divs — `activeElement` is unreliable across these environments. Printable `keydown` events fire correctly in all of them.

### Flow
```
User types printable characters
    → PM keyword detected in page (lightweight keyword scan on debounced keydown)
    → 1.5s since last printable keystroke
        → Fire Groq GENERATE_QUESTIONS silently (eager fetch)
        → Groq returns 2-3 contextual question chips in <500ms
        → Cache { keyword, questions, blockContent, timestamp }
    → User resumes typing → cancel timer, invalidate cache, suppress dot
    → OR user still paused at 3.5s → show write+pause dot (bottom-right, fixed)

User clicks dot
    → Questions panel replaces dot (see UI section)
    → User taps a question chip
        → Fire QUERY with chip text as transcript + blockContent as pageContext
        → Normal RAG pipeline → postcard + audio
```

### Timing
- **1.5s** — eager Groq fetch trigger (gives Groq ~2s to complete before dot appears)
- **3.5s** — dot appearance threshold
- If Groq hasn't returned by 3.5s → show dot with loading state; questions appear when ready

### Cache invalidation
- User resumes typing → cache discarded, dot suppressed
- Block content changes significantly (>20 chars different) → re-fetch
- One pending Groq request at a time — new keyword detected cancels previous request
- Cache expires after 60s

### Reading mode detection
Before showing write+pause dot, confirm user is in editing context:
```js
const active = document.activeElement;
const isEditing = active.isContentEditable || active.matches('input, textarea, [contenteditable]');
```
If not editing → skip write+pause trigger (defer to reading sensor).

---

## Trigger 3: Reading Sensor (scoped existing)

### What changes
- Keeps existing `MutationObserver` on `document.body`
- **Only fires if user is not in editing context:**
  ```js
  const active = document.activeElement;
  const isEditing = active.isContentEditable || active.matches('input, textarea, [contenteditable]');
  if (isEditing) return; // user is writing — write+pause sensor handles this
  ```
- **New gate: 20s minimum on page** before first reading-mode trigger (prevents firing on page load)
- Cooldowns unchanged: 3min general, 30min per topic

### What stays the same
- PM_BUZZWORDS list
- TOPIC_MAP
- `showBuzzwordChip()` → existing glow dot + pill hover behaviour
- Click → `activateLennyLive()` (voice flow, unchanged)

---

## Backend Data Flow

### New message: `GENERATE_QUESTIONS`

**Content script → service worker:**
```js
{
  type: 'GENERATE_QUESTIONS',
  keyword: 'retention',
  blockContent: 'our retention strategy should focus on...' // first 300 chars of active block
}
```

**Service worker → Groq** (new function `generateQuestions()` in `background/abstraction.js`):
```
System: You are helping a junior PM who is stuck while writing.
        Generate exactly 3 short, specific questions they might want to ask about this topic.
        Questions must be answerable with a concrete product management insight.
        Output ONLY the 3 questions, one per line. No numbering. No preamble. No bullet points.

User: Topic: retention
      Context: our retention strategy should focus on...
```
- Model: `llama-3.1-8b-instant` (same as abstraction)
- temperature: 0.5, max_tokens: 120
- No embedding, no Supabase — pure Groq call

**Service worker → content script:**
```js
{ type: 'QUESTIONS_READY', questions: ['...', '...', '...'] }
```

### Fix: empty transcript in `handleQuery`

Selection dot fires QUERY with empty transcript. Current `cleanQuery('')` returns `''` which bypasses SELECTION_REF_RE. Explicit guard needed at top of `handleQuery`:

```js
// Selection dot path: empty transcript + selection present → use selection directly
if (!cleanedTranscript && selection) {
  cleanedTranscript = selection.trim();
}
```

### What stays unchanged
- RAG pipeline (embed → pgvector → `match_transcript_chunks`)
- Groq abstraction fallback (`abstractQuery`)
- Synthesis (`synthesizeResponse`)
- ElevenLabs TTS
- Two-push architecture (RESPONSE + AUDIO)
- `SELECTION_REF_RE` logic (still handles "tell me about the highlighted text" voice queries)

---

## UI Components (separate agent)

The following UI work is out of scope for the backend spec and will be handled separately:

- **Selection dot**: positioned near selection via `Range.getBoundingClientRect()`, `mousedown preventDefault`
- **Write+pause dot**: fixed bottom-right, same visual as current glow dot
- **Questions panel**: replaces write+pause dot on click, shows 2-3 question chips as tappable buttons, ✕ to dismiss
- **Mutual exclusion**: only one ambient state active at a time (selection dot, write+pause dot, or reading dot — never multiple)

---

## Files Changed

| File | Change |
|------|--------|
| `content/content-script.js` | Replace `scanForBuzzwords` with three sensors; add selection dot + questions panel UI; add `QUESTIONS_READY` message handler |
| `background/service-worker.js` | Add `GENERATE_QUESTIONS` handler; fix empty transcript guard in `handleQuery` |
| `background/abstraction.js` | Add `generateQuestions(keyword, blockContent)` function |

No new files. No manifest changes. No schema changes.

---

## Success Criteria

1. Selection dot appears within 200ms of selecting a PM keyword
2. Selection dot click fires insight without voice, using selected text as query
3. Write+pause dot only appears when user is actively editing (not reading)
4. Questions panel shows within 100ms of dot click (Groq response pre-cached)
5. Reading sensor only fires after 20s on page, never during active editing
6. No regression on double-tap Ctrl + voice flow
7. `document.body.innerText` is never read in the write+pause or selection paths
