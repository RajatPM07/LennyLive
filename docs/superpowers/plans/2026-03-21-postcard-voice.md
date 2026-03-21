# Sub-Project 3: Postcard UI + Voice Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `console.log('[LennyLive] Insight received:')` stub with a visible floating postcard + ElevenLabs TTS voice response using a two-push architecture.

**Architecture:** The service worker already pushes a `RESPONSE` message after RAG completes. This plan adds: (1) a `tts.js` module that fetches base64 MP3 from ElevenLabs, (2) a fire-and-forget TTS race in the service worker that pushes an `AUDIO` message if TTS resolves within 3 seconds, and (3) postcard UI + audio playback in the content script that responds to both messages independently.

**Tech Stack:** Chrome Extension MV3, vanilla JS, ElevenLabs TTS REST API (`eleven_turbo_v2`), Web Audio (`new Audio()`), `chrome.storage.local`, CSS custom properties inside shadow DOM.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `background/config.js` | Modify (gitignored) | Add `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` exports |
| `background/config.js.example` | Modify | Add placeholder entries for both new exports |
| `background/tts.js` | **Create** | `fetchTTS(text)` — ElevenLabs REST call → base64 MP3 |
| `manifest.json` | Modify | Add `https://api.elevenlabs.io/*` to `host_permissions` only |
| `background/service-worker.js` | Modify | Import `fetchTTS`, add TTS race after Push 1 |
| `content/content-script.js` | Modify | Postcard CSS + HTML, `showPostcard`, `hidePostcard`, `playAudio`, mute toggle, save, extend `onMessage`, fix `cancelLennyLive` bug |

---

## Task 1: Add ElevenLabs credentials to config files

**Files:**
- Modify: `background/config.js` (gitignored — do not commit)
- Modify: `background/config.js.example`

---

- [ ] **Step 1: Add exports to `background/config.js`**

Open `background/config.js`. It currently exports three constants. Add two more at the bottom:

```javascript
export const ELEVENLABS_API_KEY  = 'YOUR_REAL_API_KEY_HERE';   // from .env
export const ELEVENLABS_VOICE_ID = 'cjVigY5qzO86Huf0OWal';    // from .env — Lenny placeholder
```

Replace the values with the real credentials from `.env` (variables `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`).

- [ ] **Step 2: Add placeholder entries to `background/config.js.example`**

Open `background/config.js.example`. Add two lines at the bottom, matching the existing placeholder style:

```javascript
export const ELEVENLABS_API_KEY  = 'YOUR_ELEVENLABS_API_KEY';
export const ELEVENLABS_VOICE_ID = 'YOUR_ELEVENLABS_VOICE_ID';
```

- [ ] **Step 3: Commit the example file only**

```bash
git add background/config.js.example
git commit -m "feat: add ElevenLabs credential placeholders to config.js.example"
```

`background/config.js` is gitignored — `git status` must NOT show it staged.

---

## Task 2: Create `background/tts.js`

**Files:**
- Create: `background/tts.js`

No automated test harness for MV3 service worker files. Verification is done in Task 4 by watching service worker logs in Chrome DevTools.

---

- [ ] **Step 1: Create `background/tts.js` with the full implementation**

