# Ambient Detection Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current broad `scanForBuzzwords()` with an intent-driven PM activity sensor — three triggers: selection highlight, write+pause, and scoped reading mode.

**Architecture:** Two files change on the backend (`abstraction.js` adds `generateQuestions()`, `service-worker.js` adds the `GENERATE_QUESTIONS` message handler and fixes the empty-transcript guard). All sensing and state logic lives in `content-script.js` (one big file — MV3 content scripts cannot use ES modules). The UI shell functions (`showSelectionDot`, `showWritePauseDot`, `showQuestionsPanel`, `hideAllAmbientUI`) are stubbed in this plan and filled in by a separate UI agent.

**Tech Stack:** Vanilla JS (no TypeScript, no frameworks), Chrome MV3 content scripts, Groq `llama-3.1-8b-instant`, Shadow DOM

**Spec:** `docs/superpowers/specs/2026-03-26-ambient-detection-design.md`

**Senior engineering notes to carry into every task:**
- `isUserEditing()` must use `active.isContentEditable || active.matches('input, textarea')` — NOT `[contenteditable]` (that selector matches `contenteditable="false"` used by Notion for read-only blocks)
- `generateQuestions()` must strip leading bullets/numbers from Groq output: `.map(q => q.replace(/^[-•\d.)\s]+/, '').trim())`

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `background/abstraction.js` | Modify | Add `generateQuestions(keyword, blockContent)` export |
| `background/service-worker.js` | Modify | Add `GENERATE_QUESTIONS` handler in `onMessage`; add `generateQuestions` import; fix empty-transcript guard in `handleQuery` |
| `content/content-script.js` | Modify | Add ambient state variables; extend keydown handler; add `isUserEditing()`, `triggerEagerFetch()`, `detectPMKeywordInPage()`; add `selectionchange` listener; gate `scanForBuzzwords()`; add `QUESTIONS_READY` to `onMessage`; call `hideAllAmbientUI()` in `activateLennyLive()`; add UI stub functions |

---

## Task 1: Add `generateQuestions()` to `background/abstraction.js`

**Files:**
- Modify: `background/abstraction.js`

This adds a new exported function alongside the existing `abstractQuery()`. It calls Groq with a different prompt — no embedding, no Supabase, just fast question generation.

- [ ] **Step 1: Add `generateQuestions()` export at the bottom of `background/abstraction.js`**

Append after the closing of `abstractQuery()`:

