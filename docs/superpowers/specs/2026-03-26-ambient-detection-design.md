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

## Google Docs Constraints

Google Docs uses a canvas-based editor. Two standard DOM APIs do not work on Google Docs:

1. `window.getSelection().toString()` — returns empty string (selection is not in DOM, it's rendered on canvas)
2. `document.activeElement.isContentEditable` — returns false even while user is typing (active element is a non-contenteditable div in the canvas layer)

**Consequence for each sensor:**
- **Selection sensor** — disabled on Google Docs. `selectionchange` fires but `getSelection()` returns empty. The sensor silently no-ops on Docs.
- **Write+pause sensor** — works via keystroke tracking (not activeElement), but the editing gate check must use a Google Docs-specific path (see below).
- **Reading sensor** — the `isEditing` guard must account for GDocs canvas typing.

**Google Docs editing detection:**
```js
function isUserEditing() {
  const active = document.activeElement;
  // Standard contenteditable check (Notion, Linear, Jira)
  if (active.isContentEditable || active.matches('input, textarea, [contenteditable]')) return true;
  // Google Docs canvas: user is editing if they've pressed a printable key in the last 5s
  if (location.hostname === 'docs.google.com' && Date.now() - lastPrintableKeystroke < 5000) return true;
  return false;
}
```

`lastPrintableKeystroke` is a module-level timestamp updated in the keydown handler (already needed for the write+pause sensor).

---

## Trigger 1: Selection Sensor

### How it works
- Listens to `document.addEventListener('selectionchange')`
- On each event, reads `window.getSelection().toString().trim()`
- If selection is 2–200 chars AND contains a PM keyword → show selection dot
- **Disabled on Google Docs** (see Google Docs Constraints above — `getSelection()` returns empty)

### Dot positioning
- The selection dot is `position: fixed` in the shadow DOM, coordinates set dynamically from `Range.getBoundingClientRect()`
- A new element `<div id="ll-selection-dot">` is added to the shadow root (separate from the existing bottom-right glow dot)
- On each `selectionchange` that passes the keyword check:
  ```js
  const range = window.getSelection().getRangeAt(0);
  const rect = range.getBoundingClientRect();
  selectionDot.style.top = (rect.top - 18) + 'px';   // just above selection
  selectionDot.style.left = (rect.right + 4) + 'px';  // just right of selection end
  selectionDot.classList.add('visible');
  ```
- On `selectionchange` that fails the check (user deselected) → `selectionDot.classList.remove('visible')`

### Interaction
- `mousedown` on dot calls `event.preventDefault()` AND `event.stopPropagation()` — prevents the browser from clearing the selection and prevents Notion's block editor from intercepting the event
- Click handler captures `window.getSelection().toString()` immediately (selection is preserved by `preventDefault`)
- Fires `QUERY` with captured selection, empty transcript

### Edge cases
- Postcard visible or state !== 'idle' → selection dot suppressed (existing `state` machine check)
- User moves selection to non-PM text → dot hides immediately
- Multiple rapid selectionchange events → debounce 150ms before showing dot

---

## Trigger 2: Write + Pause Sensor

### Detection strategy
Uses **keystroke tracking** (not MutationObserver scoped to `activeElement`). This is required because:
- Google Docs: `activeElement` is not contenteditable
- Notion: deeply nested contenteditable divs make `activeElement` unreliable

The keydown handler already exists for Ctrl double-tap detection. Extend it:

```js
// Module-level state
let lastPrintableKeystroke = 0;
let pendingQuestions = null;           // { keyword, questions, blockContent, timestamp } | null
let lastEagerFetchBlockContent = '';   // retained from triggerEagerFetch, attached to pendingQuestions on QUESTIONS_READY
let eagerFetchTimer = null;
let dotAppearTimer = null;

document.addEventListener('keydown', (e) => {
  // ... existing Ctrl and Escape handling ...

  // Track printable keystrokes for write+pause sensor
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    lastPrintableKeystroke = Date.now();
    // User resumed typing — cancel any pending eager fetch and suppress dot
    clearTimeout(eagerFetchTimer);
    clearTimeout(dotAppearTimer);
    pendingQuestions = null;
    hideWritePauseDot();

    // Start new 1.5s eager fetch timer
    eagerFetchTimer = setTimeout(triggerEagerFetch, 1500);
  }
});
```

### Eager fetch flow
```js
function triggerEagerFetch() {
  const keyword = detectPMKeywordInPage(); // scan document.body.innerText (lightweight, ~5ms)
  if (!keyword) return;

  const blockContent = extractPageContext(); // reuse existing 3-priority cascade
  lastEagerFetchBlockContent = blockContent; // retain for QUESTIONS_READY handler
  chrome.runtime.sendMessage({ type: 'GENERATE_QUESTIONS', keyword, blockContent });

  // Schedule dot appearance at 3.5s (2s after eager fetch trigger)
  dotAppearTimer = setTimeout(() => {
    if (pendingQuestions) {
      showWritePauseDot(); // questions already cached
    } else {
      showWritePauseDot('loading'); // questions still in flight — dot shows with spinner
    }
  }, 2000); // 1.5s already elapsed, so 2s more = 3.5s total
}
```

### Cache lifecycle
```js
// Set by QUESTIONS_READY handler
pendingQuestions = { keyword, questions, blockContent, timestamp: Date.now() };

// Invalidated when:
// 1. User resumes typing (keydown handler above)
// 2. Questions panel dismissed (✕ button)
// 3. 60s timeout: if (Date.now() - pendingQuestions.timestamp > 60000) pendingQuestions = null;
```

### Groq failure handling
If `GENERATE_QUESTIONS` fails (Groq error):
- Service worker sends `QUESTIONS_READY { questions: null, error: true }`
- Content script: `pendingQuestions = null` → `clearTimeout(dotAppearTimer)` → dot suppressed silently
- `hideWritePauseDot()` must be safe to call when dot is not yet visible (no-op if hidden)
- No user-visible error — dot simply never shows

### blockContent extraction
Reuse existing `extractPageContext()` (3-priority cascade: activeElement → semantic container → title fallback). This is the best available signal across all editors. On Google Docs, `extractPageContext()` will fall back to the `article`/`main` container or page title — imperfect but sufficient for question generation.

### Reading mode detection gate
```js
// At top of triggerEagerFetch and in reading sensor:
function isUserEditing() {
  const active = document.activeElement;
  if (active.isContentEditable || active.matches('input, textarea, [contenteditable]')) return true;
  if (location.hostname === 'docs.google.com' && Date.now() - lastPrintableKeystroke < 5000) return true;
  return false;
}
```

---

## Trigger 3: Reading Sensor (scoped existing)

### What changes
Gate added at top of `scanForBuzzwords()`:
```js
function scanForBuzzwords() {
  if (state !== 'idle') return;
  if (isUserEditing()) return;                          // NEW: skip during active editing
  if (Date.now() - pageLoadTime < 20000) return;        // NEW: 20s minimum on page
  // ... rest of existing logic unchanged ...
}
```

`pageLoadTime` is set once at content script load: `const pageLoadTime = Date.now();`

### What stays the same
- PM_BUZZWORDS list
- TOPIC_MAP
- `showBuzzwordChip()` → existing glow dot + pill hover behaviour
- Cooldowns: 3min general, 30min per topic
- Click → `activateLennyLive()` (voice flow, unchanged)

---

## State Machine Extension

The existing state machine covers `idle | listening | loading` for the double-tap Ctrl flow. Ambient states are tracked separately to avoid collision:

```js
// Module-level ambient state (separate from state machine)
let ambientState = 'none'; // 'none' | 'selection-dot' | 'write-pause-dot' | 'questions-panel'
```

**Mutual exclusion rules:**
- Selection dot visible → write+pause dot suppressed (selection signal is higher quality)
- Write+pause dot visible → selection dot can still appear (higher quality signal takes over)
- Postcard visible (`state === loading` or postcard not hidden) → all ambient dots suppressed
- Double-tap Ctrl fires → all ambient dots hidden immediately, voice flow takes over
- `ambientState` resets to `'none'` on: postcard shown, voice activated, Escape pressed, questions panel dismissed

**Interaction with existing state machine:**
```js
function activateLennyLive() {
  if (state !== 'idle') return;
  hideAllAmbientUI();   // NEW: clear any active dots/panels before activating
  ambientState = 'none';
  state = 'listening';
  // ... rest unchanged ...
}
```

---

## Backend Data Flow

### New message: `GENERATE_QUESTIONS`

**Content script → service worker:**
```js
{ type: 'GENERATE_QUESTIONS', keyword: 'retention', blockContent: '...first 300 chars...' }
```

**Service worker handler (in `service-worker.js` `onMessage`):**
```js
if (message.type === 'GENERATE_QUESTIONS') {
  const tabId = sender.tab?.id;
  if (!tabId) return;
  generateQuestions(message.keyword, message.blockContent)
    .then(questions => {
      chrome.tabs.sendMessage(tabId, { type: 'QUESTIONS_READY', questions });
    })
    .catch(() => {
      chrome.tabs.sendMessage(tabId, { type: 'QUESTIONS_READY', questions: null, error: true });
    });
  return; // no async response needed
}
```

**`generateQuestions()` in `background/abstraction.js`:**
```js
export async function generateQuestions(keyword, blockContent) {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0.5,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content: `You are helping a junior PM who is stuck while writing.
Generate exactly 3 short, specific questions they might want to ask about this topic.
Questions must be answerable with a concrete product management insight.
Output ONLY the 3 questions, one per line. No numbering. No preamble. No bullet points.`
        },
        {
          role: 'user',
          content: `Topic: ${keyword}\nContext: ${blockContent.slice(0, 300)}`
        }
      ]
    })
  });
  const data = await resp.json();
  const text = data.choices[0].message.content.trim();
  return text.split('\n').filter(q => q.trim().length > 0).slice(0, 3);
}
```

**Service worker `onMessage` also handles `QUESTIONS_READY` path in content script:**

```js
// In content-script.js onMessage listener:
if (message.type === 'QUESTIONS_READY') {
  if (message.error || !message.questions) {
    pendingQuestions = null;
    clearTimeout(dotAppearTimer); // cancel dot appearance if Groq failed before 3.5s
    hideWritePauseDot();          // no-op if dot not yet visible — safe to call always
    return;
  }
  // blockContent is retained from triggerEagerFetch() scope, not echoed by SW.
  // It is captured at eager fetch time and used when a question chip fires a QUERY.
  pendingQuestions = {
    keyword: message.keyword,  // SW echoes keyword back
    questions: message.questions,
    blockContent: lastEagerFetchBlockContent, // module-level var set in triggerEagerFetch()
    timestamp: Date.now()
  };
  // If dot is already showing in loading state, upgrade it to show questions
  if (ambientState === 'write-pause-dot') {
    updateWritePauseDotReady();
  }
}
```

**Fix:** Service worker must echo `keyword` back in `QUESTIONS_READY` so content script can cache it. Update handler:
```js
chrome.tabs.sendMessage(tabId, { type: 'QUESTIONS_READY', keyword: message.keyword, questions });
```

### Fix: empty transcript in `handleQuery`

Insert as the **first operation in `handleQuery`**, before `cleanQuery(transcript)` is called:

```js
async function handleQuery(message, tabId) {
  const { transcript, selection, pageContext = '' } = message;

  // Selection dot path: empty transcript + selection → use selection directly.
  // Must be checked before cleanQuery() — cleanQuery('') returns '' which
  // would reach embedQuery('') and fail with a Gemini error.
  if (!transcript?.trim() && selection) {
    // Skip conversational check and SELECTION_REF_RE — go straight to search
    const embedding = await embedQuery(selection.trim());
    // ... rest of normal RAG flow with selection as query ...
    return;
  }

  let cleanedTranscript = cleanQuery(transcript);
  // ... rest of existing handleQuery unchanged ...
}
```

### What stays unchanged
- RAG pipeline, Groq abstraction fallback, synthesis, ElevenLabs TTS, two-push architecture
- `SELECTION_REF_RE` (still handles "tell me about the highlighted text" voice queries)

---

## UI Components (separate agent)

The following UI work is out of scope for this backend spec and will be handled by a separate agent. The backend spec defines the message contracts; the UI agent implements the visual components against those contracts.

UI agent must implement:
- `<div id="ll-selection-dot">` — shadow DOM element, `position: fixed`, shown/hidden via JS coordinates from `Range.getBoundingClientRect()`
- `<div id="ll-write-pause-dot">` — fixed bottom-right, shows loading state or ready state
- `<div id="ll-questions-panel">` — replaces write+pause dot on click, shows 2-3 question chips + ✕
- `hideAllAmbientUI()` — helper that hides all three elements and resets `ambientState = 'none'`
- `updateWritePauseDotReady()` — upgrades dot from loading → ready state when `QUESTIONS_READY` arrives

---

## Files Changed

| File | Change |
|------|--------|
| `content/content-script.js` | Add selection sensor, write+pause sensor, extend keydown handler, add `QUESTIONS_READY` + selection dot message handlers, extend `onMessage` listener, gate reading sensor with `isUserEditing()` + 20s page load delay, add `ambientState` tracking, add `hideAllAmbientUI()` call in `activateLennyLive()` |
| `background/service-worker.js` | Add `GENERATE_QUESTIONS` handler in `onMessage`; fix empty transcript guard in `handleQuery` (insert before `cleanQuery()`) |
| `background/abstraction.js` | Add `generateQuestions(keyword, blockContent)` export |

No new files. No manifest changes. No schema changes.

---

## Success Criteria

1. Selection dot appears within 300ms of selecting a PM keyword on Notion, Linear, and Jira (not Google Docs — canvas limitation)
2. Selection dot click fires insight without voice, using selected text as query
3. Write+pause dot only appears when user has not typed for 3.5s AND a PM keyword is on the page
4. Write+pause dot never appears during active editing on Google Docs (keystroke-based gate)
5. Questions panel shows within 100ms of dot click (Groq response pre-cached at 1.5s mark)
6. If Groq fails on eager fetch, dot is silently suppressed — no user-visible error
7. Reading sensor does not fire for first 20s on any page, and never fires during active editing
8. All ambient dots hidden immediately when double-tap Ctrl activates voice flow
9. No regression on double-tap Ctrl + voice flow
10. `document.body.innerText` is read exactly once per eager fetch trigger (in `detectPMKeywordInPage()` at the 1.5s mark) — not on every DOM mutation as in the old approach. The selection sensor never reads `document.body.innerText`.