```javascript
// background/tts.js
// ElevenLabs TTS — returns base64-encoded MP3 string.
// Called fire-and-forget from service-worker.js after Push 1.
// Throws on non-2xx — caught by Promise.race .catch() in service-worker.

import { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } from './config.js';

export async function fetchTTS(text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} — ${errBody}`);
  }
  // Convert binary MP3 stream → base64 string for Chrome message bus transport
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
```

- [ ] **Step 2: Commit**

```bash
git add background/tts.js
git commit -m "feat: add fetchTTS() — ElevenLabs TTS REST → base64 MP3"
```

---

## Task 3: Update `manifest.json` — ElevenLabs host permission

**Files:**
- Modify: `manifest.json`

> **Critical:** Add to `host_permissions` ONLY. Do NOT add to `content_scripts[].matches` — that array controls page injection and must stay limited to PM tool URLs. After this change the two arrays are intentionally out of sync.

---

- [ ] **Step 1: Add ElevenLabs to `host_permissions`**

Open `manifest.json`. Find the `host_permissions` array (currently 4 PM tool URLs). Add one entry:

```json
"host_permissions": [
  "*://docs.google.com/document/*",
  "*://*.notion.so/*",
  "*://*.atlassian.net/*",
  "*://*.linear.app/*",
  "https://api.elevenlabs.io/*"
],
```

Do NOT touch `content_scripts[].matches`.

> **Note on existing RAG host permissions:** The service worker already calls Supabase and Google AI (from Sub-project 2). Those origins are not listed in `host_permissions` — if RAG queries are currently working, do not investigate this now (it's a pre-existing state). If after reloading the extension you see Supabase or Google AI failures, they are not caused by this task — check whether those origins need adding to `host_permissions` separately. Sub-project 3 only adds the ElevenLabs entry.

- [ ] **Step 2: Verify `content_scripts` is unchanged**

`content_scripts[].matches` must still contain exactly these four entries:
```
"*://docs.google.com/document/*"
"*://*.notion.so/*"
"*://*.atlassian.net/*"
"*://*.linear.app/*"
```

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: add ElevenLabs host_permission for TTS fetch from service worker"
```

---

## Task 4: Wire TTS into `background/service-worker.js`

**Files:**
- Modify: `background/service-worker.js:1` (add import)
- Modify: `background/service-worker.js:64-65` (add TTS race after Push 1)

---

- [ ] **Step 1: Add the `fetchTTS` import at the top of `service-worker.js`**

Line 1 currently reads:
```javascript
// background/service-worker.js
```

After line 8 (`import { embedQuery, searchChunks } from './rag.js';`), add:

```javascript
import { fetchTTS } from './tts.js';
```

Result — top of file should read:
```javascript
// background/service-worker.js
// MV3 service worker — push model RAG pipeline.
// ...

import { embedQuery, searchChunks } from './rag.js';
import { fetchTTS } from './tts.js';
```

- [ ] **Step 2: Add the TTS race after Push 1 in `handleQuery`**

Find this line (currently line 64):
```javascript
    pushResponse(tabId, { type: 'RESPONSE', status: 'ok', insight });
```

Add the TTS race immediately after it (before the `} catch` block):

```javascript
    pushResponse(tabId, { type: 'RESPONSE', status: 'ok', insight });

    // Push 2 — fire-and-forget TTS race (never blocks Push 1)
    // If TTS resolves within 3s: sends AUDIO. If not: logs warning, no AUDIO sent.
    const ttsTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TTS timeout (3s)')), 3000)
    );
    Promise.race([fetchTTS(insight.pull_quote), ttsTimeout])
      .then(audio => pushResponse(tabId, { type: 'AUDIO', audio }))
      .catch(err => console.warn('[LennyLive] TTS skipped:', err.message));
```

- [ ] **Step 3: Reload extension and verify TTS is called**

In Chrome, go to `chrome://extensions` → Lenny Live → "Service worker" link → DevTools Console.

