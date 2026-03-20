# Extension Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Chrome Extension Manifest V3 shell — double-tap Ctrl activation, Web Speech API, PM buzzword detection via MutationObserver, Shadow DOM UI — with a stub service worker that echoes back. Sub-projects 2–4 replace the echo with real behaviour.

**Architecture:** A single content script (`content-script.js`) handles all page interaction: keyboard detection, speech recognition, DOM mutation scanning, and Shadow DOM UI injection. A stub service worker (`service-worker.js`) receives messages and responds immediately. No state is kept in the service worker — `chrome.storage.local` is the only persistence. All extension UI lives in a Shadow DOM host injected once at script load.

**Tech Stack:** Vanilla JS (ES6+), Chrome Extension Manifest V3, Web Speech API, Web Audio API, Shadow DOM, `chrome.runtime.sendMessage`, `chrome.storage.local`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `manifest.json` | MV3 manifest — permissions, whitelisted sites, entry points |
| Create | `assets/icons/icon16.png` | Toolbar icon 16×16 |
| Create | `assets/icons/icon48.png` | Extension management icon 48×48 |
| Create | `assets/icons/icon128.png` | Chrome Web Store / install icon 128×128 |
| Create | `scripts/create-icons.js` | One-time script to generate placeholder PNG icons |
| Create | `background/service-worker.js` | Stub message hub — echoes QUERY, ACKs BUZZWORD_TRIGGERED |
| Create | `content/content-script.js` | All activation logic, speech, buzzword scan, Shadow DOM UI |
| Create | `popup/popup.html` | Popup markup |
| Create | `popup/popup.css` | Popup styles |
| Create | `popup/popup.js` | Reads `chrome.storage.local` and renders status |

> **Note:** `content-script.js` is intentionally one file. MV3 content scripts cannot use ES modules (`import/export`), so splitting across files would require a bundler. Vanilla JS, no bundler, means one file. It will be long (~300 lines) but focused — all page interaction in one place.

---

## Verification setup (do once before starting tasks)

Chrome DevTools is your testing tool for this extension. Set up before Task 1:

1. Open Chrome → `chrome://extensions` → enable **Developer mode** (top right toggle)
2. Keep this tab open — you'll reload the extension after every task
3. After each reload: open DevTools on a test page (Google Doc) → **Console** tab → filter by `[LennyLive]`

---

## Task 1: Scaffold — manifest.json + icon placeholders

**Files:**
- Create: `manifest.json`
- Create: `scripts/create-icons.js`
- Create: `assets/icons/icon16.png`, `icon48.png`, `icon128.png`

- [ ] **Step 1.1: Create icon generator script**

```javascript
// scripts/create-icons.js
// Generates minimal valid PNG files for extension icons.
// Writes a solid purple square at each required size.
// Run once: node scripts/create-icons.js

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal PNG writer — writes a solid-color PNG without any external dependency.
// PNG binary format: signature + IHDR + IDAT (zlib-compressed pixel data) + IEND
// We use a hardcoded zlib stream for a solid #7c3aed (purple) fill.
function createSolidPurplePng(size) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcData = Buffer.concat([typeBytes, data]);
    const crc = crc32(crcData);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeInt32BE(crc, 0);
    return Buffer.concat([len, typeBytes, data, crcBuf]);
  }

  // CRC32 implementation
  function crc32(buf) {
    let crc = 0xffffffff;
    for (const byte of buf) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
    }
    return (crc ^ 0xffffffff) | 0;
  }

  // IHDR: width, height, bit depth 8, color type 2 (RGB), compression/filter/interlace 0
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw image data: filter byte (0) + RGB pixels per row
  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      raw[pixelOffset]     = 0x7c; // R
      raw[pixelOffset + 1] = 0x3a; // G
      raw[pixelOffset + 2] = 0xed; // B
    }
  }

  // Compress with zlib (Node built-in)
  const { deflateSync } = await import('zlib');
  const compressed = deflateSync(raw);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

async function main() {
  const iconsDir = join(__dirname, '..', 'assets', 'icons');
  mkdirSync(iconsDir, { recursive: true });

  for (const size of [16, 48, 128]) {
    const png = await createSolidPurplePng(size);
    const path = join(iconsDir, `icon${size}.png`);
    writeFileSync(path, png);
    console.log(`Created ${path} (${png.length} bytes)`);
  }
  console.log('Icons created. Run this script once — delete it after.');
}

main();
```