```js
/**
 * Generate 2-3 contextual PM questions for the write+pause sensor.
 * Called when the user pauses typing for 1.5s in a block containing a PM keyword.
 * Fast Groq call — no embedding, no Supabase.
 *
 * @param {string} keyword      - PM keyword detected in the active block
 * @param {string} blockContent - Text of the active block (first 300 chars)
 * @returns {Promise<string[]>} - Array of 2-3 question strings
 */
export async function generateQuestions(keyword, blockContent) {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
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
Output ONLY the 3 questions, one per line. No numbering. No preamble. No bullet points.`,
        },
        {
          role: 'user',
          content: `Topic: ${keyword}\nContext: ${blockContent.slice(0, 300)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq generateQuestions failed: ${res.status} — ${errBody}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';

  // Strip leading bullets/numbers — LLaMA occasionally ignores "no numbering" instruction
  return text
    .split('\n')
    .map(q => q.replace(/^[-•\d.)\s]+/, '').trim())
    .filter(q => q.length > 0)
    .slice(0, 3);
}
```

- [ ] **Step 2: Verify the file looks correct**

Check that `generateQuestions` is exported alongside `abstractQuery`, both using the same `GROQ_API_URL` and `GROQ_API_KEY` at the top of the file.

- [ ] **Step 3: Commit**

```bash
git add background/abstraction.js
git commit -m "feat: add generateQuestions() to abstraction.js for write+pause sensor"
```

---

## Task 2: Add `GENERATE_QUESTIONS` handler to `background/service-worker.js`

**Files:**
- Modify: `background/service-worker.js`

Two changes: (1) import `generateQuestions`, (2) add the new message handler.

- [ ] **Step 1: Add `generateQuestions` to the import line at the top of `service-worker.js`**

Change:
```js
import { abstractQuery } from './abstraction.js';
```
To:
```js
import { abstractQuery, generateQuestions } from './abstraction.js';
```

- [ ] **Step 2: Add `GENERATE_QUESTIONS` handler inside the `chrome.runtime.onMessage.addListener` callback**

In the existing `onMessage` listener, after the `if (message.type === 'QUERY')` block, add:

```js
  if (message.type === 'GENERATE_QUESTIONS') {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    generateQuestions(message.keyword, message.blockContent)
      .then(questions => {
        chrome.tabs.sendMessage(tabId, {
          type: 'QUESTIONS_READY',
          keyword: message.keyword,   // echo keyword so content script can cache it
          questions,
        });
      })
      .catch(err => {
        console.warn('[LennyLive] generateQuestions failed:', err.message);
        chrome.tabs.sendMessage(tabId, {
          type: 'QUESTIONS_READY',
          keyword: message.keyword,
          questions: null,
          error: true,
        });
      });
    return; // no async response needed — response goes via chrome.tabs.sendMessage
  }
```

- [ ] **Step 3: Reload extension and smoke-test**

Open Chrome → `chrome://extensions` → Reload Lenny Live. Open the browser console on a Notion page. In the DevTools console run:

```js
chrome.runtime.sendMessage({ type: 'GENERATE_QUESTIONS', keyword: 'retention', blockContent: 'our retention strategy needs work' });
```

Expected: no JS errors. (The response will come back via `QUESTIONS_READY` to the content script — not visible here yet, but no crash = good.)

- [ ] **Step 4: Commit**

```bash
git add background/service-worker.js
git commit -m "feat: add GENERATE_QUESTIONS handler in service-worker for write+pause eager fetch"
```

---

## Task 3: Fix empty-transcript guard in `handleQuery`

**Files:**
- Modify: `background/service-worker.js` (lines ~92–100)

The selection dot fires a `QUERY` with an empty transcript. Without this guard, `cleanQuery('')` returns `''` which reaches `embedQuery('')` and crashes with a Gemini error.

- [ ] **Step 1: Insert the empty-transcript guard as the FIRST operation in `handleQuery`**

Find the `handleQuery` function. It currently starts:
```js
async function handleQuery(message, tabId) {
  const { transcript, selection, pageContext = '' } = message;
  let cleanedTranscript = cleanQuery(transcript);
```

Replace with:
```js
async function handleQuery(message, tabId) {
  const { transcript, selection, pageContext = '' } = message;

  // Selection dot path: empty transcript + selection present → use selection directly.
  // Must be the FIRST check — cleanQuery('') returns '' which would reach
  // embedQuery('') and fail with a Gemini API error.
  if (!transcript?.trim() && selection?.trim()) {
    console.log('[LennyLive] Selection dot query — using selection:', selection.trim());
    const embedding = await embedQuery(selection.trim());
    console.log('[LennyLive] Searching Supabase pgvector (threshold: 0.45, fast-path: 0.62)...');
    const chunks = await searchChunks(embedding);
    if (!chunks || chunks.length === 0) {
      pushResponse(tabId, { type: 'RESPONSE', status: 'no_results', insight: null });
      return;
    }
    const top = chunks[0];
    const insight = shapeInsight(top, false);
    const relatedInsights = chunks.slice(1, 3).map(c => shapeInsight(c, false));
    console.log('[LennyLive] Selection dot hit:', insight.guest_name, '| similarity:', top.similarity);
    pushResponse(tabId, { type: 'RESPONSE', status: 'ok', insight, relatedInsights });
    pushAudio(insight, tabId, selection.trim(), chunks);
    return;
  }

  let cleanedTranscript = cleanQuery(transcript);
```

- [ ] **Step 2: Reload extension and test selection dot path (manual smoke test)**

In Notion, highlight the word "retention". Open DevTools console and manually send:
```js
chrome.runtime.sendMessage({ type: 'QUERY', transcript: '', selection: 'retention', pageContext: '' });
```
Expected console output: `[LennyLive] Selection dot query — using selection: retention` followed by a Supabase hit and `RESPONSE` push. No Gemini error.

- [ ] **Step 3: Commit**

```bash
git add background/service-worker.js
git commit -m "fix: empty transcript guard in handleQuery for selection dot path"
```

---

## Task 4: Add ambient state variables and helpers to `content/content-script.js`

**Files:**
- Modify: `content/content-script.js`

Add module-level state for the ambient sensing system. These variables are referenced by Tasks 5–8. Add them after the existing `let state = 'idle';` line.

- [ ] **Step 1: Add ambient state variables after `let state = 'idle';`**

Find the line:
```js
let state = 'idle';
```

After it, add:
```js
// ─── Ambient Detection State ──────────────────────────────────────────────────
// Separate from the voice state machine (idle|listening|loading).
// Tracks which ambient UI element is currently active.

let ambientState = 'none'; // 'none' | 'selection-dot' | 'write-pause-dot' | 'questions-panel'

// Write+pause sensor state
let lastPrintableKeystroke = 0;       // timestamp of last printable keydown
let lastEagerFetchBlockContent = '';  // blockContent captured at eager fetch time
let pendingQuestions = null;          // { keyword, questions, blockContent, timestamp } | null
let eagerFetchTimer = null;           // 1.5s timer → triggers Groq fetch
let dotAppearTimer = null;            // 3.5s timer → shows write+pause dot

// Reading sensor gate
const pageLoadTime = Date.now();      // used to enforce 20s minimum before reading sensor fires
```

- [ ] **Step 2: Add `isUserEditing()` helper**

Add after the ambient state variables:

```js
// Returns true if the user is actively editing (typing in an input/contenteditable).
// Used to gate the reading sensor and write+pause sensor.
//
// IMPORTANT — spec discrepancy: The spec's code snippet includes `[contenteditable]`
// in the matches() selector, but this plan intentionally omits it per the senior
// engineering note. `[contenteditable]` matches contenteditable="false" which Notion
// uses on read-only blocks inside its editor — causing false positives.
// `active.isContentEditable` is the DOM's own computed boolean that correctly handles
// inheritance and explicit false values. Use isContentEditable, not the attribute selector.
function isUserEditing() {
  const active = document.activeElement;
  if (!active) return false;
  if (active.isContentEditable || active.matches('input, textarea')) return true;
  // Google Docs uses a canvas editor — activeElement is not contenteditable.
  // Fall back to: has the user pressed a printable key in the last 5 seconds?
  if (location.hostname === 'docs.google.com' && Date.now() - lastPrintableKeystroke < 5000) return true;
  return false;
}
```

- [ ] **Step 3: Add `detectPMKeywordInPage()` helper**

**Placement is critical:** `PM_BUZZWORDS` is declared in the lower half of `content-script.js` (around line 940). `detectPMKeywordInPage()` MUST be placed AFTER the `PM_BUZZWORDS` array declaration or it will throw `PM_BUZZWORDS is not defined`. Place it immediately after the `TOPIC_MAP` and `getDisplayTopic` block that follows `PM_BUZZWORDS`.

```js
// Lightweight scan for PM keywords. Called at the 1.5s mark of the write+pause sensor.
// Reads document.body.innerText once per eager fetch trigger — not on every mutation.
// Must be placed AFTER the PM_BUZZWORDS array declaration in this file.
function detectPMKeywordInPage() {
  const text = document.body.innerText.slice(0, 5000);
  for (const word of PM_BUZZWORDS) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    if (re.test(text)) return word;
  }
  return null;
}
```

- [ ] **Step 4: Add UI stub functions**

These are placeholders. The UI agent fills in the implementation. Add after the helpers:

```js
// ─── Ambient UI Stubs (implemented by UI agent) ───────────────────────────────

function showSelectionDot(rect) {
  // TODO (UI agent): show pulsing orange dot at {top: rect.top - 18, left: rect.right + 4}
  // Set ambientState = 'selection-dot' when shown
  console.log('[LennyLive] showSelectionDot stub — rect:', rect);
}

function hideSelectionDot() {
  // TODO (UI agent): hide selection dot
  if (ambientState === 'selection-dot') ambientState = 'none';
}

function showWritePauseDot(mode = 'ready') {
  // TODO (UI agent): show write+pause dot bottom-right
  // mode: 'ready' (questions available) | 'loading' (questions in flight)
  // Set ambientState = 'write-pause-dot' when shown
  console.log('[LennyLive] showWritePauseDot stub — mode:', mode);
}

function hideWritePauseDot() {
  // TODO (UI agent): hide write+pause dot — safe to call when not visible (no-op)
  if (ambientState === 'write-pause-dot') ambientState = 'none';
}

function showQuestionsPanel(questions) {
  // TODO (UI agent): replace write+pause dot with questions panel showing chip buttons
  // Set ambientState = 'questions-panel' when shown
  console.log('[LennyLive] showQuestionsPanel stub — questions:', questions);
}

function updateWritePauseDotReady() {
  // TODO (UI agent): upgrade dot from loading spinner to ready state
  console.log('[LennyLive] updateWritePauseDotReady stub');
}

function hideAllAmbientUI() {
  hideSelectionDot();
  hideWritePauseDot();
  // Also hide questions panel if open
  if (ambientState === 'questions-panel') ambientState = 'none';
  // TODO (UI agent): hide questions panel element
}
```

- [ ] **Step 5: Reload extension — verify no console errors**

`chrome://extensions` → Reload Lenny Live → Open Notion → Check DevTools console for any `undefined` or syntax errors.

- [ ] **Step 6: Commit**

```bash
git add content/content-script.js
git commit -m "feat: add ambient state variables, isUserEditing(), detectPMKeywordInPage(), UI stubs"
```

---

## Task 5: Extend keydown handler + add `triggerEagerFetch()`

**Files:**
- Modify: `content/content-script.js`

Extend the existing `document.addEventListener('keydown', ...)` handler to track printable keystrokes and drive the write+pause sensor.

- [ ] **Step 1: Add printable keystroke tracking to the existing keydown handler**

Find the existing keydown listener:
```js
document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') {
    ...
  }

  if (e.key === 'Escape') {
    ...
  }
});
```

Add the printable keystroke block INSIDE the listener, after the existing Escape block:

```js
  // Write+pause sensor — track printable keystrokes
  // e.key.length === 1 catches regular characters; excludes Ctrl, Shift, Alt, Enter, etc.
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    lastPrintableKeystroke = Date.now();

    // User resumed typing — cancel any pending eager fetch and suppress dot.
    // Reset unconditionally: harmless if already null, prevents stale chips.
    clearTimeout(eagerFetchTimer);
    clearTimeout(dotAppearTimer);
    pendingQuestions = null;
    hideWritePauseDot(); // no-op if dot not visible

    // Start new 1.5s eager fetch timer
    eagerFetchTimer = setTimeout(triggerEagerFetch, 1500);
  }
```

- [ ] **Step 2: Add `triggerEagerFetch()` function**

Add after the keydown listener:

```js
// Called 1.5s after the last printable keystroke.
// Fires Groq silently to pre-generate question chips before the dot appears.
function triggerEagerFetch() {
  if (state !== 'idle') return;          // don't interrupt active voice session
  if (!isUserEditing()) return;          // only fire during active editing

  const keyword = detectPMKeywordInPage();
  if (!keyword) return;                  // no PM keyword on page — nothing to do

  const blockContent = extractPageContext(); // reuse existing 3-priority cascade
  lastEagerFetchBlockContent = blockContent;

  console.log('[LennyLive] Write+pause: eager Groq fetch for keyword:', keyword);
  chrome.runtime.sendMessage({ type: 'GENERATE_QUESTIONS', keyword, blockContent });

  // Schedule dot appearance 2s from now (= 3.5s total from last keystroke)
  dotAppearTimer = setTimeout(() => {
    if (state !== 'idle') return;
    if (pendingQuestions) {
      showWritePauseDot('ready');
    } else {
      showWritePauseDot('loading');  // questions still in flight
    }
  }, 2000);
}
```

- [ ] **Step 3: Reload and verify write+pause sensor fires**

Open Notion, click into a page that has "retention" or "roadmap" on it. Type a few characters and stop. After 1.5s you should see in DevTools console:
```
[LennyLive] Write+pause: eager Groq fetch for keyword: retention
```
After 3.5s:
```
[LennyLive] showWritePauseDot stub — mode: ready
```
(The stub logs because UI isn't implemented yet.)

- [ ] **Step 4: Commit**

```bash
git add content/content-script.js
git commit -m "feat: write+pause sensor — keystroke tracking + triggerEagerFetch()"
```

---

## Task 6: Add `QUESTIONS_READY` handler to content script `onMessage`

**Files:**
- Modify: `content/content-script.js`

The existing `onMessage` listener handles `RESPONSE` and `AUDIO`. Add `QUESTIONS_READY`.

- [ ] **Step 1: Find the existing onMessage listener**

```js
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESPONSE') { handleResponse(message); }
  if (message.type === 'AUDIO')    { playAudio(message.audio); }
});
```

- [ ] **Step 2: Add `QUESTIONS_READY` handler**

```js
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESPONSE') { handleResponse(message); }
  if (message.type === 'AUDIO')    { playAudio(message.audio); }

  if (message.type === 'QUESTIONS_READY') {
    if (message.error || !message.questions || message.questions.length === 0) {
      // Groq failed — cancel dot appearance and reset silently
      pendingQuestions = null;
      clearTimeout(dotAppearTimer);
      hideWritePauseDot(); // safe to call even if dot not yet shown
      console.warn('[LennyLive] QUESTIONS_READY: Groq failed — dot suppressed');
      return;
    }

    pendingQuestions = {
      keyword: message.keyword,
      questions: message.questions,
      blockContent: lastEagerFetchBlockContent, // captured at eager fetch time
      timestamp: Date.now(),
    };

    console.log('[LennyLive] QUESTIONS_READY:', message.keyword, message.questions);

    // If dot is already visible in loading state, upgrade it to show questions
    if (ambientState === 'write-pause-dot') {
      updateWritePauseDotReady();
    }
  }
});
```

- [ ] **Step 3: Reload and verify end-to-end write+pause flow**

Open Notion with "retention" on the page. Type and pause 3.5s. Verify in console:
1. `[LennyLive] Write+pause: eager Groq fetch for keyword: retention`
2. `[LennyLive] QUESTIONS_READY: retention ['How do you...', 'What is...', '...']`
3. `[LennyLive] showWritePauseDot stub — mode: ready`

Questions are real Groq output (not null). 3 strings in the array.

- [ ] **Step 4: Commit**

```bash
git add content/content-script.js
git commit -m "feat: QUESTIONS_READY handler — caches questions, upgrades dot state"
```

---

## Task 7: Add selection sensor (`selectionchange` listener)

**Files:**
- Modify: `content/content-script.js`

- [ ] **Step 1: Add the `selectionchange` listener**

Add after the keydown listener section:

```js
// ─── Selection Sensor ─────────────────────────────────────────────────────────
// Fires when user highlights text. Shows a selection dot near the selection
// if the selected text contains a PM keyword.
// Disabled on Google Docs — getSelection() returns empty on canvas editors.

let selectionDebounceTimer = null;

document.addEventListener('selectionchange', () => {
  clearTimeout(selectionDebounceTimer);
  selectionDebounceTimer = setTimeout(() => {
    // Don't interrupt active voice session or postcard
    if (state !== 'idle') return;
    const pc = shadow.getElementById('ll-postcard');
    if (pc && !pc.classList.contains('hidden')) return;

    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';

    // Hide dot if selection cleared or too short/long
    if (text.length < 2 || text.length > 200) {
      hideSelectionDot();
      return;
    }

    // Check if selection contains a PM keyword
    const hasPMKeyword = PM_BUZZWORDS.some(word => {
      const re = new RegExp(`\\b${word}\\b`, 'i');
      return re.test(text);
    });

    if (!hasPMKeyword) {
      hideSelectionDot();
      return;
    }

    // Position dot near selection
    if (sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return; // empty rect (Google Docs canvas)

    ambientState = 'selection-dot';
    showSelectionDot(rect);
  }, 150); // 150ms debounce — prevents flicker during drag-select
});
```

- [ ] **Step 2: Wire up selection dot click**

The selection dot click fires a QUERY using the selection as the query. This goes in the UI stubs section — update `showSelectionDot` stub to capture and send the query:

Find the `showSelectionDot` stub and update it to at least log the selection that would be queried:

```js
function showSelectionDot(rect) {
  // Capture selection NOW (before mousedown clears it)
  const selectedText = window.getSelection()?.toString().trim() ?? '';
  console.log('[LennyLive] showSelectionDot stub — selectedText:', selectedText, 'rect:', rect);
  // TODO (UI agent): render dot at position, on click:
  //   event.preventDefault(); event.stopPropagation();
  //   chrome.runtime.sendMessage({ type: 'QUERY', transcript: '', selection: selectedText, pageContext: '' });
  //   hideSelectionDot();
  if (ambientState !== 'selection-dot') ambientState = 'selection-dot';
}
```

- [ ] **Step 3: Reload and test selection sensor**

Open Notion. Highlight the word "retention". Verify in DevTools console:
```
[LennyLive] showSelectionDot stub — selectedText: retention rect: DOMRect {...}
```

Highlight a non-PM word like "hello". Verify no dot log appears.

- [ ] **Step 4: Commit**

```bash
git add content/content-script.js
git commit -m "feat: selection sensor — selectionchange listener + PM keyword detection"
```

---

## Task 8: Gate reading sensor + integrate with `activateLennyLive()`

**Files:**
- Modify: `content/content-script.js`

Two final integrations: (1) gate the existing `scanForBuzzwords()` with `isUserEditing()` and the 20s page-load delay, (2) call `hideAllAmbientUI()` when voice activates or Escape is pressed.

- [ ] **Step 1: Gate `scanForBuzzwords()` with `isUserEditing()` and page-load delay**

Find the existing `scanForBuzzwords()` function:
```js
function scanForBuzzwords() {
  if (state !== 'idle') return; // never interrupt active session
  ...
}
```

Add two new guards immediately after the existing `state` check:
```js
function scanForBuzzwords() {
  if (state !== 'idle') return;
  if (isUserEditing()) return;                               // NEW: skip during active editing
  if (Date.now() - pageLoadTime < 20 * 1000) return;        // NEW: 20s minimum on page
  ...
}
```

- [ ] **Step 2: Call `hideAllAmbientUI()` in `activateLennyLive()`**

Find:
```js
function activateLennyLive() {
  if (state !== 'idle') return;
  state = 'listening';
  playPing();
  showIndicator('listening');
  startListening();
}
```

Change to:
```js
function activateLennyLive() {
  if (state !== 'idle') return;
  hideAllAmbientUI();   // clear any active ambient dots before voice activates
  state = 'listening';
  playPing();
  showIndicator('listening');
  startListening();
}
```

- [ ] **Step 3: Call `hideAllAmbientUI()` in the Escape handler**

Find the Escape key block in the keydown listener:
```js
  if (e.key === 'Escape') {
    if (state === 'listening' || state === 'loading') {
      cancelLennyLive();
    }
    ...
  }
```

Add `hideAllAmbientUI()` call:
```js
  if (e.key === 'Escape') {
    hideAllAmbientUI();   // always clear ambient UI on Escape
    if (state === 'listening' || state === 'loading') {
      cancelLennyLive();
    }
    ...
  }
```

- [ ] **Step 4: Cancel pending timers in `hideAllAmbientUI()`**

Update the `hideAllAmbientUI` stub to also clear the write+pause timers:
```js
function hideAllAmbientUI() {
  hideSelectionDot();
  hideWritePauseDot();
  clearTimeout(eagerFetchTimer);
  clearTimeout(dotAppearTimer);
  pendingQuestions = null;
  if (ambientState === 'questions-panel') ambientState = 'none';
  // TODO (UI agent): hide questions panel element
}
```

- [ ] **Step 5: Full regression test**

Reload extension. Test these scenarios on Notion:

1. **Reading sensor gated:** Open a Notion page with "retention" in it. The glow dot must NOT appear for the first 20 seconds. After 20s it may appear (existing behaviour).

2. **Reading sensor suppressed during editing:** Click into a Notion block and start typing. The reading sensor glow dot must not appear while typing.

3. **Voice activation clears ambient UI:** If the selection dot or write+pause dot is showing, double-tap Ctrl — both dots must disappear immediately.

4. **Escape clears ambient UI:** If a dot is showing, press Escape — dots disappear.

5. **Write+pause flow:** Type in a Notion block with "roadmap" in it. Pause. After ~3.5s the stub log appears. Resume typing — stub log for `hideWritePauseDot` appears.

- [ ] **Step 6: Commit**

```bash
git add content/content-script.js
git commit -m "feat: gate reading sensor, integrate hideAllAmbientUI() with voice activation + Escape"
```

---

## Task 9: Wire question chip tap → QUERY (content script)

**Files:**
- Modify: `content/content-script.js`

Add the function that fires when a question chip is tapped. This is the bridge between the questions panel (UI) and the RAG pipeline (backend). The UI agent will call this function from the chip click handler.

- [ ] **Step 1: Add `fireQuestionQuery()` function**

Add after the `hideAllAmbientUI` function:

```js
// Called by the UI agent when a question chip is tapped.
// Fires the QUERY message with the chip text as transcript.
function fireQuestionQuery(questionText) {
  if (!pendingQuestions) return;
  const blockContent = pendingQuestions.blockContent || '';
  hideAllAmbientUI();
  chrome.runtime.sendMessage({
    type: 'QUERY',
    transcript: questionText,
    selection: '',
    pageContext: blockContent,
  });
  console.log('[LennyLive] Question chip fired:', questionText);
}
```

The UI agent calls `fireQuestionQuery(chipText)` on chip click. No other wiring needed here.

- [ ] **Step 2: Update questions panel stub to log chip tap simulation**

Update `showQuestionsPanel`:
```js
function showQuestionsPanel(questions) {
  ambientState = 'questions-panel';
  console.log('[LennyLive] showQuestionsPanel stub — questions:', questions);
  // TODO (UI agent): render panel with chip buttons
  // Each chip onClick: fireQuestionQuery(chipText)
  // ✕ button onClick: hideAllAmbientUI()
}
```

- [ ] **Step 3: Verify end-to-end (manual DevTools test)**

**IMPORTANT — content script isolated world:** Content script variables (`pendingQuestions`, `fireQuestionQuery`) live in an isolated world separate from the page. They are NOT accessible from the default DevTools console. To run this test:

1. Open DevTools → Sources panel
2. In the top-right JavaScript context dropdown, select the content script context (it will be named something like `content-script.js` or the extension name)
3. In that context, run:

```js
pendingQuestions = { keyword: 'retention', questions: ['How do you measure retention?'], blockContent: '', timestamp: Date.now() };
fireQuestionQuery('How do you measure retention?');
```

Expected: Console (in content script context) shows:
```
[LennyLive] Question chip fired: How do you measure retention?
```
Then the normal RAG pipeline fires → postcard appears with a retention insight on the page.

- [ ] **Step 4: Commit**

```bash
git add content/content-script.js
git commit -m "feat: fireQuestionQuery() bridges question chips to RAG pipeline"
```

---

## Handoff Notes for UI Agent

The following functions are stubbed in `content/content-script.js` and must be implemented:

| Function | Contract |
|----------|----------|
| `showSelectionDot(rect)` | Render `#ll-selection-dot` at `{top: rect.top - 18, left: rect.right + 4}` fixed position. `mousedown` must call `event.preventDefault()` + `event.stopPropagation()`. On click: capture `window.getSelection().toString()`, call `chrome.runtime.sendMessage({ type: 'QUERY', transcript: '', selection: capturedText, pageContext: '' })`, then call `hideSelectionDot()`. Set `ambientState = 'selection-dot'`. |
| `hideSelectionDot()` | Hide `#ll-selection-dot`. Set `ambientState = 'none'` if was `'selection-dot'`. Already has logic stub — UI agent fills in DOM hide. |
| `showWritePauseDot(mode)` | Render write+pause dot bottom-right. `mode = 'ready'` (questions available) or `'loading'` (spinner). On click: if mode is ready, call `showQuestionsPanel(pendingQuestions.questions)`. Set `ambientState = 'write-pause-dot'`. |
| `hideWritePauseDot()` | Hide write+pause dot. Safe no-op if not visible. |
| `showQuestionsPanel(questions)` | Replace write+pause dot with panel showing 2-3 chip buttons. Each chip `onClick`: `fireQuestionQuery(chipText)`. ✕ button: `hideAllAmbientUI()`. Set `ambientState = 'questions-panel'`. |
| `updateWritePauseDotReady()` | Upgrade dot from loading spinner → ready state (questions available). Called when `QUESTIONS_READY` arrives after dot is already shown. |
| `hideAllAmbientUI()` | Already hides dots + clears timers + resets `pendingQuestions`. UI agent must also hide the questions panel DOM element. |

**Key constraints for UI agent:**
- All elements must be in the shadow DOM (`shadow.getElementById(...)`)
- Selection dot: `position: fixed` with JS-set `top`/`left` from `Range.getBoundingClientRect()`
- Write+pause dot: `position: fixed`, bottom-right, same visual as current glow dot
- Questions panel: replaces write+pause dot (don't show both at once)
- `mousedown` on selection dot must `preventDefault()` + `stopPropagation()` to preserve selection