Trigger a PM query (double-tap Ctrl, speak "what is product market fit"). Watch for:
```
[LennyLive] Insight found: <guest> | <topic> | similarity: 0.5xx
```
followed within 3 seconds by either:
```
[LennyLive] TTS skipped: TTS timeout (3s)
```
OR (if ElevenLabs responds): the `AUDIO` push — no log for success (it's fire-and-forget).

If you see `ElevenLabs TTS failed: 401`, the API key in `config.js` is wrong. If you see `ElevenLabs TTS failed: 422`, the voice ID is wrong.

- [ ] **Step 4: Commit**

```bash
git add background/service-worker.js
git commit -m "feat: add fire-and-forget TTS race to service-worker (Push 2 AUDIO)"
```

---

## Task 5: Inject postcard CSS + HTML skeleton into `content/content-script.js`

**Files:**
- Modify: `content/content-script.js:128` (append postcard CSS to existing style element)
- Modify: `content/content-script.js:147` (append postcard div to shadow DOM)

The shadow DOM `style` element and root already exist. We append — we do not create new elements.

---

- [ ] **Step 1: Append postcard CSS to the existing `style` element**

Find line 128 in `content/content-script.js`:
```javascript
shadow.appendChild(style);
```

Immediately after it, add:

```javascript
// Append postcard styles to the existing shadow DOM style element
style.textContent += `

  /* ─── LennyLive Postcard Theme Config — edit here to restyle ──── */
  /* All visual tokens are CSS variables. Change values here only.   */
  #ll-postcard {
    /* colours */
    --ll-bg:               #1a1a1a;
    --ll-border:           #333333;
    --ll-accent:           #a78bfa;
    --ll-accent-bg:        rgba(124, 58, 237, 0.15);
    --ll-accent-border:    rgba(124, 58, 237, 0.3);
    --ll-text-primary:     #e5e7eb;
    --ll-text-secondary:   #6b7280;
    /* typography */
    --ll-font:             system-ui, -apple-system, sans-serif;
    --ll-font-size-quote:  14px;
    --ll-font-size-meta:   12px;
    --ll-font-size-pill:   11px;
    --ll-line-height:      1.5;
    /* layout */
    --ll-padding:          16px;
    --ll-border-radius:    16px;
    --ll-pill-radius:      20px;
    --ll-width:            320px;
    /* animation */
    --ll-anim-duration:    0.2s;
    --ll-anim-slide:       20px;
  }
  /* ─────────────────────────────────────────────────────────────── */

  /* Postcard layout — references theme variables above */
  #ll-postcard {
    position: fixed;
    bottom: 32px;
    right: 32px;
    width: var(--ll-width);
    z-index: 2147483647;
    pointer-events: auto;
    background: var(--ll-bg);
    border: 1px solid var(--ll-border);
    border-radius: var(--ll-border-radius);
    font-family: var(--ll-font);
    padding: var(--ll-padding);
    box-sizing: border-box;
  }

  #ll-postcard.hidden { display: none; }

  #ll-postcard:not(.hidden):not(.ll-postcard-hiding) {
    animation: ll-postcard-in var(--ll-anim-duration) ease-out;
  }

  @keyframes ll-postcard-in {
    from { transform: translateY(var(--ll-anim-slide)); opacity: 0; }
    to   { transform: translateY(0);                    opacity: 1; }
  }

  @keyframes ll-postcard-out {
    from { transform: translateY(0);                    opacity: 1; }
    to   { transform: translateY(var(--ll-anim-slide)); opacity: 0; }
  }

  #ll-postcard.ll-postcard-hiding {
    animation: ll-postcard-out var(--ll-anim-duration) ease-out forwards;
  }

  .ll-postcard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .ll-topic-pill {
    background: var(--ll-accent-bg);
    border: 1px solid var(--ll-accent-border);
    color: var(--ll-accent);
    border-radius: var(--ll-pill-radius);
    padding: 2px 10px;
    font-size: var(--ll-font-size-pill);
    font-family: var(--ll-font);
  }

  .ll-postcard-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .ll-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--ll-accent);
    font-family: var(--ll-font);
    font-size: var(--ll-font-size-meta);
    padding: 2px 4px;
  }

  .ll-pull-quote {
    color: var(--ll-text-primary);
    font-size: var(--ll-font-size-quote);
    font-style: italic;
    line-height: var(--ll-line-height);
    margin: 0 0 8px 0;
  }

  .ll-source {
    color: var(--ll-text-secondary);
    font-size: var(--ll-font-size-meta);
    margin: 0 0 12px 0;
  }

  .ll-postcard-footer {
    display: flex;
    justify-content: flex-end;
  }
`;
```

- [ ] **Step 2: Create the postcard div and append to shadow DOM**

Find line 147:
```javascript
shadow.appendChild(chip);
```

Immediately after it, add:

```javascript
// Create postcard — injected at load time with .hidden; shown/hidden by showPostcard/hidePostcard
const postcard = document.createElement('div');
postcard.id = 'll-postcard';
postcard.className = 'hidden';
postcard.innerHTML = `
  <div class="ll-postcard-header">
    <span class="ll-topic-pill">● <span id="ll-pc-topic"></span></span>
    <div class="ll-postcard-actions">
      <button id="ll-btn-mute" class="ll-btn">🔇 Mute</button>
      <button id="ll-btn-dismiss" class="ll-btn">✕</button>
    </div>
  </div>
  <p id="ll-pc-quote" class="ll-pull-quote"></p>
  <p id="ll-pc-source" class="ll-source"></p>
  <div class="ll-postcard-footer">
    <button id="ll-btn-save" class="ll-btn">🔖 Save</button>
  </div>