> **Note:** This script uses Node's built-in `zlib.deflateSync`. It does NOT require any new npm packages. Run with `node scripts/create-icons.js`.

- [ ] **Step 1.2: Run icon generator**

```bash
cd /Users/rajat/AntiGravity/LennyLive
node scripts/create-icons.js
```

Expected output:
```
Created .../assets/icons/icon16.png (...)
Created .../assets/icons/icon48.png (...)
Created .../assets/icons/icon128.png (...)
Icons created. Run this script once — delete it after.
```

Verify: `ls assets/icons/` shows three .png files.

- [ ] **Step 1.3: Create manifest.json**

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

- [ ] **Step 1.4: Create stub files so Chrome doesn't error on load**

Create `background/service-worker.js` (one line stub — replaced in Task 2):
```javascript
console.log('[LennyLive] Service worker loaded');
```

Create `content/content-script.js` (one line stub — replaced in Tasks 3–7):
```javascript
console.log('[LennyLive] Content script loaded');
```

Create `popup/popup.html` (minimal — replaced in Task 8):
```html
<!DOCTYPE html><html><body><p>Lenny Live</p></body></html>
```

Create `popup/popup.js` (empty — replaced in Task 8):
```javascript
// popup.js — implemented in Task 8
```

Create `popup/popup.css` (empty — replaced in Task 8):
```css
/* popup.css — implemented in Task 8 */
```

- [ ] **Step 1.5: Load extension in Chrome and verify no errors**

1. Open `chrome://extensions` → click **Load unpacked** → select `/Users/rajat/AntiGravity/LennyLive`
2. Extension should appear with a purple icon in the toolbar
3. Click the extension icon → popup shows "Lenny Live"
4. Open a Google Doc → open DevTools Console → should see: `[LennyLive] Content script loaded`
5. Check `chrome://extensions` → no errors shown under the extension

- [ ] **Step 1.6: Commit**

```bash
git add manifest.json assets/ background/service-worker.js content/content-script.js popup/ scripts/create-icons.js
git commit -m "Scaffold extension shell — manifest, icons, stubs load cleanly"
```

---

## Task 2: Service Worker Shell

**Files:**
- Modify: `background/service-worker.js`

- [ ] **Step 2.1: Write service-worker.js**

```javascript
// background/service-worker.js
// Stub message hub — receives messages from content script, echoes back.
// Sub-project 2 replaces this with the real RAG pipeline.
//
// MV3 constraint: service workers can be terminated by Chrome at any time.
// This stub responds synchronously so termination is not a concern.
// Sub-project 2 must choose: keep sync OR switch to push model
// (service worker calls chrome.tabs.sendMessage back instead of sendResponse).

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[LennyLive] Message received:', message.type, message);

  if (message.type === 'QUERY') {
    // Stub: echo back empty response. Sub-project 2 replaces with RAG + ElevenLabs.
    sendResponse({ type: 'RESPONSE', status: 'ok', insight: null });
  }

  if (message.type === 'BUZZWORD_TRIGGERED') {
    // Stub: acknowledge. Sub-project 2 may pre-fetch related insights here.
    sendResponse({ type: 'ACK' });
  }

  return true; // keeps the message port open for sendResponse
});
```

- [ ] **Step 2.2: Reload extension and verify**

1. Go to `chrome://extensions` → click the reload icon (⟳) on Lenny Live
2. Open a Google Doc → DevTools → Application → Service Workers
3. Confirm `service-worker.js` is listed and status is "activated and is running"
4. In DevTools console, run:
   ```javascript
   chrome.runtime.sendMessage({type: 'QUERY', transcript: 'test', selection: ''}, r => console.log(r))
   ```
   Expected: `{type: "RESPONSE", status: "ok", insight: null}`

- [ ] **Step 2.3: Commit**

```bash
git add background/service-worker.js
git commit -m "Add service worker stub — echoes QUERY, ACKs BUZZWORD_TRIGGERED"
```

---

