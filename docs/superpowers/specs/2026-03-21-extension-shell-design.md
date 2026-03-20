# Extension Shell + Activation Design
> Date: 2026-03-21 | Project: Lenny Live | Sub-project: 1 of 4

---

## Overview

Build the Chrome extension shell with three activation modes: double-tap Ctrl (active), PM buzzword detection (passive), and the message-passing infrastructure that all subsequent sub-projects plug into.

**Scope:** No RAG, no ElevenLabs, no postcard UI. The service worker is a shell that receives messages and echoes back. Sub-projects 2–4 replace the echo with real behaviour.

**Tech:** Manifest V3, vanilla JS, Shadow DOM for UI injection, Web Speech API, Web Audio API.

---

## File Structure

```
LennyLive/
├── manifest.json
├── assets/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── content/
│   └── content-script.js         # Detection + Shadow DOM UI injection
├── background/
│   └── service-worker.js         # Message hub shell
└── popup/
    ├── popup.html
    ├── popup.js
    └── popup.css
```

> No `assets/sounds/` directory — ping is generated via Web Audio API (no file needed).

---

## Part 1: manifest.json

```json
{
  "manifest_version": 3,
  "name": "Lenny Live",
  "version": "0.1.0",
  "description": "Your ambient PM mentor — Lenny Rachitsky's voice in your workflow",
  "permissions": ["activeTab", "storage", "scripting"],
  "host_permissions": [
    "*://*.google.com/document/*",
    "*://*.notion.so/*",
    "*://*.atlassian.net/*",
    "*://*.linear.app/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.google.com/document/*",
        "*://*.notion.so/*",
        "*://*.atlassian.net/*",
        "*://*.linear.app/*"
      ],
      "js": ["content/content-script.js"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  }
}
```

**Notes:**
- `host_permissions` narrowed to the 4 PM tools PMs actually use: Google Docs, Notion, Jira, Linear. Keeps the permission footprint minimal and honest.
- `run_at: document_idle` — content script runs after DOM is ready.
- `all_frames: false` — inject into top-level frame only. Iframes (embedded Notion, Docs) are out of scope for V1.
- No `microphone` permission — Web Speech API requests mic at runtime via the browser prompt.
- No `side_panel` — sidebar UI is sub-project 4.
- No `web_accessible_resources` — ping sound is generated via Web Audio API, no file assets needed.

> **V1.5:** Popup settings page lets the user add custom URL patterns. Stored in `chrome.storage.local` and injected dynamically via `chrome.scripting.registerContentScripts`. Not in V1.

---

## Part 2: Activation Flow (content-script.js)

### State Machine
Five states, one direction:
```
idle → listening → processing → loading → idle
```

Transitions:
- `idle` → `listening`: double-tap Ctrl (within 300ms window)
- `listening` → `processing`: post-speech silence (2s after speech ends) OR single tap Ctrl
- `listening` → `idle`: Esc key (cancel) OR `recognition.onerror` OR mic denied
- `processing` → `loading`: service worker acknowledged query (stub: immediate)
- `loading` → `idle`: service worker responds with insight (or 10s timeout)

> The `loading` state exists to show a skeleton shimmer between "Lenny is thinking..." and the postcard appearing (sub-project 4). In sub-project 1, the stub response moves through loading instantly — but the state is wired now so sub-project 4 can hook in cleanly.

### Double-tap + Single-tap Detection

`lastCtrlPress` is always updated regardless of state, keeping the timing window accurate. Selection is captured at double-tap time:

```javascript
let lastCtrlPress = 0;
let currentSelection = '';

document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') {
    const now = Date.now();

    if (state === 'idle' && now - lastCtrlPress < 300) {
      currentSelection = window.getSelection().toString().trim().slice(0, 500);
      activateLennyLive();
    } else if (state === 'listening') {
      stopListening(); // single tap stops capture immediately
    }

    lastCtrlPress = now; // always update, regardless of state
  }

  if (e.key === 'Escape' && state === 'listening') {
    cancelLennyLive();
  }
});
```

