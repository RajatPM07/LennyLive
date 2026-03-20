# Sub-Project 2: RAG Pipeline Design Spec

**Date:** 2026-03-21
**Author:** Rajat Sharma
**Status:** Approved

---

## Overview

Sub-project 2 wires the RAG (Retrieval-Augmented Generation) pipeline into the Chrome extension shell built in sub-project 1. When a user double-taps Ctrl and speaks a query, the extension retrieves the most semantically relevant Lenny Rachitsky podcast insight from Supabase pgvector and surfaces it in the UI.

**Goal:** Turn the stub `RESPONSE` (`insight: null`) in the service worker into a real semantic search result from Supabase, using Google AI embeddings.

---

## Architecture

### Push Model (not sendResponse)

MV3 service workers can be terminated by Chrome at any point during async work. The `sendResponse()` pattern (which relies on keeping the message port open via `return true`) is unreliable for async operations like network calls. Instead, this pipeline uses the **push model**:

1. `content-script.js` sends `QUERY` fire-and-forget (no callback, no `return true`)
2. `service-worker.js` receives `QUERY`, begins async RAG work
3. After RAG completes, service worker calls `chrome.tabs.sendMessage(sender.tab.id, response)` to push the result back
4. `content-script.js` has a `chrome.runtime.onMessage` listener that handles incoming `RESPONSE` messages

This is safe because Chrome will keep the service worker alive as long as async work is in progress (it only terminates idle service workers).

### Data Flow

```
content-script.js          service-worker.js            Google AI API       Supabase pgvector
       |                          |                            |                     |
       |-- QUERY (fire+forget) -->|                            |                     |
       |                          |-- POST /embedContent ----->|                     |
       |                          |<-- embedding[768] ---------|                     |
       |                          |-- RPC match_transcript_chunks ----------------->|
       |                          |<-- top 3 chunks (similarity ≥ 0.5) ------------|
       |                          |-- pick chunk[0], shape insight object           |
       |<-- RESPONSE (push) ------|                            |                     |
       |                          |                            |                     |
  handleResponse()               done                         done                  done
```

---

## File Structure

### New Files

**`background/config.js`** (gitignored — never committed)
- Exports API key constants as named exports
- Pattern mirrors `.env` but accessible to ES module service worker
- Must be created manually by the developer (instructions in task plan)

**`background/rag.js`**
- `embedQuery(text)` — named export; calls Google AI `gemini-embedding-001` REST API, returns `float[]` (768 dims)
- `searchChunks(embedding)` — named export; calls Supabase `match_transcript_chunks` RPC via REST, returns array of chunk objects
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `GOOGLE_AI_API_KEY` are imported at the top of `rag.js` from `./config.js` — they are module-level imports, not function parameters

### Modified Files

**`background/service-worker.js`**
- Changed from callback/stub to async push-model handler
- Imports `embedQuery`, `searchChunks` from `./rag.js` (named imports)
- Does NOT import API keys directly — they are consumed inside `rag.js`
- Removes dead `BUZZWORD_TRIGGERED` handler
- After RAG completes, calls `chrome.tabs.sendMessage(sender.tab.id, response)`
- **Permissions note:** No new `manifest.json` permissions are needed. `chrome.tabs.sendMessage` back to `sender.tab.id` is permitted under the existing `"activeTab"` permission because the content script is the message originator.

**`manifest.json`**
- Background service worker declaration gains `"type": "module"` to enable ES module imports
- Exact change (inside the `"background"` object):
  ```json
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  }
  ```

**`content/content-script.js`**
- `processQuery()`: remove callback from `sendMessage` call (fire-and-forget)
- Add `chrome.runtime.onMessage` listener for incoming `RESPONSE` messages
- `handleResponse(message)`: transitions state machine from loading → idle, updates UI

---

## API Integration Details

### Google AI Embedding (`background/rag.js` → `embedQuery`)

**Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GOOGLE_AI_API_KEY}`

**Method:** POST

**Request body:**
```json
{
  "model": "models/gemini-embedding-001",
  "content": { "parts": [{ "text": "<query>" }] },
  "outputDimensionality": 768
}
```

**Response path:** `response.embedding.values` → `float[]` (768 elements)

**Error handling:** Throws on non-2xx HTTP status with status code in message. Caller wraps in try/catch.

### Supabase pgvector Search (`background/rag.js` → `searchChunks`)

**Endpoint:** `{SUPABASE_URL}/rest/v1/rpc/match_transcript_chunks`

**Method:** POST

**Headers:**
```
apikey: {SUPABASE_ANON_KEY}
Authorization: Bearer {SUPABASE_ANON_KEY}
Content-Type: application/json
```

**Request body:**
```json
{
  "query_embedding": [/* float[] 768 dims */],
  "match_threshold": 0.5,
  "match_count": 3
}
```

**Response:** Array of chunk objects. Empty array = no results above threshold.

**Error handling:** Throws on non-2xx. Caller wraps in try/catch.

---

## Insight Object Shape

The top result from `searchChunks` (index `[0]`) is shaped into an insight object:

```javascript
{
  guest_name: string,        // e.g. "Brian Balfour"
  topic: string,             // e.g. "retention"
  insight: string,           // full insight text (~100-200 words)
  pull_quote: string,        // short memorable quote (~20 words)
  episode_title: string,     // podcast episode title
  youtube_url: string,       // YouTube link with timestamp
  timestamp_secs: number,    // seconds into episode
  similarity: number         // cosine similarity (0.5–1.0)
}
```

This object is sent as `message.insight` in the `RESPONSE` message.

---

## Message Protocol

### QUERY (content-script → service-worker)
```javascript
chrome.runtime.sendMessage({
  type: 'QUERY',
  transcript: string,     // transcript from Web Speech API (field name matches existing code)
  selection: string       // selected text captured at activation (may be empty string)
});
// No callback — fire and forget
```

> **Field name note:** The existing `content-script.js` already uses `transcript` and `selection` as field names (line 280). The service worker must read `message.transcript` and `message.selection`. Do NOT rename these fields.

### RESPONSE (service-worker → content-script, via push)
```javascript
chrome.tabs.sendMessage(tabId, {
  type: 'RESPONSE',
  status: 'ok' | 'error' | 'no_results',
  insight: InsightObject | null
});
```

**Status semantics:**
- `ok` — insight found, `message.insight` is populated
- `no_results` — RAG returned no chunks above threshold, `message.insight` is null
- `error` — network or API failure, `message.insight` is null

### Content-script onMessage handler
```javascript
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESPONSE') {
    handleResponse(message);
  }
});
```

---

## Content-Script Changes

### `processQuery(transcript)` — modified

Remove the callback from `sendMessage`. The function becomes fire-and-forget. The `processing` intermediate state is removed — transition directly from `listening` → `loading` when the query is sent. The existing `processingTimeout` variable (line 272 of content-script.js) is retained for the 10s safety timer.

```javascript
function processQuery(transcript) {
  // currentSelection is captured at activation time (already in existing code, do not change)
  state = 'loading';
  showIndicator('loading');
  console.log('[LennyLive] Sending query:', { transcript, selection: currentSelection });
  chrome.runtime.sendMessage({
    type: 'QUERY',
    transcript,            // existing field name — do not rename
    selection: currentSelection  // existing field name — do not rename
  });
  // No callback — RESPONSE arrives via onMessage listener

  // 10s safety timeout (reuses existing processingTimeout variable)
  processingTimeout = setTimeout(() => {
    if (state === 'loading') {
      state = 'idle';
      hideIndicator();
      console.log('[LennyLive] Service worker timeout (10s) — returning to idle');
    }
  }, 10000);
}
```

### `handleResponse(message)` — new function

Called by `onMessage` listener when `RESPONSE` arrives. Uses the existing `processingTimeout` variable (line 272 of content-script.js) — do not create a new variable:

```javascript
function handleResponse(message) {
  clearTimeout(processingTimeout);  // uses existing processingTimeout variable
  state = 'idle';
  hideIndicator();
  if (message.status === 'ok' && message.insight) {
    // Sub-project 3 will render the postcard/sidebar
    // For now: log the insight so it's verifiable in devtools
    console.log('[LennyLive] Insight received:', message.insight);
    chrome.storage.local.set({ lastTopic: message.insight.topic });
  } else if (message.status === 'no_results') {
    console.log('[LennyLive] No results found for query');
  } else {
    console.warn('[LennyLive] RAG error or null insight');
  }
}
```

---

## State Machine — Updated to 4 States

Sub-project 1 had a 5-state machine: `idle | listening | processing | loading`. Sub-project 2 removes `processing` — the query is now sent synchronously before waiting, so there is no intermediate state. The machine becomes **3 states: `idle | listening | loading`**.

**Required comment update in content-script.js:** The comment block near the top of the state machine section (currently reads `// States: idle | listening | processing | loading`) must be updated to:
```javascript
// States: idle | listening | loading
// Transitions: idle → listening → loading → idle
```

