# RAG Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the real RAG pipeline into the extension so double-tap Ctrl → spoken query → semantic search → insight logged in DevTools.

**Architecture:** Push model — content script sends QUERY fire-and-forget; service worker embeds the query via Google AI, searches Supabase pgvector, then pushes RESPONSE back via `chrome.tabs.sendMessage`. Content script has an `onMessage` listener that calls `handleResponse()` to reset state and log/store the insight.

**Tech Stack:** Vanilla ES modules (service worker), vanilla non-module JS (content script), raw `fetch()` REST calls to Google AI and Supabase APIs, Chrome Extension Manifest V3.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `background/config.js` | **Create (gitignored)** | Exports API key constants — never committed |
| `background/rag.js` | **Create** | `embedQuery` (Google AI) + `searchChunks` (Supabase) |
| `background/service-worker.js` | **Rewrite** | Push-model QUERY handler, removes stub |
| `manifest.json` | **Edit** | Add `"type": "module"` to background declaration |
| `content/content-script.js` | **Edit** | Fire-and-forget `processQuery`, new `handleResponse`, new `onMessage` listener, state machine comment |
| `.gitignore` | **Edit** | Add `background/config.js` entry |

---

## Task 1: Bootstrap — gitignore + config.js + manifest module flag

**Files:**
- Modify: `.gitignore`
- Create: `background/config.js`
- Modify: `manifest.json`

This task has no tests (configuration only). Verification is via a Chrome extension reload.

- [ ] **Step 1: Add `background/config.js` to `.gitignore`**

Open `.gitignore` and add this line (add it near the `.env` entry for clarity):

```
background/config.js
```

- [ ] **Step 2: Create `background/config.js` with your real keys**

Copy values from `.env` in the project root. Do NOT commit this file.

```javascript
// background/config.js — NEVER COMMIT (gitignored)
export const GOOGLE_AI_API_KEY = 'AIza...';         // from .env: GOOGLE_AI_API_KEY
export const SUPABASE_URL = 'https://kjbeubcbhbjrnbnztwap.supabase.co'; // from .env: SUPABASE_URL
export const SUPABASE_ANON_KEY = 'eyJ...';          // from .env: SUPABASE_ANON_KEY
```

- [ ] **Step 3: Add `"type": "module"` to manifest.json background declaration**

Current `manifest.json` lines 13-15:
```json
"background": {
  "service_worker": "background/service-worker.js"
},
```

Replace with:
```json
"background": {
  "service_worker": "background/service-worker.js",
  "type": "module"
},
```

- [ ] **Step 4: Verify gitignore is working**

Run:
```bash
git status
```

Expected: `background/config.js` does NOT appear in untracked files. `manifest.json` shows as modified.

- [ ] **Step 5: Commit manifest change**

```bash
git add manifest.json .gitignore
git commit -m "feat: enable ES modules in service worker, gitignore config.js"
```

---

## Task 2: Create `background/rag.js` — embedQuery + searchChunks

**Files:**
- Create: `background/rag.js`

This is a pure ES module. No test runner is available — verification is done via a manual Node.js smoke test at the end of this task.

- [ ] **Step 1: Create `background/rag.js`**

```javascript
// background/rag.js
// RAG pipeline: embed query via Google AI, search Supabase pgvector.
// Imported by service-worker.js. Uses ES module syntax.

import { GOOGLE_AI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

/**
 * Embed a text query using Google AI gemini-embedding-001.
 * Returns float[] (768 dimensions).
 * Throws on non-2xx HTTP response.
 */
export async function embedQuery(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GOOGLE_AI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google AI embedContent failed: ${res.status}`);
  }
  const data = await res.json();
  return data.embedding.values; // float[] (768 elements)
}

/**
 * Search Supabase pgvector for the top 3 transcript chunks
 * most similar to the given embedding.
 * Returns array of chunk objects (may be empty if no results above threshold).
 * Throws on non-2xx HTTP response.
 */
export async function searchChunks(embedding) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/match_transcript_chunks`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 3,
    }),
  });
  if (!res.ok) {
    throw new Error(`Supabase match_transcript_chunks failed: ${res.status}`);
  }
  return res.json(); // array of chunk objects, may be empty
}
```

- [ ] **Step 2: Smoke-test embedQuery via Node.js**

`background/rag.js` uses ES module syntax and `fetch()` (Node 18+ built-in). Run from the project root:

```bash
node --input-type=module <<'EOF'
import { embedQuery } from './background/rag.js';
const vec = await embedQuery('how do I improve retention?');
console.log('embedding length:', vec.length);           // expected: 768
console.log('first 3 values:', vec.slice(0, 3));       // expected: small floats
EOF
```

Expected output:
```
embedding length: 768
first 3 values: [ <float>, <float>, <float> ]
```

If you see `Google AI embedContent failed: 400` — double-check GOOGLE_AI_API_KEY in `background/config.js`.

- [ ] **Step 3: Smoke-test searchChunks via Node.js**

```bash
node --input-type=module <<'EOF'
import { embedQuery, searchChunks } from './background/rag.js';
const vec = await embedQuery('how do I improve retention?');
const chunks = await searchChunks(vec);
console.log('chunks returned:', chunks.length);              // expected: 1-3
if (chunks.length > 0) {
  console.log('top chunk topic:', chunks[0].topic);
  console.log('top chunk similarity:', chunks[0].similarity);
  console.log('top chunk guest:', chunks[0].guest_name);
}
EOF
```

Expected output:
```
chunks returned: 1        (or 2-3, anything > 0 for a PM query)
top chunk topic: retention
top chunk similarity: 0.5x  (some value > 0.5)
top chunk guest: <guest name>
```

If `chunks returned: 0` — the query didn't match. Try a more specific PM phrase like `"user churn and retention metrics"`.

- [ ] **Step 4: Commit**

```bash
git add background/rag.js
git commit -m "feat: add RAG pipeline — embedQuery + searchChunks"
```

---

## Task 3: Rewrite `background/service-worker.js` — push model

**Files:**
- Modify: `background/service-worker.js`

Replace the entire stub with the real push-model handler.

- [ ] **Step 1: Read the current stub first**

Open `background/service-worker.js`. It currently has a synchronous `onMessage` listener with `sendResponse({ insight: null })`. You are replacing the entire file.

- [ ] **Step 2: Rewrite `background/service-worker.js`**

```javascript
// background/service-worker.js
// MV3 service worker — push model RAG pipeline.
// Receives QUERY from content script, runs embed + search,
// then pushes RESPONSE back via chrome.tabs.sendMessage.
// "Push model" avoids the unreliable sendResponse-with-return-true pattern
// for async work in MV3 service workers.

import { embedQuery, searchChunks } from './rag.js';

chrome.runtime.onMessage.addListener((message, sender) => {
  console.log('[LennyLive] Message received:', message.type, message);

  if (message.type === 'QUERY') {
    // Validate sender — must come from a tab (not popup/devtools)
    if (!sender.tab?.id) {
      console.warn('[LennyLive] QUERY received from non-tab context — ignoring');
      return; // no return true — not keeping port open
    }

    const tabId = sender.tab.id;

    // Run RAG pipeline async — service worker stays alive during awaited fetch calls
    handleQuery(message, tabId);

    // Do NOT return true — we are NOT using sendResponse.
    // The response goes back via chrome.tabs.sendMessage after async work.
  }

  // BUZZWORD_TRIGGERED handler removed — content-script does not send this message.
  // Dead code from sub-project 1 stub — intentionally absent here.
});

async function handleQuery(message, tabId) {
  const { transcript, selection } = message;
  const queryText = selection ? `${transcript}\n\nContext: ${selection}` : transcript;

  try {
    console.log('[LennyLive] Embedding query:', queryText.slice(0, 100));
    const embedding = await embedQuery(queryText);

    console.log('[LennyLive] Searching Supabase pgvector...');
    const chunks = await searchChunks(embedding);

    if (!chunks || chunks.length === 0) {
      console.log('[LennyLive] No results above threshold for query:', transcript);
      pushResponse(tabId, { type: 'RESPONSE', status: 'no_results', insight: null });
      return;
    }

    // Shape the top result into the insight object
    const top = chunks[0];
    const insight = {
      guest_name:     top.guest_name,
      topic:          top.topic,
      insight:        top.insight,
      pull_quote:     top.pull_quote,
      episode_title:  top.episode_title,
      youtube_url:    top.youtube_url,
      timestamp_secs: top.timestamp_secs,
      similarity:     top.similarity,
    };

    console.log('[LennyLive] Insight found:', insight.guest_name, '|', insight.topic, '| similarity:', insight.similarity);
    pushResponse(tabId, { type: 'RESPONSE', status: 'ok', insight });

  } catch (err) {
    console.error('[LennyLive] RAG pipeline error:', err.message);
    pushResponse(tabId, { type: 'RESPONSE', status: 'error', insight: null });
  }
}

function pushResponse(tabId, response) {
  chrome.tabs.sendMessage(tabId, response, () => {
    // Consume lastError to suppress "Unchecked runtime.lastError" console warning
    // This fires if the tab was closed before we could push the response.
    const _e = chrome.runtime.lastError;
  });
}
```