`;
shadow.appendChild(postcard);
```

- [ ] **Step 3: Reload extension and verify the postcard DOM exists**

Load the extension in Chrome. Navigate to a supported page (e.g. a Notion page or `docs.google.com`). Open DevTools → Elements → find the `#lenny-live-root` shadow host → expand shadow root. Confirm `#ll-postcard` exists with `class="hidden"`. The card should be invisible — `.hidden { display: none }` hides it.

- [ ] **Step 4: Commit**

```bash
git add content/content-script.js
git commit -m "feat: inject postcard CSS (CSS vars) + HTML skeleton into shadow DOM"
```

---

## Task 6: Implement postcard logic — `showPostcard`, `hidePostcard`, `playAudio`, mute toggle, save

**Files:**
- Modify: `content/content-script.js` — add new `// ─── Postcard ───` section after the existing `// ─── UI Helper Functions ───` section (after `showBuzzwordChip`, before `// ─── State Machine ───`)

---

- [ ] **Step 1: Add the postcard logic block**

Find the line `// ─── State Machine ────────────────────────────────────────────────────────` (currently around line 192). Insert the entire block below **immediately before** it:

```javascript
// ─── Postcard ─────────────────────────────────────────────────────────────────

let autoDismissTimer = null;
let currentInsight = null; // held for Save button

function showPostcard(insight) {
  currentInsight = insight;
  const pc = shadow.getElementById('ll-postcard');

  // Populate content
  shadow.getElementById('ll-pc-topic').textContent = insight.topic;
  shadow.getElementById('ll-pc-quote').textContent = insight.pull_quote;
  shadow.getElementById('ll-pc-source').textContent =
    `${insight.guest_name} · ${insight.episode_title}`;

  // Set mute default synchronously so audio guard works even before storage returns
  pc.dataset.muted = 'false';
  updateMuteButton(false);

  // Update from persisted preference (async — completes long before AUDIO arrives)
  chrome.storage.local.get(['voiceMuted'], (result) => {
    if (chrome.runtime.lastError) return;
    const muted = !!result.voiceMuted;
    pc.dataset.muted = String(muted);
    updateMuteButton(muted);
  });

  // Show card and start auto-dismiss
  pc.classList.remove('hidden');
  clearTimeout(autoDismissTimer);
  autoDismissTimer = setTimeout(hidePostcard, 30000);
}

function hidePostcard() {
  clearTimeout(autoDismissTimer);
  const pc = shadow.getElementById('ll-postcard');
  if (pc.classList.contains('hidden')) return; // already hidden — no-op
  pc.classList.add('ll-postcard-hiding');
  // Duration must match --ll-anim-duration (0.2s = 200ms)
  // If you change --ll-anim-duration, update this timeout to match.
  setTimeout(() => {
    pc.classList.remove('ll-postcard-hiding');
    pc.classList.add('hidden');
  }, 200);
}

function updateMuteButton(muted) {
  const btn = shadow.getElementById('ll-btn-mute');
  if (btn) btn.textContent = muted ? '🔊 Unmute' : '🔇 Mute';
}

function playAudio(base64) {
  const pc = shadow.getElementById('ll-postcard');
  if (pc && pc.dataset.muted === 'true') return;
  const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
  audio.play().catch(err =>
    console.warn('[LennyLive] Audio playback failed:', err.message)
  );
}

// ─── Postcard Event Listeners (set up once at load time) ──────────────────────

shadow.getElementById('ll-postcard').addEventListener('mouseenter', () => {
  clearTimeout(autoDismissTimer);
});

shadow.getElementById('ll-postcard').addEventListener('mouseleave', () => {
  clearTimeout(autoDismissTimer);
  autoDismissTimer = setTimeout(hidePostcard, 30000);
});

shadow.getElementById('ll-btn-dismiss').addEventListener('click', () => {
  clearTimeout(autoDismissTimer);
  hidePostcard();
});

shadow.getElementById('ll-btn-mute').addEventListener('click', () => {
  const pc = shadow.getElementById('ll-postcard');
  const newMuted = pc.dataset.muted !== 'true';
  pc.dataset.muted = String(newMuted);
  updateMuteButton(newMuted);
  chrome.storage.local.set({ voiceMuted: newMuted }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[LennyLive] voiceMuted save failed:', chrome.runtime.lastError.message);
    }
  });
});

shadow.getElementById('ll-btn-save').addEventListener('click', () => {
  if (!currentInsight) return;
  const entry = {
    topic:         currentInsight.topic,
    pull_quote:    currentInsight.pull_quote,
    guest_name:    currentInsight.guest_name,
    episode_title: currentInsight.episode_title,
    youtube_url:   currentInsight.youtube_url,
    saved_at:      new Date().toISOString(),
  };
  // Read-modify-write to avoid overwriting concurrent saves
  chrome.storage.local.get(['savedInsights'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('[LennyLive] Save read failed:', chrome.runtime.lastError.message);
      return;
    }
    const existing = result.savedInsights || [];
    existing.push(entry);
    chrome.storage.local.set({ savedInsights: existing }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[LennyLive] Save write failed:', chrome.runtime.lastError.message);
      } else {
        console.log('[LennyLive] Insight saved:', entry.topic);
      }
    });
  });
});
```