**Safety timer condition update:** The existing safety timer callback at line 308 checks `state === 'processing' || state === 'loading'`. Remove the `|| state === 'processing'` branch — it must become `if (state === 'loading')` only (the spec pseudocode in `processQuery` already shows this).

- **Enter loading:** `processQuery()` sets `state = 'loading'`, shows loading indicator
- **Exit loading (success):** `handleResponse()` called by onMessage, clears state and `processingTimeout`
- **Exit loading (timeout):** 10s `processingTimeout` fires, resets to idle

---

## config.js Format

The developer must create `background/config.js` manually (it is gitignored). Format:

```javascript
// background/config.js — NEVER COMMIT
export const GOOGLE_AI_API_KEY = 'your-key-here';
export const SUPABASE_URL = 'https://kjbeubcbhbjrnbnztwap.supabase.co';
export const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

Keys are sourced from `.env` in the project root.

**`.gitignore` entry:** `background/config.js` is not yet in `.gitignore`. The implementer must add the line `background/config.js` to `.gitignore` before committing any other files.

---

## Error Handling

| Scenario | Service Worker Behaviour | Content Script Behaviour |
|---|---|---|
| Google AI API non-2xx | Catches error, pushes `{ status: 'error', insight: null }` | `handleResponse` logs warning, resets to idle |
| Supabase RPC non-2xx | Catches error, pushes `{ status: 'error', insight: null }` | Same |
| No chunks above threshold | Pushes `{ status: 'no_results', insight: null }` | Logs no-results, resets to idle |
| `chrome.tabs.sendMessage` fails (tab closed) | Read `chrome.runtime.lastError` in callback to suppress console warning: `chrome.tabs.sendMessage(tabId, msg, () => { const _e = chrome.runtime.lastError; })` | 10s safety timeout resets to idle |
| `sender.tab.id` is undefined (non-tab context) | Log warning and return early — do not call `chrome.tabs.sendMessage` | 10s safety timeout resets to idle |
| 10s timeout fires before RESPONSE | N/A | Safety timer fires, resets to idle regardless |

---

## What Sub-Project 2 Does NOT Include

- Postcard / sidebar UI rendering (Sub-project 3)
- ElevenLabs voice integration (Sub-project 3)
- Gamification / saved insights (Sub-project 4)
- `BUZZWORD_TRIGGERED` message (dead code, removed)
- Context injection into ElevenLabs agent (Sub-project 3)

---

## Verification Criteria

A successful sub-project 2 implementation demonstrates:

1. Double-tap Ctrl → speak a PM query → Chrome DevTools console shows `[LennyLive] Insight received:` with a populated insight object
2. `chrome.storage.local` `lastTopic` key is updated — verify in Chrome DevTools → Application → Storage → Local Extension Storage (or popup "Last topic" field if sub-project 3 UI is available)
3. Querying a non-PM topic (e.g. "pizza recipe") returns `no_results` or a low-similarity result
4. Disconnecting internet mid-query results in `error` status, state resets to idle (no hang)
5. Supabase dashboard: navigate to **Logs → Postgres logs** and filter for `match_transcript_chunks` — each activation should produce a new RPC call entry

---

## Dependencies

- Sub-project 1 (extension shell) must be complete and loaded in Chrome
- 25 moments must be embedded in Supabase (completed — verified 2026-03-21)
- `match_transcript_chunks` RPC function must exist in Supabase (completed)
- Google AI API key with Gemini access must be in `background/config.js`
- Supabase anon key must be in `background/config.js`
