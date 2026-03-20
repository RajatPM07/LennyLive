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
│   ├── icons/
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   └── sounds/
│       └── ping.mp3              # ~0.5s activation chime
├── content/
│   └── content-script.js         # Detection + Shadow DOM UI injection
├── background/
│   └── service-worker.js         # Message hub shell
└── popup/
    ├── popup.html
    ├── popup.js
    └── popup.css
```

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
      "js": ["content/content-script.js"]
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

**No `microphone` permission in manifest** — Web Speech API requests mic access at runtime via the browser. No `side_panel` yet — sidebar is sub-project 4.

---

## Part 2: Activation Flow (content-script.js)

### State Machine
Four states, one direction:
```
idle → listening → processing → idle
```

Transitions:
- `idle` → `listening`: double-tap Ctrl (within 300ms window)
- `listening` → `processing`: 2s silence OR single tap Ctrl
- `listening` → `idle`: Esc key (cancel)
- `processing` → `idle`: service worker responds (or timeout after 10s)

### Double-tap Detection
```javascript
let lastCtrlPress = 0;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') {
    const now = Date.now();
    if (now - lastCtrlPress < 300 && state === 'idle') {
      activateLennyLive();
    }
    lastCtrlPress = now;
  }
  if (e.key === 'Escape' && state === 'listening') {
    cancelLennyLive();
  }
});
```

Single-tap Ctrl to stop (while listening):
```javascript
// Inside the keydown listener
if (e.key === 'Control' && state === 'listening') {
  stopListening();
}
```

### Activation Sequence
1. Play `ping.mp3` via Web Audio API (fetched as extension asset URL)
2. Inject listening indicator into Shadow DOM: pulsing dot + "Lenny is listening..."
3. Start `SpeechRecognition`
4. On result: update indicator to "Lenny is thinking...", send to service worker
5. On service worker response: remove indicator (postcard rendered by sub-project 4)

### Speech Recognition Config
```javascript
const recognition = new webkitSpeechRecognition();
recognition.continuous = false;
recognition.interimResults = false;
recognition.lang = 'en-US';
recognition.maxAlternatives = 1;
```

### Silence Detection
`recognition.onresult` fires when speech is detected. If no result fires within 2 seconds of `recognition.start()`, treat as silence and call `stopListening()`. Implemented via `setTimeout` reset on `recognition.onspeechstart`.

---

## Part 3: Buzzword Detection (content-script.js)

### Scanning
- `setInterval` every 30 seconds
- Reads `document.body.innerText` (capped at first 5000 chars for performance)
- Checks for any PM_BUZZWORDS match (case-insensitive)
- Debounce: same buzzword suppressed for 5 minutes per tab (`Map` keyed by buzzword)
- Does not run while state is `listening` or `processing`

### PM Buzzwords List
Defined inline in content-script.js (imported from data/pm_buzzwords.js via content script injection is not available — inline the array directly):

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
Map detected buzzwords to the 3 RAG topic strings (for display in the chip):
```javascript
const TOPIC_MAP = {
  'retention': 'Retention', 'churn': 'Retention', 'DAU': 'Retention',
  'GTM': 'GTM Strategy', 'go-to-market': 'GTM Strategy', 'acquisition': 'GTM Strategy',
  'PMF': 'Product-Market Fit', 'product market fit': 'Product-Market Fit',
  // ... rest default to the matched buzzword itself
};
```

---

## Part 4: Shadow DOM UI

All extension UI is injected into a Shadow DOM host appended to `document.body`. This isolates extension styles from the page completely.

```javascript
const host = document.createElement('div');
host.id = 'lenny-live-root';
const shadow = host.attachShadow({ mode: 'closed' });
document.body.appendChild(host);
```

### Listening Indicator
Positioned fixed, bottom-right (32px from edges). Shown during `listening` and `processing` states.

```
╭──────────────────────────────╮
│  ● Lenny is listening...     │
╰──────────────────────────────╯
```

Dark pill, purple pulsing dot, white text. Transitions: "Lenny is thinking..." when processing.

### Buzzword Chip (Glassy Strip)
Positioned fixed, bottom-center (20px from bottom). Slides up on appear (200ms ease-out), fades out after 10s if not clicked.

```
● Lenny on retention →
```

Translucent purple-tinted background, 1px purple border, pulsing dot. Clicking triggers `activateLennyLive()`. Same buzzword suppressed for 5 minutes after chip shown.

**Both elements share the same Shadow DOM host.** They are separate `div`s within it, shown/hidden via CSS classes.

---

## Part 5: Service Worker Shell (service-worker.js)

Receives messages, logs them, echoes back a stub response. Fully replaced in sub-project 2.

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[LennyLive] Message received:', message.type);

  if (message.type === 'QUERY') {
    // Sub-project 2 replaces this stub with RAG pipeline
    sendResponse({ type: 'RESPONSE', status: 'ok', insight: null });
  }

  if (message.type === 'BUZZWORD_TRIGGERED') {
    // Sub-project 2 may use this for passive RAG pre-fetch
    sendResponse({ type: 'ACK' });
  }

  return true; // Keep message channel open for async response
});
```

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
- Last topic detected (from `chrome.storage.local` key `lastTopic`)
- "Double-tap Ctrl to activate" reminder text

**popup.js** reads `chrome.storage.local` on open and renders. No writes.

---

## Part 7: Audio Asset

`assets/sounds/ping.mp3` — a short (~0.5s) activation chime.

**Options (in order of preference):**
1. Use a royalty-free chime from freesound.org (MIT/CC0)
2. Generate a simple tone programmatically via Web Audio API (no file needed)

**Recommended: option 2** — generate the ping in JS, no asset dependency:
```javascript
function playPing() {
  const ctx = new AudioContext();
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
}
```

This removes the `assets/sounds/` directory from the file structure entirely.

---

## Verification

Load the extension in Chrome (`chrome://extensions` → Load unpacked → select `LennyLive/`):

1. **Double-tap Ctrl** on any page → ping tone plays → "Lenny is listening..." indicator appears
2. **Speak** → silence or single tap Ctrl → indicator changes to "Lenny is thinking..."
3. **Service worker responds** → indicator disappears
4. **Esc** during listening → cancels silently, returns to idle
5. **Open a page with PM buzzwords** (e.g., any Notion doc mentioning "retention") → chip appears after ≤30s
6. **Click the chip** → activates Lenny
7. **Ignore the chip** → fades after 10s
8. **Open popup** → shows "Ready" and last detected topic

---

## Out of Scope
- RAG pipeline (sub-project 2)
- ElevenLabs voice (sub-project 3)
- Postcard / sidebar UI (sub-project 4)
- Gamification (V2)
- Selection review mode (V2)
- `data/pm_buzzwords.js` as a separate module (inlined for MV3 compatibility)