**No conflict:** The double-tap check only triggers when `state === 'idle'`. Any Ctrl press during `listening` hits the `else if` branch and stops listening — the double-tap path is unreachable from `listening`.

**Selection capture:** `currentSelection` is populated at activation time (not at query send time) so it reflects what the user had highlighted when they invoked Lenny. Passed along in the `QUERY` message if non-empty.

### Activation Sequence
1. Play ping tone via Web Audio API (see Part 7)
2. Inject listening indicator into Shadow DOM: pulsing dot + "Lenny is listening..."
3. Start `SpeechRecognition`
4. On speech result: update indicator to "Lenny is thinking...", send to service worker
5. On service worker acknowledgement: transition to `loading` — indicator shows skeleton shimmer
6. On service worker response: remove indicator (postcard rendered by sub-project 4)

### State Transitions in Code

`processQuery` handles the `listening → processing → loading → idle` path:

```javascript
function processQuery(transcript) {
  state = 'processing';
  updateIndicator('thinking'); // "Lenny is thinking..."

  chrome.runtime.sendMessage(
    { type: 'QUERY', transcript, selection: currentSelection },
    (response) => {
      if (!response) {
        // Service worker terminated before responding
        console.log('[LennyLive] No response from service worker — returning to idle');
        cancelLennyLive();
        return;
      }
      state = 'loading';
      updateIndicator('loading'); // skeleton shimmer

      // Sub-project 4 renders postcard here; for now, return to idle after 500ms
      setTimeout(() => {
        state = 'idle';
        hideIndicator();
      }, 500);
    }
  );

  // Safety timeout: if service worker never responds, return to idle after 10s
  setTimeout(() => {
    if (state === 'loading' || state === 'processing') {
      console.log('[LennyLive] Service worker timeout — returning to idle');
      cancelLennyLive();
    }
  }, 10000);
}

function cancelLennyLive() {
  state = 'idle';
  clearTimeout(timerA);
  clearTimeout(timerB);
  if (recognition) recognition.abort();
  hideIndicator();
}
```

> **Esc during processing/loading:** Esc is only wired to `listening` state. Once the query is sent (`processing` or `loading`), there is no cancellation — the request is in flight. This is intentional for V1. Sub-project 4 may add a dismiss button on the postcard.

### Speech Recognition Config
```javascript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// All recognition setup and usage must be inside this guard
if (!SpeechRecognition) {
  console.warn('[LennyLive] SpeechRecognition not supported — activation disabled');
  // Do not instantiate recognition or wire up any recognition handlers
} else {
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.interimResults = false;
recognition.lang = 'en-US';
recognition.maxAlternatives = 1;
```

### Mic Denied — Error Handling

If the user denies mic access, `recognition.onerror` fires with `e.error === 'not-allowed'`. Show a tooltip inside Shadow DOM:

```javascript
recognition.onerror = (e) => {
  clearTimeout(timerA);
  clearTimeout(timerB);
  console.log('[LennyLive] Speech error:', e.error);
  if (e.error === 'not-allowed') {
    showMicDeniedTooltip(); // renders inside Shadow DOM, auto-dismisses after 4s
  }
  cancelLennyLive(); // always return to idle on error
};
```

**Tooltip:** Small dark pill in Shadow DOM, positioned below the listening indicator. Text: "Mic access needed — click the lock icon in your address bar." Auto-removes after 4 seconds.

### Silence Detection — Two Distinct Timers

**Timer A — no-speech timeout (5s):** Starts when `recognition.start()` is called. If `onspeechstart` has not fired within 5 seconds, the user said nothing — call `cancelLennyLive()`.

**Timer B — post-speech silence (2s):** Starts on `recognition.onspeechend`. If no `onresult` fires within 2 seconds, the user finished speaking — call `stopListening()`.

Both timers are cleared on `recognition.onresult`.