## Task 3: Shadow DOM Host + UI Elements

**Files:**
- Modify: `content/content-script.js`

This task creates the Shadow DOM host and all UI div elements (indicator, chip, tooltip). No behavior yet — just the container and CSS.

- [ ] **Step 3.1: Write Shadow DOM host and UI skeleton**

Replace `content/content-script.js` entirely:

```javascript
// content/content-script.js
// Detection + Shadow DOM UI injection for Lenny Live.
// MV3 content scripts cannot use ES modules — this is one intentionally long file.

// ─── Shadow DOM Setup ────────────────────────────────────────────────────────

const host = document.createElement('div');
host.id = 'lenny-live-root';
const shadow = host.attachShadow({ mode: 'open' }); // open = inspectable in DevTools
document.body.appendChild(host);

// Inject all styles into shadow root
const style = document.createElement('style');
style.textContent = `
  /* ── Listening Indicator ── */
  #ll-indicator {
    display: none;
    position: fixed;
    bottom: 32px;
    right: 32px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 24px;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: #fff;
    z-index: 2147483647;
    pointer-events: none;
  }
  #ll-indicator.hidden { display: none !important; }

  #ll-dot {
    width: 8px;
    height: 8px;
    background: #a78bfa;
    border-radius: 50%;
    flex-shrink: 0;
    animation: ll-pulse 1.5s infinite;
  }
  #ll-indicator.loading #ll-dot { animation: none; }

  /* Skeleton shimmer for loading state */
  #ll-indicator.loading #ll-text {
    background: linear-gradient(90deg, #333 25%, #555 50%, #333 75%);
    background-size: 200% 100%;
    animation: ll-shimmer 1.2s infinite;
    border-radius: 4px;
    color: transparent;
    min-width: 140px;
    height: 14px;
  }

  @keyframes ll-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(1.3); }
  }
  @keyframes ll-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Mic Denied Tooltip ── */
  #ll-tooltip {
    display: none;
    position: fixed;
    bottom: 80px;
    right: 32px;
    background: #1a1a1a;
    border: 1px solid #ef4444;
    border-radius: 12px;
    padding: 8px 14px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    color: #fca5a5;
    z-index: 2147483647;
    pointer-events: none;
    max-width: 260px;
  }
  #ll-tooltip.visible { display: block; }

  /* ── Buzzword Chip ── */
  #ll-chip {
    display: none;
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.1));
    border: 1px solid rgba(124,58,237,0.3);
    border-radius: 12px;
    padding: 10px 16px;
    align-items: center;
    gap: 10px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: #e5e7eb;
    z-index: 2147483647;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: transform 0.2s ease-out, opacity 0.2s ease-out;
    opacity: 0;
    white-space: nowrap;
  }
  #ll-chip.visible {
    display: flex;
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  #ll-chip.fading {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }

  #ll-chip-dot {
    width: 6px;
    height: 6px;
    background: #a78bfa;
    border-radius: 50%;
    flex-shrink: 0;
    animation: ll-pulse 1.5s infinite;
  }
  #ll-chip-topic { color: #a78bfa; font-weight: 600; }
