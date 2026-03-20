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
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
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
- `run_at: document_idle` — default, stated explicitly. Content script runs after DOM is ready.
- `all_frames: false` — inject into top-level frame only. Iframes (embedded Notion, Docs) are out of scope for V1.
- No `microphone` permission — Web Speech API requests mic at runtime via the browser prompt.
- No `side_panel` — sidebar UI is sub-project 4.
- No `web_accessible_resources` — ping sound is generated via Web Audio API, no file assets needed.

---

## Part 2: Activation Flow (content-script.js)

### State Machine
Four states, one direction:
```
idle → listening → processing → idle
```

Transitions:
- `idle` → `listening`: double-tap Ctrl (within 300ms window)
- `listening` → `processing`: post-speech silence (2s after speech ends) OR single tap Ctrl
- `listening` → `idle`: Esc key (cancel) OR `recognition.onerror`
- `processing` → `idle`: service worker responds (or 10s timeout)

### Double-tap + Single-tap Detection

`lastCtrlPress` is always updated regardless of state, keeping the timing window accurate:

```javascript
let lastCtrlPress = 0;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') {
    const now = Date.now();

    if (state === 'idle' && now - lastCtrlPress < 300) {
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

### Activation Sequence
1. Play ping tone via Web Audio API (see Part 7)
2. Inject listening indicator into Shadow DOM: pulsing dot + "Lenny is listening..."
3. Start `SpeechRecognition`
4. On speech result: update indicator to "Lenny is thinking...", send to service worker
5. On service worker response: remove indicator (postcard rendered by sub-project 4)

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
  cancelLennyLive(); // always return to idle on error
};
```

---

## Part 3: Buzzword Detection (content-script.js)

### Scanning
- `setInterval` every 30 seconds
- Reads `document.body.innerText` (capped at first 5000 chars for performance)
- Checks for any PM_BUZZWORDS match (case-insensitive)
- Debounce: same buzzword suppressed for 5 minutes per tab (`Map` keyed by buzzword)
- Does not run while state is `listening` or `processing`
- On match: write `{ lastTopic: matchedDisplayTopic }` to `chrome.storage.local`, then show chip

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

Dark pill, purple pulsing dot, white text. Transitions text to "Lenny is thinking..." when processing.

### Buzzword Chip (Glassy Strip)
Positioned fixed, bottom-center (20px from bottom). Slides up on appear (200ms ease-out), fades out after 10s if not clicked.

```
● Lenny on retention →
```

Translucent purple-tinted background, 1px purple border, pulsing dot. Clicking triggers `activateLennyLive()`.

**Both elements share the same Shadow DOM host.** They are separate `div`s within it, shown/hidden via CSS `display` property.

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
{ type: 'QUERY', transcript: 'string' }
{ type: 'BUZZWORD_TRIGGERED', topic: 'string' }
```

**Service worker → Content script:**
```javascript
{ type: 'RESPONSE', status: 'ok' | 'error', insight: object | null }
{ type: 'ACK' }
```

The `insight` object shape is defined in sub-project 2. Content script ignores `null` insight.

---

## Part 6: Popup

Minimal status display — no settings.

**popup.html shows:**
- Lenny Live logo/name
- Status: "Active on this tab" or "Ready"
- Last topic detected (reads `chrome.storage.local` key `lastTopic` — written by buzzword detector on each match)
- "Double-tap Ctrl to activate" reminder text

**popup.js** reads `chrome.storage.local` on open and renders. No writes.

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

1. **Double-tap Ctrl** on any HTTPS page → ping tone plays → "Lenny is listening..." indicator appears bottom-right
2. **Speak** → pause 2s → indicator changes to "Lenny is thinking..." → disappears
3. **Double-tap Ctrl** → speak → **single tap Ctrl** → stops immediately, processes
4. **Double-tap Ctrl** → say nothing → after 5s, indicator disappears silently (Timer A)
5. **Esc** during listening → cancels, returns to idle
6. **Open a page with "retention" or "GTM"** → buzzword chip appears bottom-center within 30s
7. **Click chip** → activates Lenny
8. **Ignore chip** → fades after 10s
9. **Open popup** → shows "Ready" and last detected topic
10. **Check `chrome.storage.local`** in DevTools → `lastTopic` key populated after buzzword detection

---

## Out of Scope
- RAG pipeline (sub-project 2)
- ElevenLabs voice (sub-project 3)
- Postcard / sidebar UI (sub-project 4)
- Gamification (V2)
- Selection review mode (V2)
- iframe injection (`all_frames: false` by design)