```javascript
let timerA, timerB;

recognition.onstart = () => {
  timerA = setTimeout(() => cancelLennyLive(), 5000);
};

recognition.onspeechstart = () => {
  clearTimeout(timerA); // user is speaking — cancel no-speech timeout
};

recognition.onspeechend = () => {
  timerB = setTimeout(() => stopListening(), 2000);
};

recognition.onresult = (e) => {
  clearTimeout(timerA);
  clearTimeout(timerB);
  const transcript = e.results[0][0].transcript;
  processQuery(transcript);
};

recognition.onerror = (e) => {
  clearTimeout(timerA);
  clearTimeout(timerB);
  console.log('[LennyLive] Speech error:', e.error);
  if (e.error === 'not-allowed') {
    showMicDeniedTooltip();
  }
  cancelLennyLive(); // always return to idle on error
};

recognition.onend = () => {
  // Fires when recognition session ends for any reason (including natural termination
  // after silence, or browser stopping recognition). If state is still 'listening',
  // the session ended without an onresult — return to idle.
  if (state === 'listening') {
    console.log('[LennyLive] Recognition ended without result — returning to idle');
    cancelLennyLive();
  }
};
```

---

## Part 3: Buzzword Detection (content-script.js)

### Scanning — MutationObserver (not setInterval)

Use `MutationObserver` instead of polling. Fires on DOM mutations (user typing, page content loading), debounced 2s to avoid thrashing:

```javascript
let buzzwordDebounceTimer = null;

const observer = new MutationObserver(() => {
  clearTimeout(buzzwordDebounceTimer);
  buzzwordDebounceTimer = setTimeout(scanForBuzzwords, 2000);
});

observer.observe(document.body, { childList: true, subtree: true, characterData: true });
```

**Why MutationObserver:** PMs are actively writing — Docs, Notion, Jira. DOM mutations happen exactly when they're typing PM concepts, making the trigger more accurate than a 30s polling interval.

**Does not run while state is `listening` or `processing` or `loading`** — `scanForBuzzwords` checks state before executing.

### scanForBuzzwords

```javascript
function scanForBuzzwords() {
  if (state !== 'idle') return;

  const text = document.body.innerText.slice(0, 5000);
  const now = Date.now();

  for (const buzzword of PM_BUZZWORDS) {
    const regex = new RegExp(`\\b${buzzword}\\b`, 'i');
    if (!regex.test(text)) continue;

    const displayTopic = getDisplayTopic(buzzword);

    // General cooldown: any chip shown in last 3 min → skip
    if (now - lastChipShownAt < 3 * 60 * 1000) continue;

    // Per-topic cooldown: same topic shown in last 30 min → skip
    if (topicCooldowns.get(displayTopic) && now - topicCooldowns.get(displayTopic) < 30 * 60 * 1000) continue;

    lastChipShownAt = now;
    topicCooldowns.set(displayTopic, now);
    chrome.storage.local.set({ lastTopic: displayTopic });
    showBuzzwordChip(displayTopic);
    break; // show one chip at a time
  }
}
```

**Debounce strategy:**
- `lastChipShownAt`: prevents any chip appearing more than once every 3 minutes, regardless of buzzword. Stops chip spam if the user is typing many PM terms at once.
- `topicCooldowns` (Map): per-topic, 30 minutes. Same topic won't re-trigger for half an hour. Covers the case where a PM is deep in a retention doc and every mutation would match "retention".

### PM Buzzwords List (inlined — no separate module in MV3 content scripts)

```javascript
const PM_BUZZWORDS = [
  'retention', 'churn', 'DAU', 'MAU', 'WAU', 'activation',
  'conversion', 'funnel', 'cohort', 'ARR', 'MRR', 'ARPU',
  'LTV', 'CAC', 'NPS', 'CSAT', 'north star', 'KPI', 'OKR',
  'PMF', 'product market fit', 'GTM', 'go-to-market', 'roadmap',
  'prioritization', 'prioritisation', 'discovery', 'strategy',
  'positioning', 'competitive', 'moat', 'differentiation',
  'growth loop', 'viral', 'acquisition', 'referral', 'PLG',
  'product-led', 'MVP', 'launch', 'zero to one', '0 to 1',
  'early stage', 'pre-PMF', 'founding', 'user research',
  'jobs to be done', 'JTBD', 'A/B test', 'experiment',
  'stakeholder', 'cross-functional'
];
```