`;
shadow.appendChild(style);

// Create indicator
const indicator = document.createElement('div');
indicator.id = 'll-indicator';
indicator.className = 'hidden';
indicator.innerHTML = '<div id="ll-dot"></div><span id="ll-text">Lenny is listening...</span>';
shadow.appendChild(indicator);

// Create mic denied tooltip
const tooltip = document.createElement('div');
tooltip.id = 'll-tooltip';
tooltip.textContent = 'Mic access needed — click the lock icon in your address bar.';
shadow.appendChild(tooltip);

// Create buzzword chip
const chip = document.createElement('div');
chip.id = 'll-chip';
chip.innerHTML = '<div id="ll-chip-dot"></div><span>Lenny on <span id="ll-chip-topic"></span> →</span>';
shadow.appendChild(chip);

// ─── UI Helper Functions ──────────────────────────────────────────────────────

function showIndicator(mode) {
  // mode: 'listening' | 'thinking' | 'loading'
  const dot = shadow.getElementById('ll-dot');
  const text = shadow.getElementById('ll-text');
  indicator.classList.remove('hidden', 'loading');
  if (mode === 'listening') {
    text.textContent = 'Lenny is listening...';
  } else if (mode === 'thinking') {
    text.textContent = 'Lenny is thinking...';
  } else if (mode === 'loading') {
    indicator.classList.add('loading');
    text.textContent = 'Lenny is thinking...'; // visible but shimmer covers it
  }
}

function hideIndicator() {
  indicator.classList.add('hidden');
}

function showMicDeniedTooltip() {
  tooltip.classList.add('visible');
  setTimeout(() => tooltip.classList.remove('visible'), 4000);
}

function showBuzzwordChip(topic) {
  shadow.getElementById('ll-chip-topic').textContent = topic;
  chip.classList.remove('fading');
  chip.classList.add('visible');

  // Auto-fade after 10s
  const fadeTimer = setTimeout(() => {
    chip.classList.add('fading');
    setTimeout(() => chip.classList.remove('visible', 'fading'), 200);
  }, 10000);

  chip.onclick = () => {
    clearTimeout(fadeTimer);
    chip.classList.remove('visible', 'fading');
    activateLennyLive();
  };
}

console.log('[LennyLive] Content script loaded — Shadow DOM ready');
```

- [ ] **Step 3.2: Reload and verify Shadow DOM in DevTools**

1. Reload extension in `chrome://extensions`
2. Open a Google Doc → DevTools → Elements tab
3. Find `<div id="lenny-live-root">` at the bottom of `<body>`
4. Expand it → confirm shadow-root contains `#ll-indicator`, `#ll-tooltip`, `#ll-chip`
5. Console should log: `[LennyLive] Content script loaded — Shadow DOM ready`

- [ ] **Step 3.3: Commit**

```bash
git add content/content-script.js
git commit -m "Add Shadow DOM host, UI elements (indicator/chip/tooltip), and CSS"
```

---

## Task 4: Ping Tone + State Machine Skeleton

**Files:**
- Modify: `content/content-script.js`

- [ ] **Step 4.1: Append state machine and ping tone to content-script.js**

Add the following after the Shadow DOM setup in `content-script.js` (append before the `console.log` at the end):

```javascript
// ─── State Machine ────────────────────────────────────────────────────────────
// States: idle | listening | processing | loading
// One-directional: idle → listening → processing → loading → idle
// Errors / Esc always return to idle.

let state = 'idle';

// ─── Ping Tone (Web Audio API) ────────────────────────────────────────────────
// Double-tap Ctrl is a keydown event — qualifies as a user gesture for autoplay.

function playPing() {
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
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
    // Fail silently — activation continues without sound
  }
}
```

- [ ] **Step 4.2: Reload and test ping via DevTools console**

1. Reload extension
2. Open a Google Doc → DevTools Console
3. Run: `document.getElementById('lenny-live-root').shadowRoot` → should return shadow root
4. This task doesn't have audible verification yet (ping needs double-tap Ctrl) — confirmed in Task 5

- [ ] **Step 4.3: Commit**

```bash
git add content/content-script.js
git commit -m "Add state machine variable and playPing() via Web Audio API"
```

---

## Task 5: Double-tap Ctrl + Activation + processQuery

**Files:**
- Modify: `content/content-script.js`

This task wires up the double-tap Ctrl keyboard handler, `activateLennyLive()`, `cancelLennyLive()`, and `processQuery()` — the full state machine flow through to `idle`. Speech recognition is a stub here (added in Task 6).

- [ ] **Step 5.1: Append keyboard handler and activation functions**

Append to `content-script.js` (before the final `console.log`):