- [ ] **Step 2: Verify event listeners attach without error**

Reload the extension. Navigate to a supported page. Open DevTools → Console (page context, not service worker). There should be no errors. If you see `Cannot read properties of null (reading 'addEventListener')`, the postcard HTML from Task 5 wasn't injected correctly — check that `shadow.appendChild(postcard)` runs before this section.

- [ ] **Step 3: Commit**

```bash
git add content/content-script.js
git commit -m "feat: add showPostcard, hidePostcard, playAudio, mute toggle, save logic"
```

---

## Task 7: Update `handleResponse`, extend `onMessage`, fix `cancelLennyLive` bug

**Files:**
- Modify: `content/content-script.js:259-268` — fix `cancelLennyLive` (missing `clearTimeout(processingTimeout)`)
- Modify: `content/content-script.js:298-318` — update `handleResponse` to call `showPostcard`
- Modify: `content/content-script.js:321-326` — extend `onMessage` listener with `AUDIO` branch

---

- [ ] **Step 1: Fix the `cancelLennyLive` bug — add missing `clearTimeout(processingTimeout)`**

Find `cancelLennyLive` (around line 259):
```javascript
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
```

Change it to:
```javascript
function cancelLennyLive() {
  state = 'idle';
  clearTimeout(timerA);
  clearTimeout(timerB);
  clearTimeout(processingTimeout); // fix: was missing — could leave ghost timeout
  if (typeof recognition !== 'undefined' && recognition) {
    try { recognition.abort(); } catch (_) {}
  }
  hideIndicator();
  console.log('[LennyLive] Cancelled — returned to idle');
}
```

- [ ] **Step 2: Update `handleResponse` to call `showPostcard`**

Find `handleResponse` (around line 298). Replace the entire function:

```javascript
function handleResponse(message) {
  // Cancel the safety timeout — real response arrived
  clearTimeout(processingTimeout);
  state = 'idle';
  hideIndicator();

  if (message.status === 'ok' && message.insight) {
    showPostcard(message.insight);
  } else if (message.status === 'no_results') {
    console.log('[LennyLive] No results found for query');
  } else {
    console.warn('[LennyLive] RAG error or null insight:', message.status);
  }
}
```

The old function body had a `chrome.storage.local.set({ lastTopic: ... })` call — `showPostcard` no longer needs it (topic is populated directly from insight). Remove it.

> **Note:** Removing this write means voice-query-triggered sessions no longer update `lastTopic` in storage. Only buzzword scans (in `scanForBuzzwords`) will still write `lastTopic`. If `popup.js` reads this key to display the last topic, it will only reflect buzzword-triggered topics after this change — this is acceptable for Sub-project 3 scope.

- [ ] **Step 3: Extend `onMessage` listener with AUDIO branch**

Find the existing `onMessage` listener (around line 321):
```javascript
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESPONSE') {
    handleResponse(message);
  }
  // Return nothing (no return true) — we never send a response back to the SW
});
```

Replace it with:
```javascript
// Single onMessage listener — handles both RESPONSE (Push 1) and AUDIO (Push 2)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESPONSE') { handleResponse(message); }
  if (message.type === 'AUDIO')    { playAudio(message.audio); }
  // Return nothing (no return true) — we never send a response back to the SW
});
```