### Topic Mapping

Maps detected buzzwords to the 3 RAG topic strings for chip display. Any buzzword not in the map uses a capitalised version of the buzzword itself as fallback.

```javascript
const TOPIC_MAP = {
  'retention': 'Retention', 'churn': 'Retention', 'DAU': 'Retention',
  'MAU': 'Retention', 'WAU': 'Retention', 'activation': 'Retention',
  'GTM': 'GTM Strategy', 'go-to-market': 'GTM Strategy',
  'acquisition': 'GTM Strategy', 'growth loop': 'GTM Strategy',
  'PLG': 'GTM Strategy', 'product-led': 'GTM Strategy',
  'PMF': 'Product-Market Fit', 'product market fit': 'Product-Market Fit',
  'pre-PMF': 'Product-Market Fit', 'zero to one': 'Product-Market Fit',
  '0 to 1': 'Product-Market Fit',
};
// Fallback: capitalize the matched buzzword
function getDisplayTopic(buzzword) {
  return TOPIC_MAP[buzzword] ?? (buzzword.charAt(0).toUpperCase() + buzzword.slice(1));
}
```

---

## Part 4: Shadow DOM UI

All extension UI is injected into a Shadow DOM host appended to `document.body`. This isolates extension styles from the page completely.

```javascript
const host = document.createElement('div');
host.id = 'lenny-live-root';
const shadow = host.attachShadow({ mode: 'open' }); // open for easier debugging
document.body.appendChild(host);
```

> **Shadow DOM mode:** `open` is used during development — it allows Chrome DevTools to inspect the shadow root, which is valuable when building the extension. `closed` can be considered for a production release if stricter isolation is needed, but offers no meaningful security benefit for a Chrome extension.

### Listening Indicator
Positioned fixed, bottom-right (32px from edges). Shown during `listening` and `processing` states.

```
╭──────────────────────────────╮
│  ● Lenny is listening...     │
╰──────────────────────────────╯
```

Dark pill, purple pulsing dot, white text. Transitions:
- `listening` → "Lenny is listening..."
- `processing` → "Lenny is thinking..."
- `loading` → skeleton shimmer (animated grey bar, same pill dimensions)

### Mic Denied Tooltip
Small dark pill rendered below the listening indicator. Auto-removes after 4 seconds.
```
╭──────────────────────────────────────────────────╮
│  Mic access needed — click the lock icon above.  │
╰──────────────────────────────────────────────────╯
```

### Buzzword Chip (Glassy Strip)
Positioned fixed, bottom-center (20px from bottom). Slides up on appear (200ms ease-out), fades out after 10s if not clicked.

```
● Lenny on retention →
```

Translucent purple-tinted background, 1px purple border, pulsing dot. Clicking triggers `activateLennyLive()`.

**All elements share the same Shadow DOM host.** They are separate `div`s within it, shown/hidden via CSS `display` property.

---

## Part 5: Service Worker Shell (service-worker.js)