```javascript
// ─── Selection Capture + Keyboard Handler ────────────────────────────────────

let lastCtrlPress = 0;
let currentSelection = '';

document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') {
    const now = Date.now();

    if (state === 'idle' && now - lastCtrlPress < 300) {
      // Double-tap Ctrl: capture selection at this moment, then activate
      currentSelection = window.getSelection().toString().trim().slice(0, 500);
      activateLennyLive();
    } else if (state === 'listening') {
      // Single tap during listening: stop capture immediately
      stopListening();
    }

    lastCtrlPress = now; // always update, regardless of state
  }

  if (e.key === 'Escape' && state === 'listening') {
    cancelLennyLive();
  }
});

// ─── Activation ───────────────────────────────────────────────────────────────

function activateLennyLive() {
  if (state !== 'idle') return;
  state = 'listening';
  playPing();
  showIndicator('listening');
  startListening(); // defined in Task 6; stub below for Task 5 testing
}

function cancelLennyLive() {
  state = 'idle';
  clearTimeout(timerA);
  clearTimeout(timerB);
  if (typeof recognition !== 'undefined' && recognition) {
    try { recognition.abort(); } catch (_) {}
  }
  hideIndicator();
  console.log('[LennyLive] Cancelled — returned to idle');
}

// ─── Query Processing ─────────────────────────────────────────────────────────

let processingTimeout = null;

function processQuery(transcript) {
  state = 'processing';
  showIndicator('thinking');
  console.log('[LennyLive] Sending query:', { transcript, selection: currentSelection });

  chrome.runtime.sendMessage(
    { type: 'QUERY', transcript, selection: currentSelection },
    (response) => {
      clearTimeout(processingTimeout);

      if (!response) {
        console.log('[LennyLive] No response from service worker — returning to idle');
        cancelLennyLive();
        return;
      }

      console.log('[LennyLive] Response received:', response);
      state = 'loading';
      showIndicator('loading');

      // Sub-project 4 renders postcard here.
      // For sub-project 1: return to idle after short delay.
      setTimeout(() => {
        state = 'idle';
        hideIndicator();
        console.log('[LennyLive] Returned to idle after stub response');
      }, 500);
    }
  );

  // Safety timeout: return to idle if service worker never responds
  processingTimeout = setTimeout(() => {
    if (state === 'processing' || state === 'loading') {
      console.log('[LennyLive] Service worker timeout (10s) — returning to idle');
      cancelLennyLive();
    }
  }, 10000);
}

// ─── Stub startListening (replaced in Task 6) ─────────────────────────────────
// Simulates speech recognition for testing state machine in Task 5.
// Task 6 replaces this with real SpeechRecognition.

let timerA, timerB;

function startListening() {
  console.log('[LennyLive] [STUB] Listening started — type in console to simulate speech');
  // In Task 5, test by calling processQuery('test') in DevTools console
}

function stopListening() {
  clearTimeout(timerA);
  clearTimeout(timerB);
  processQuery('manually stopped'); // simulate a transcript
}
```

- [ ] **Step 5.2: Reload and test state machine manually**

1. Reload extension in `chrome://extensions`
2. Open a Google Doc → DevTools Console
3. **Test double-tap Ctrl:**
   - Double-tap Ctrl quickly (< 300ms) → ping plays, "Lenny is listening..." appears bottom-right, console logs `[LennyLive] [STUB] Listening started`
4. **Test processQuery manually:**
   - In console: type `processQuery('what is retention?')`
   - Console logs: `[LennyLive] Sending query:` with transcript and selection
   - Indicator changes to "Lenny is thinking..." briefly → skeleton shimmer → disappears
   - Console logs: `[LennyLive] Response received: {type: "RESPONSE", ...}`
   - Console logs: `[LennyLive] Returned to idle after stub response`
5. **Test Esc cancel:**
   - Double-tap Ctrl → immediately press Esc → indicator disappears, console logs `Cancelled`
6. **Test single-tap during listening:**
   - Double-tap Ctrl → single-tap Ctrl → `stopListening()` triggers → processes

- [ ] **Step 5.3: Commit**

```bash
git add content/content-script.js
git commit -m "Add double-tap Ctrl, state machine, processQuery with service worker messaging"
```

---

## Task 6: Speech Recognition + Silence Timers

**Files:**
- Modify: `content/content-script.js`

Replace the stub `startListening` with real `SpeechRecognition`.

- [ ] **Step 6.1: Replace stub startListening with real implementation**

In `content-script.js`, find and replace the stub section `// ─── Stub startListening (replaced in Task 6)` through the end of `function stopListening()` with:

```javascript
// ─── Speech Recognition ───────────────────────────────────────────────────────

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;

if (!SpeechRecognition) {
  console.warn('[LennyLive] SpeechRecognition not supported in this browser — activation disabled');
  // activateLennyLive will still run but startListening will no-op gracefully
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    console.log('[LennyLive] Recognition started — Timer A (5s no-speech) running');
    timerA = setTimeout(() => {
      console.log('[LennyLive] Timer A fired — no speech detected, cancelling');
      cancelLennyLive();
    }, 5000);
  };

  recognition.onspeechstart = () => {
    console.log('[LennyLive] Speech detected — clearing Timer A');
    clearTimeout(timerA);
  };

  recognition.onspeechend = () => {
    console.log('[LennyLive] Speech ended — Timer B (2s post-silence) running');
    timerB = setTimeout(() => {
      console.log('[LennyLive] Timer B fired — processing query');
      // recognition.stop() triggers onresult if speech was captured
      try { recognition.stop(); } catch (_) {}
    }, 2000);
  };

  recognition.onresult = (e) => {
    clearTimeout(timerA);
    clearTimeout(timerB);
    const transcript = e.results[0][0].transcript;
    console.log('[LennyLive] Transcript:', transcript);
    processQuery(transcript);
  };

  recognition.onerror = (e) => {
    clearTimeout(timerA);
    clearTimeout(timerB);
    console.log('[LennyLive] Speech error:', e.error);
    if (e.error === 'not-allowed') {
      showMicDeniedTooltip();
    }
    cancelLennyLive();
  };

  recognition.onend = () => {
    // Fires when session ends for any reason (including natural browser termination).
    // If still in 'listening', no result was captured — return to idle.
    if (state === 'listening') {
      console.log('[LennyLive] Recognition ended without result — returning to idle');
      cancelLennyLive();
    }
  };
}

function startListening() {
  if (!recognition) {
    console.warn('[LennyLive] SpeechRecognition unavailable — cannot start listening');
    cancelLennyLive();
    return;
  }
  try {
    recognition.start();
    console.log('[LennyLive] Recognition started');
  } catch (err) {
    console.log('[LennyLive] Failed to start recognition:', err.message);
    cancelLennyLive();
  }
}

function stopListening() {
  clearTimeout(timerA);
  clearTimeout(timerB);
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
  }
}
```

- [ ] **Step 6.2: Reload and run speech verification tests**

Tests from spec (verification steps 2–6):

**Test: Speak → 2s silence → processes (step 2)**
1. Double-tap Ctrl → "Lenny is listening..." appears
2. Speak clearly: "What is retention?"
3. Pause 2s → indicator changes to "Lenny is thinking..." → skeleton shimmer → disappears
4. Console: Timer B fires → transcript logged → Response received → Returned to idle

**Test: Single tap stops immediately (step 3)**
1. Double-tap Ctrl → speak → single-tap Ctrl
2. Recognition stops immediately → processes whatever was captured

**Test: No speech → 5s cancel (step 4)**
1. Double-tap Ctrl → say nothing
2. After 5s: `[LennyLive] Timer A fired — no speech detected, cancelling`
3. Indicator disappears, state returns to idle

**Test: Esc cancels (step 5)**
1. Double-tap Ctrl → immediately press Esc
2. Console: `[LennyLive] Cancelled — returned to idle`

**Test: Mic denied (step 6)**
1. Open site settings (lock icon → Microphone → Block)
2. Double-tap Ctrl → `[LennyLive] Speech error: not-allowed`
3. Tooltip "Mic access needed..." appears for 4s, then disappears

**Test: Selection capture (step 7)**
1. Highlight some text in a Google Doc
2. Double-tap Ctrl → speak "tell me about this"
3. Console log for `Sending query:` should show `selection` is the highlighted text

- [ ] **Step 6.3: Commit**

```bash
git add content/content-script.js
git commit -m "Add SpeechRecognition with Timer A/B silence detection, onend handler, mic error"
```

---

## Task 7: Buzzword Detection (MutationObserver)

**Files:**
- Modify: `content/content-script.js`

- [ ] **Step 7.1: Append buzzword detection to content-script.js**

Append to `content-script.js` (before the final `console.log`):