- [ ] **Step 4: Reload extension and confirm no errors**

Reload the extension. Open DevTools console on a supported page. Confirm no errors on load.

- [ ] **Step 5: Commit**

```bash
git add content/content-script.js
git commit -m "feat: wire handleResponse→showPostcard, add AUDIO onMessage, fix cancelLennyLive bug"
```

---

## Task 8: End-to-end verification

No code changes. Systematic manual verification against all spec criteria.

---

- [ ] **Step 1: Reload extension fresh**

In `chrome://extensions`, click the reload ↺ icon on Lenny Live. Then hard-refresh the test page (`Cmd+Shift+R`).

- [ ] **Step 2: Verify criterion 1 — postcard appears with correct content**

Double-tap Ctrl → speak a PM query (e.g. "how do I improve retention?") → after 1–3s, a postcard should appear in the bottom-right with:
- Topic pill showing the topic (e.g. "Retention")
- Pull quote in italic
- Guest name · Episode title below the quote
- 🔇 Mute, ✕, and 🔖 Save buttons

If postcard doesn't appear: open service worker DevTools and check for errors. Common cause: stale content script — hard-refresh the page.

- [ ] **Step 3: Verify criterion 2 — voice plays within ~3s of postcard**

After postcard appears, within ~3 seconds Lenny's voice should read the pull quote aloud. If no audio: check service worker console for `TTS skipped` or `ElevenLabs TTS failed`. If you see a 401, the API key in `config.js` is wrong.

- [ ] **Step 4: Verify criterion 3 — mute toggle persists**

Click 🔇 Mute → button should change to 🔊 Unmute. Dismiss postcard. Trigger another query. Postcard shows, no voice plays. Button should open as 🔊 Unmute. Refresh page → trigger again → still muted. Then click 🔊 Unmute → voice plays on next activation.

- [ ] **Step 5: Verify criterion 4 — hover pauses 30s timer**

Trigger a query. When postcard appears, immediately hover over it. Wait 35 seconds — postcard should NOT dismiss while hovering. Move mouse off — postcard should start 30s countdown from zero (dismiss 30s after mouse leaves).

- [ ] **Step 6: Verify criterion 5 — auto-dismiss after 30s**

Trigger a query. Keep mouse off the postcard. After 30 seconds, postcard should slide down + fade out.

- [ ] **Step 7: Verify criterion 6 — ✕ dismisses immediately**

Trigger a query. Click ✕ → postcard should slide out immediately with exit animation.

- [ ] **Step 8: Verify criterion 7 — Save button writes to storage**

Trigger a query. Click 🔖 Save. Open DevTools console and run:

```javascript
chrome.storage.local.get(['savedInsights'], console.log);
```

Expected: `{savedInsights: [{topic, pull_quote, guest_name, episode_title, youtube_url, saved_at}]}` — one entry with all fields populated.

- [ ] **Step 9: Verify criterion 8 — postcard shows even if voice fails**

Trigger a query. After postcard renders, it should show regardless of TTS result. To test TTS failure: temporarily put an invalid API key in `config.js`, reload extension, trigger — postcard should appear with `TTS skipped` in service worker console. Restore the real key after.

- [ ] **Step 10: Verify criterion 9 — non-PM query is silent**

Trigger a query with non-PM content (e.g. "what is the weather today?"). No postcard, no voice — loading indicator disappears, nothing else happens.

- [ ] **Step 11: Final commit if any cleanup was done**

```bash
git add -p  # review any stray changes
git commit -m "fix: cleanup from E2E verification"
```

---

## Done

All 9 verification criteria pass → Sub-project 3 complete.

**What was built:**
- `background/tts.js` — ElevenLabs TTS integration with base64 encoding
- Service worker now runs two-push model: RAG result (immediate) + audio (fire-and-forget, 3s timeout)
- Floating postcard in shadow DOM with CSS variable theme config block
- Auto-dismiss (30s), hover-pause, manual dismiss, mute toggle persisted in storage
- Save button writes to `savedInsights` array in `chrome.storage.local`
- `cancelLennyLive` bug fixed

**Next:** Sub-project 4 — Supabase `saved_insights` sync + gamification (streaks, scores, library).