- [ ] **Step 3: Verify the file saved correctly**

Run a syntax check (Node's `--check` flag dry-runs the module without executing it):
```bash
node --check background/service-worker.js
```
Expected: no output (exits 0). Any output indicates a syntax error.

Then open `background/service-worker.js` in your editor and confirm:
- No `sendResponse` calls
- No `return true`
- `chrome.tabs.sendMessage` is used in `pushResponse`
- `BUZZWORD_TRIGGERED` handler is absent

- [ ] **Step 4: Commit**

```bash
git add background/service-worker.js
git commit -m "feat: rewrite service worker with push-model RAG pipeline"
```

---

## Task 4: Update `content/content-script.js` — fire-and-forget + handleResponse + onMessage

**Files:**
- Modify: `content/content-script.js`

Three targeted edits. Read the file before editing — do not rewrite the whole file.

### Edit A: Fix state machine comment (line 193)

- [ ] **Step 1: Update state machine comment**

Current lines 192-195:
```javascript
// ─── State Machine ────────────────────────────────────────────────────────────
// States: idle | listening | processing | loading
/ One-directional: idle → listening → processing → loading → idle
// Errors / Esc always return to idle.
```

Replace with:
```javascript
// ─── State Machine ────────────────────────────────────────────────────────────
// States: idle | listening | loading
// Transitions: idle → listening → loading → idle
// Errors / Esc / timeout always return to idle.
```

Note: `processing` state is removed — `processQuery` now transitions directly to `loading`.

### Edit B: Replace `processQuery` function (lines 274-313)

- [ ] **Step 2: Replace `processQuery` with fire-and-forget version**

Current `processQuery` (lines 274-313) uses a callback and has the old `processing` state transitions. Replace the entire function body including its safety timeout with:

```javascript
function processQuery(transcript) {
  // currentSelection was captured at activation time — do not re-read here
  state = 'loading';
  showIndicator('loading');
  console.log('[LennyLive] Sending query:', { transcript, selection: currentSelection });

  // Fire-and-forget — no callback. RESPONSE arrives via chrome.runtime.onMessage listener below.
  chrome.runtime.sendMessage({
    type: 'QUERY',
    transcript,            // field name matches service-worker expectation — do not rename
    selection: currentSelection, // field name matches service-worker expectation — do not rename
  });

  // Safety timeout: if RESPONSE never arrives (e.g. service worker crashed),
  // return to idle after 10s so the user is never stuck.
  processingTimeout = setTimeout(() => {
    if (state === 'loading') {
      state = 'idle';
      hideIndicator();
      console.log('[LennyLive] Service worker timeout (10s) — returning to idle');
    }
  }, 10000);
}
```

The entire old function (including the old safety timeout at lines 306-312 that checked `processing || loading`) is replaced by the above. The new timeout only checks `loading`.

### Edit C: Add `handleResponse` + `onMessage` listener

- [ ] **Step 3: Add `handleResponse` and `onMessage` listener after `processQuery`**

Directly after the closing `}` of `processQuery`, add:

```javascript
function handleResponse(message) {
  // Cancel the safety timeout — real response arrived
  clearTimeout(processingTimeout);
  state = 'idle';
  hideIndicator();

  if (message.status === 'ok' && message.insight) {
    // Sub-project 3 will render the sidebar postcard here.
    // For now: log so it's verifiable in DevTools console.
    console.log('[LennyLive] Insight received:', message.insight);
    chrome.storage.local.set({ lastTopic: message.insight.topic });
  } else if (message.status === 'no_results') {
    console.log('[LennyLive] No results found for query');
  } else {
    console.warn('[LennyLive] RAG error or null insight:', message.status);
  }
}

// Listen for RESPONSE pushed back from service-worker via chrome.tabs.sendMessage
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESPONSE') {
    handleResponse(message);
  }
  // Return nothing (no return true) — we never send a response back to the SW
});
```

- [ ] **Step 4: Verify the edits look correct**

Open `content/content-script.js` and confirm:
1. State machine comment says `idle | listening | loading` (no `processing`)
2. `processQuery` has no callback — just `chrome.runtime.sendMessage({...})` then the safety timeout
3. `handleResponse` exists and uses `processingTimeout` (not a new variable)
4. `chrome.runtime.onMessage.addListener` exists and calls `handleResponse`
5. No orphaned `}` or `)` from the old callback code

- [ ] **Step 5: Commit**

```bash
git add content/content-script.js
git commit -m "feat: content script — fire-and-forget query, handleResponse, onMessage listener"
```

---

## Task 5: End-to-End Verification in Chrome

This task is manual — requires Chrome with the extension loaded. Do not mark complete until all 5 criteria pass.

**Setup:**
1. Open Chrome → `chrome://extensions/`
2. Enable Developer Mode (top right)
3. Click "Load unpacked" → select the `LennyLive/` directory
4. Navigate to any Notion, Linear, Jira, or Google Docs page

### Criterion 1: PM query returns an insight

- [ ] **Step 1: Open DevTools console on the PM tool page**

Press F12 → Console tab. Filter by `[LennyLive]`.

- [ ] **Step 2: Double-tap Ctrl → speak a PM query**

Try: "How do I improve user retention?" or "What is product market fit?"

Wait up to 10s for the safety timeout.

Expected console output (in order):
```
[LennyLive] Transcript: how do I improve user retention?
[LennyLive] Sending query: {transcript: "...", selection: ""}
```
Then in the service worker console (open via chrome://extensions → service worker "Inspect"):
```
[LennyLive] Message received: QUERY {...}
[LennyLive] Embedding query: how do I improve user retention?
[LennyLive] Searching Supabase pgvector...
[LennyLive] Insight found: <guest_name> | retention | similarity: 0.5x
```
Then back in the page console:
```
[LennyLive] Insight received: {guest_name: "...", topic: "retention", ...}
```

If you see `Insight received` with a populated object — criterion 1 passes.

### Criterion 2: lastTopic stored in chrome.storage.local

- [ ] **Step 3: Check chrome.storage.local via DevTools**

In DevTools → Application tab → Storage → Extension Local Storage (find LennyLive).

Expected: `lastTopic` key with value matching the topic of the insight (e.g. `"retention"`).

Alternatively, click the extension icon — the popup should show "Last topic: retention" (sub-project 1 popup reads this key).

### Criterion 3: Non-PM query returns no_results

- [ ] **Step 4: Double-tap Ctrl → speak a non-PM query**

Try: "What is the recipe for pizza?"

Expected console:
```
[LennyLive] No results found for query
```
(No insight object logged.)

### Criterion 4: Offline error handling

- [ ] **Step 5: Disable network → double-tap Ctrl → speak query**

Turn off Wi-Fi or use Chrome DevTools → Network tab → set to "Offline".

Expected: service worker console shows `[LennyLive] RAG pipeline error: ...`. Page console shows state returns to idle within 10s (either via error push or safety timeout). Extension indicator disappears.

Re-enable network when done.

### Criterion 5: Supabase RPC calls logged

- [ ] **Step 6: Check Supabase Postgres logs**

Open Supabase dashboard → Logs → Postgres logs. Filter for `match_transcript_chunks`.

Each successful PM query activation should produce one new log entry.

- [ ] **Step 7: Commit final verification note**

```bash
git commit --allow-empty -m "chore: sub-project 2 RAG pipeline verified end-to-end"
```

---

## Troubleshooting Reference

| Symptom | Likely cause | Fix |
|---|---|---|
| Service worker won't load | Missing `"type": "module"` in manifest | Check Task 1 Step 3 |
| `Cannot find module './config.js'` | `background/config.js` not created | Run Task 1 Step 2 |
| `Google AI embedContent failed: 400` | Wrong API key or model name | Re-check GOOGLE_AI_API_KEY in config.js |
| `Supabase match_transcript_chunks failed: 401` | Wrong anon key | Re-check SUPABASE_ANON_KEY in config.js |
| `chunks returned: 0` for PM query | Embeddings not in Supabase | Verify with `node scripts/embed.js --dry-run` |
| State stuck in `loading` | RESPONSE never arrived; safety timeout fires after 10s | Check service worker console for errors |
| `Unchecked runtime.lastError` in SW console | Missing lastError consume in `pushResponse` | Check Task 3 Step 2 — `pushResponse` must read `chrome.runtime.lastError` |
| Duplicate `onMessage` listener warning | Extension reloaded without page refresh | Refresh the tab after reloading extension |