```javascript
// ─── PM Buzzwords ─────────────────────────────────────────────────────────────
// Inlined — MV3 content scripts cannot import external modules.

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

function getDisplayTopic(buzzword) {
  return TOPIC_MAP[buzzword] ?? (buzzword.charAt(0).toUpperCase() + buzzword.slice(1));
}

// ─── Buzzword Scanning ────────────────────────────────────────────────────────

let lastChipShownAt = 0;
const topicCooldowns = new Map(); // topic → timestamp of last chip shown

function scanForBuzzwords() {
  if (state !== 'idle') return; // never interrupt active session

  const text = document.body.innerText.slice(0, 5000);
  const now = Date.now();

  for (const buzzword of PM_BUZZWORDS) {
    const regex = new RegExp(`\\b${buzzword}\\b`, 'i');
    if (!regex.test(text)) continue;

    const displayTopic = getDisplayTopic(buzzword);

    // General cooldown: any chip shown in last 3 minutes → skip
    if (now - lastChipShownAt < 3 * 60 * 1000) {
      console.log('[LennyLive] Buzzword match suppressed (general 3min cooldown):', buzzword);
      return;
    }

    // Per-topic cooldown: same topic shown in last 30 minutes → skip
    const topicLastShown = topicCooldowns.get(displayTopic) || 0;
    if (now - topicLastShown < 30 * 60 * 1000) {
      console.log('[LennyLive] Buzzword match suppressed (topic 30min cooldown):', displayTopic);
      continue; // try next buzzword — different topic might not be suppressed
    }

    console.log('[LennyLive] Buzzword matched:', buzzword, '→', displayTopic);
    lastChipShownAt = now;
    topicCooldowns.set(displayTopic, now);
    chrome.storage.local.set({ lastTopic: displayTopic });
    showBuzzwordChip(displayTopic);
    break; // show one chip at a time
  }
}

// ─── MutationObserver ─────────────────────────────────────────────────────────
// Fires when DOM changes (user typing). Debounced 2s to avoid thrashing.
// childList+subtree catches element additions (Notion, Linear live updates).
// characterData catches text edits in Google Docs contenteditable nodes.

let buzzwordDebounceTimer = null;

const observer = new MutationObserver(() => {
  clearTimeout(buzzwordDebounceTimer);
  buzzwordDebounceTimer = setTimeout(scanForBuzzwords, 2000);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

console.log('[LennyLive] MutationObserver watching for PM buzzwords');
```

- [ ] **Step 7.2: Reload and run buzzword verification tests**

**Test: Chip appears (step 8)**
1. Open a Google Doc
2. Type "retention" anywhere in the doc
3. Wait 2–3 seconds (MutationObserver debounce)
4. Console: `[LennyLive] Buzzword matched: retention → Retention`
5. Glassy purple chip appears at bottom-center: "Lenny on Retention →"

**Test: Chip click activates (step 9)**
1. When chip appears, click it → activation sequence starts

**Test: Chip fades after 10s (step 10)**
1. Let chip appear → do nothing → chip fades after 10 seconds

**Test: Per-topic 30min cooldown (step 11)**
1. Trigger "retention" chip → wait for it to fade
2. Type "retention" again in the doc → wait 2s → chip does NOT appear
3. Console: `Buzzword match suppressed (topic 30min cooldown): Retention`

**Test: General 3min cooldown (step 12)**
1. Trigger chip for "retention"
2. Wait 10s for it to fade
3. Type "GTM" (different topic) → wait 2s → chip suppressed (general 3min cooldown applies)
4. Console: `Buzzword match suppressed (general 3min cooldown): GTM`

**Test: chrome.storage.local populated (step 14)**
1. After any buzzword chip appears → DevTools → Application → Local Storage
2. Key `lastTopic` should be set (e.g. `"Retention"`)

- [ ] **Step 7.3: Commit**

```bash
git add content/content-script.js
git commit -m "Add MutationObserver buzzword detection with 3min/30min cooldowns"
```

---

## Task 8: Popup

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.css`
- Create: `popup/popup.js`

- [ ] **Step 8.1: Write popup.css**

```css
/* popup/popup.css */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 240px;
  font-family: system-ui, -apple-system, sans-serif;
  background: #0f0f0f;
  color: #e5e7eb;
  padding: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.logo-dot {
  width: 10px;
  height: 10px;
  background: #7c3aed;
  border-radius: 50%;
}