Receives messages, logs them, echoes back a stub response. Fully replaced in sub-project 2.

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[LennyLive] Message received:', message.type);

  if (message.type === 'QUERY') {
    sendResponse({ type: 'RESPONSE', status: 'ok', insight: null });
  }

  if (message.type === 'BUZZWORD_TRIGGERED') {
    sendResponse({ type: 'ACK' });
  }

  return true; // required to keep message channel open
});
```

> **MV3 service worker lifetime constraint:** In Manifest V3, service workers can be terminated by Chrome at any time. `return true` keeps the message port open for an async `sendResponse`, but if the service worker is terminated before responding, the content script's callback fires with `undefined`. The shell implementation above responds synchronously (no async work), so this is not an issue for sub-project 1. **Sub-project 2 must call `sendResponse` synchronously** — or switch to a push model where the service worker calls `chrome.tabs.sendMessage` back to the tab instead of using `sendResponse`. Sub-project 2 should choose one pattern and document it.

### Message Contract (shared across all sub-projects)

**Content script → Service worker:**
```javascript
{ type: 'QUERY', transcript: 'string', selection: 'string | ""' }
{ type: 'BUZZWORD_TRIGGERED', topic: 'string' }
```

**Service worker → Content script:**
```javascript
// In response to QUERY:
{ type: 'RESPONSE', status: 'ok' | 'error', insight: object | null }
// In response to BUZZWORD_TRIGGERED:
{ type: 'ACK' }
```

The `insight` object shape is defined in sub-project 2. Content script ignores `null` insight (stub state = always null).

> **V1.5 — REVIEW message:** When the user double-taps Ctrl with text selected but says nothing (Timer A fires), instead of cancelling, the content script sends `{ type: 'REVIEW', selection: 'string' }` for document review mode (1 strength + 1 improvement + 1 question). Sub-project 2 routes REVIEW to a different prompt template. Not wired in V1.

---

## Part 6: Popup

Minimal status display — no settings.

**popup.html shows:**
- Lenny Live logo/name
- Status: "Active on this tab" or "Ready"
- Last topic detected (reads `chrome.storage.local` key `lastTopic` — written by buzzword detector on each match)
- "Double-tap Ctrl to activate" reminder text

**popup.js** reads `chrome.storage.local` on open and renders. No writes.

> **V1.5:** Popup gains a settings section — a text input for adding custom URL patterns (e.g. `*://*.miro.com/*`). Stored in `chrome.storage.local` as `customUrls[]`. Injected dynamically via `chrome.scripting.registerContentScripts`. Not in V1.

---

## Part 7: Ping Tone (Web Audio API)

No audio file needed — generated programmatically. Double-tap Ctrl is a keyboard event and qualifies as a user gesture, satisfying the browser's autoplay policy.

```javascript
function playPing() {
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume(); // handle suspended AudioContext
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (err) {
    console.log('[LennyLive] Ping audio failed (autoplay blocked):', err.message);
    // fail silently — activation continues without sound
  }
}
```

---

## Verification

Load the extension in Chrome (`chrome://extensions` → Load unpacked → select `LennyLive/`):

1. **Double-tap Ctrl** on a Google Doc → ping tone plays → "Lenny is listening..." indicator appears bottom-right
2. **Speak** → pause 2s → indicator changes to "Lenny is thinking..." → skeleton shimmer → disappears
3. **Double-tap Ctrl** → speak → **single tap Ctrl** → stops immediately, processes
4. **Double-tap Ctrl** → say nothing → after 5s, indicator disappears silently (Timer A)
5. **Esc** during listening → cancels, returns to idle
6. **Deny mic permission** → tooltip "Mic access needed..." appears, auto-dismisses after 4s, state returns to idle
7. **Highlight text** on a Google Doc → double-tap Ctrl → speak a question → `selection` is non-empty in service worker log
8. **Open a Google Doc with "retention" or "GTM"** → type more text (trigger MutationObserver) → buzzword chip appears within 2s debounce window
9. **Click chip** → activates Lenny
10. **Ignore chip** → fades after 10s
11. **Trigger same topic chip twice within 30 min** → second trigger suppressed (per-topic cooldown)
12. **Trigger any chip twice within 3 min** → second trigger suppressed (general cooldown)
13. **Open popup** → shows "Ready" and last detected topic
14. **Check `chrome.storage.local`** in DevTools → `lastTopic` key populated after buzzword detection
15. **Try on a non-whitelisted site** (e.g. twitter.com) → content script does not load, no Lenny UI

---

## Out of Scope — V1

- RAG pipeline (sub-project 2)
- ElevenLabs voice (sub-project 3)
- Postcard / sidebar UI (sub-project 4)
- Gamification (V1.5)
- Selection review right-click menu (V1.5)
- Custom URL settings in popup (V1.5)
- iframe injection (`all_frames: false` by design)