.logo-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.status-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-value {
  font-size: 12px;
  color: #a78bfa;
  font-weight: 500;
}

.divider {
  border: none;
  border-top: 1px solid #1f1f1f;
  margin: 12px 0;
}

.hint {
  font-size: 11px;
  color: #4b5563;
  text-align: center;
}

.hint kbd {
  background: #1f1f1f;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 1px 5px;
  font-family: monospace;
  font-size: 10px;
  color: #9ca3af;
}
```

- [ ] **Step 8.2: Write popup.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="logo">
    <div class="logo-dot"></div>
    <span class="logo-name">Lenny Live</span>
  </div>

  <div class="status-row">
    <span class="status-label">Status</span>
    <span class="status-value" id="status-value">Ready</span>
  </div>

  <div class="status-row">
    <span class="status-label">Last topic</span>
    <span class="status-value" id="last-topic">—</span>
  </div>

  <hr class="divider">

  <p class="hint">Double-tap <kbd>Ctrl</kbd> to activate</p>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 8.3: Write popup.js**

```javascript
// popup/popup.js
// Reads chrome.storage.local on open and renders. No writes.

chrome.storage.local.get(['lastTopic'], (result) => {
  const lastTopicEl = document.getElementById('last-topic');
  if (result.lastTopic) {
    lastTopicEl.textContent = result.lastTopic;
  }
});
```

- [ ] **Step 8.4: Reload and verify popup**

1. Reload extension
2. Click the Lenny Live icon in Chrome toolbar
3. Popup appears: dark background, purple dot + "Lenny Live", Status: Ready, Last topic: —
4. Trigger a buzzword chip (type "retention" in a Google Doc, wait 2s)
5. Click popup again → Last topic shows "Retention"

- [ ] **Step 8.5: Commit**

```bash
git add popup/
git commit -m "Add popup — status display and last detected topic from chrome.storage.local"
```

---

## Task 9: Non-Whitelisted Site Check + Final Verification

**Files:** None — verification only

- [ ] **Step 9.1: Run all 15 verification steps from the spec**

Load the extension and systematically verify each step:

1. ✅ Double-tap Ctrl on Google Doc → ping plays → "Lenny is listening..." bottom-right
2. ✅ Speak → pause 2s → thinking → shimmer → disappears
3. ✅ Double-tap → speak → single-tap Ctrl → processes immediately
4. ✅ Double-tap → silence → after 5s indicator disappears (Timer A)
5. ✅ Esc during listening → cancels
6. ✅ Deny mic → tooltip appears, auto-dismisses 4s, back to idle
7. ✅ Highlight text → double-tap → speak → `selection` in service worker log
8. ✅ Type "retention" in Google Doc → chip within 2s
9. ✅ Click chip → activates Lenny
10. ✅ Ignore chip → fades after 10s
11. ✅ Trigger same topic twice in 30min → second suppressed
12. ✅ Trigger any chip twice in 3min → second suppressed
13. ✅ Popup shows "Ready" and last detected topic
14. ✅ DevTools → Application → Local Storage → `lastTopic` populated
15. ✅ Go to twitter.com → no `[LennyLive]` logs → content script not loaded

- [ ] **Step 9.2: Verify on all four whitelisted sites**

Test double-tap Ctrl + buzzword detection on each:
- [ ] Google Docs (`docs.google.com/document/...`)
- [ ] Notion (`notion.so`)
- [ ] Jira (`*.atlassian.net`)
- [ ] Linear (`linear.app`)

- [ ] **Step 9.3: Final commit**

```bash
git add -A
git commit -m "Sub-project 1 complete — extension shell passes all 15 verification steps"
```

---

## What's Next

Sub-project 2 replaces `background/service-worker.js` with the real RAG pipeline:
- Receive `QUERY` message
- Embed transcript with Google AI `gemini-embedding-001`
- Query Supabase `match_transcript_chunks` RPC
- Return `{ type: 'RESPONSE', status: 'ok', insight: { guest_name, episode_title, pull_quote, youtube_url, timestamp_secs } }`

The `processQuery` function in `content-script.js` already handles `insight: null` (stub state) and will gracefully accept a real `insight` object once sub-project 2 is live.
