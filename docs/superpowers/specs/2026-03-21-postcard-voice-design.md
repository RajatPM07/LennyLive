# Sub-Project 3: Postcard UI + Voice Integration Design Spec

**Date:** 2026-03-21
**Author:** Rajat Sharma
**Status:** Approved

---

## Overview

Sub-project 3 makes the RAG result visible and audible to the user. When an insight is found, a floating postcard appears in the bottom-right corner of the page displaying the pull quote, guest, and episode. Simultaneously, Lenny's cloned ElevenLabs voice reads the pull quote aloud. Voice is mutable and persists across sessions. The postcard auto-dismisses after 30 seconds, pausing the timer if the user hovers.

**Goal:** Turn `console.log('[LennyLive] Insight received:')` into a visible postcard + audible voice response.

---

## Architecture

### Two-Push Model

The service worker sends two separate messages to the content script:

1. **Push 1 — `RESPONSE`:** Sent immediately after RAG completes (~1–2s). Contains the insight object. Content script renders the postcard on receipt.
2. **Push 2 — `AUDIO`:** Sent when TTS completes. Contains base64-encoded MP3. Content script plays audio on receipt (if not muted). May never arrive if TTS times out or fails — postcard remains unaffected.

This ensures the postcard appears as fast as possible (RAG time only), with audio following naturally rather than gating the visual.

```
User activates
      ↓
Service worker: RAG pipeline (~1–2s)
      ↓
Push 1 → RESPONSE { status, insight }   ← postcard renders
      ↓
Service worker: TTS call (3s hard timeout)
      ↓
Push 2 → AUDIO { audio: base64 }        ← audio plays (if not muted)
     (or nothing if TTS times out — postcard already showing)
```

### 3-Second TTS Timeout

The TTS call races against a 3-second `setTimeout` via `Promise.race`. If TTS wins: Push 2 is sent with audio. If timeout wins: the `.catch()` logs a warning and Push 2 is never sent. The service worker never awaits TTS — it is fire-and-forget after Push 1.

The following code is added to `handleQuery` in `service-worker.js`, **after** the existing `pushResponse(tabId, { type: 'RESPONSE', status: 'ok', insight })` call. `pushResponse` is the existing helper already defined in that file.

```javascript
// After Push 1 — fire-and-forget TTS race (no await)
const ttsTimeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('TTS timeout (3s)')), 3000)
);
Promise.race([fetchTTS(insight.pull_quote), ttsTimeout])
  .then(audio => pushResponse(tabId, { type: 'AUDIO', audio }))
  .catch(err => console.warn('[LennyLive] TTS skipped:', err.message));
```

---

## File Structure

### New Files

**`background/tts.js`**
- Named export `fetchTTS(text)` — calls ElevenLabs TTS REST API
- Imports `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` from `./config.js` at module level
- Returns base64-encoded MP3 string
- Throws on non-2xx with response body in message

```javascript
// background/tts.js
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
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary); // base64-encoded MP3
}
```

### Modified Files

**`background/config.js`** (gitignored)
- Add `ELEVENLABS_API_KEY` (from `.env`)
- Add `ELEVENLABS_VOICE_ID` (from `.env` — currently `cjVigY5qzO86Huf0OWal`)

**`background/config.js.example`** (committed)
- Add placeholder entries for `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`

**`manifest.json`**
- Add `"https://api.elevenlabs.io/*"` to the `host_permissions` array **only** — required for `fetchTTS` to make network requests from the service worker under MV3 CSP
- Do NOT add it to `content_scripts[].matches` — that array controls which pages get the content script injected and must remain limited to PM tool URLs. After this change the two arrays are intentionally no longer in sync.
- `"storage"` is already in `permissions` — no change needed
- `"type": "module"` is already set on the background declaration — ES module `import` syntax works as-is

**`background/service-worker.js`**
- Add `import { fetchTTS } from './tts.js';` at the top (ES module syntax — already valid because `manifest.json` declares `"type": "module"`)
- After Push 1, start TTS race (fire-and-forget — no `await`)
- Push 2 sent inside `.then()` callback after TTS resolves

**`content/content-script.js`**
- Add postcard HTML + CSS to existing shadow DOM (CSS appended to the **existing** `<style>` element inside the shadow root; no new `<style>` tag created)
- Add `showPostcard(insight)`, `hidePostcard()` functions
- Add `playAudio(base64)` function
- **Extend the existing `chrome.runtime.onMessage` listener** (do NOT add a second listener): add `AUDIO` branch alongside the existing `RESPONSE` branch
- Add mute toggle logic reading/writing `voiceMuted` in `chrome.storage.local`

```javascript
// Extend the existing onMessage listener — add the AUDIO branch:
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESPONSE') { handleResponse(message); }
  if (message.type === 'AUDIO')    { playAudio(message.audio); }  // NEW
});
```

---

## API Integration: ElevenLabs TTS

**Endpoint:** `https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}`

**Method:** POST

**Headers:**
```
xi-api-key: {ELEVENLABS_API_KEY}
Content-Type: application/json
```

**Request body:**
```json
{
  "text": "<pull_quote>",
  "model_id": "eleven_turbo_v2",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}
```

**Model rationale:** `eleven_turbo_v2` is the lowest-latency ElevenLabs model (~500ms for short texts). Prioritises speed over maximum quality — appropriate for ambient ambient insights.

**Response:** Binary MP3 audio stream (`Content-Type: audio/mpeg`).

**Processing:** Read as `ArrayBuffer` → `Uint8Array` → binary string → `btoa()` → base64 string. Passed in Push 2 message as `message.audio`.

**Error handling:** Throws on non-2xx. Caught by `Promise.race` `.catch()` — TTS failure never blocks Push 1 or the postcard.

---

## Message Protocol Updates

### Push 1: RESPONSE (unchanged shape, extended usage)
```javascript
// service-worker → content-script
{
  type: 'RESPONSE',
  status: 'ok' | 'no_results' | 'error',
  insight: InsightObject | null
}
```
No change to the existing RESPONSE message shape. Content script now renders postcard instead of just logging.

### Push 2: AUDIO (new)
```javascript
// service-worker → content-script
{
  type: 'AUDIO',
  audio: string  // base64-encoded MP3
}
```
Only sent if TTS succeeds within 3s. Never sent on TTS failure or timeout.

---

## Postcard UI

### Visual Structure (low-fidelity)

```
┌─────────────────────────────────────┐
│ ● Retention              [🔇] [✕] │  ← topic pill, mute, dismiss
│                                     │
│ "Distribution beats product         │  ← pull_quote (italic)
│  in early GTM"                      │
│                                     │
│ Naomi Gleit · How to Build a        │  ← guest_name · episode_title
│ Growth Machine                      │
│                                     │
│                        [🔖 Save]   │  ← right-aligned
└─────────────────────────────────────┘
```

### Postcard Element

The postcard is a `<div id="ll-postcard" class="hidden">` injected into the shadow DOM **at content script load time** (not on first activation). It is always present in the DOM; visibility is controlled by toggling the `.hidden` class.

```css
#ll-postcard.hidden { display: none; }
```

It carries a `data-muted` attribute (`"true"` or `"false"`) for mute state, populated when `showPostcard` runs.

### Position and Sizing

- `position: fixed; bottom: 32px; right: 32px` — same corner as existing indicator
- `width: 320px` — fixed
- `z-index: 2147483647` — above all page content (matches existing convention)
- `pointer-events: auto` — card is interactive (unlike `pointer-events: none` on indicator)
- Indicator (`#ll-indicator`) is hidden before postcard is shown — they share the same corner

### Styling — CSS Variables (theme config block)

All visual tokens are defined as CSS custom properties on `#ll-postcard` at the **top** of the CSS appended to the shadow DOM `<style>` element. This is the single block to edit when polishing the visual design — nothing else in the stylesheet uses hardcoded values for these tokens.

```css
/* ─── LennyLive Postcard Theme Config ─────────────────────────── */
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
```

All subsequent CSS rules reference these variables. Examples:

```css
#ll-postcard {
  background:    var(--ll-bg);
  border:        1px solid var(--ll-border);
  border-radius: var(--ll-border-radius);
  font-family:   var(--ll-font);
  padding:       var(--ll-padding);
  width:         var(--ll-width);
}

.ll-topic-pill {
  background:    var(--ll-accent-bg);
  border:        1px solid var(--ll-accent-border);
  color:         var(--ll-accent);
  border-radius: var(--ll-pill-radius);
  padding:       2px 10px;
  font-size:     var(--ll-font-size-pill);
}

.ll-pull-quote {
  color:       var(--ll-text-primary);
  font-size:   var(--ll-font-size-quote);
  font-style:  italic;
  line-height: var(--ll-line-height);
}

.ll-source {
  color:     var(--ll-text-secondary);
  font-size: var(--ll-font-size-meta);
}

.ll-btn {
  color: var(--ll-accent);
}
```

### Entry Animation

Slide up from below + fade in:

```css
@keyframes ll-postcard-in {
  from { transform: translateY(var(--ll-anim-slide)); opacity: 0; }
  to   { transform: translateY(0);                   opacity: 1; }
}

#ll-postcard:not(.hidden):not(.ll-postcard-hiding) {
  animation: ll-postcard-in var(--ll-anim-duration) ease-out;
}
```

### Exit Animation

Slide down + fade out triggered by adding class `.ll-postcard-hiding`. After the duration stored in `--ll-anim-duration` (200ms), `.hidden` is added and `.ll-postcard-hiding` is removed:

```css
@keyframes ll-postcard-out {
  from { transform: translateY(0);                   opacity: 1; }
  to   { transform: translateY(var(--ll-anim-slide)); opacity: 0; }
}

#ll-postcard.ll-postcard-hiding {
  animation: ll-postcard-out var(--ll-anim-duration) ease-out forwards;
}
```

`hidePostcard()` adds `.ll-postcard-hiding`, then after **200ms** adds `.hidden` and removes `.ll-postcard-hiding`.

**Note:** The 200ms `setTimeout` in `hidePostcard()` is hardcoded in JS to match `--ll-anim-duration`. If the duration variable is changed, update the JS timeout to match.

---

## Postcard Lifecycle

### Show
1. `handleResponse(message)` receives `status: 'ok'` with insight
2. Calls `showPostcard(insight)`:
   - Populates topic, pull_quote, guest_name, episode_title into DOM
   - Removes `.hidden` class, triggers entry animation
   - Hides `#ll-indicator` (already in idle state by this point)
   - Starts 30s auto-dismiss timer: `autoDismissTimer = setTimeout(hidePostcard, 30000)`
3. Reads `voiceMuted` from `chrome.storage.local` asynchronously. To avoid blocking the animation:
   - Synchronously set `data-muted="false"` on `#ll-postcard` as a default before the storage call
   - Start entry animation and 30s timer immediately (do not wait for storage)
   - In the `chrome.storage.local.get` callback: update `data-muted` and mute button label to the stored value
   - Since `AUDIO` arrives 1–3 seconds after activation and storage reads complete in <50ms, the attribute will be correct before audio playback in the overwhelming majority of cases. The residual race (muted user hears one word before storage resolves) is acceptable for this sub-project.

### Auto-Dismiss Pause on Hover
- `mouseenter` on postcard → `clearTimeout(autoDismissTimer)`
- `mouseleave` → restart **full 30 seconds** from zero: `autoDismissTimer = setTimeout(hidePostcard, 30000)`
- Rationale: user was reading — give them the full window after they stop hovering, not the remaining fraction

### Dismiss (manual)
- Click `[✕]` button → `clearTimeout(autoDismissTimer)` → `hidePostcard()`

### Hide
`hidePostcard()`:
1. Adds `.ll-postcard-hiding` class to `#ll-postcard` (triggers exit animation)
2. After `200ms` (animation duration): adds `.hidden` class, removes `.ll-postcard-hiding` class
3. Clears `autoDismissTimer` (safety — in case called while timer is running)

**DOM state after hide:** Text content fields (topic, pull_quote, guest, episode) are left populated — `showPostcard` always overwrites them on the next activation. `data-muted` is NOT reset here — it is always re-read from `chrome.storage.local` inside `showPostcard` on the next activation.

---

## Audio Playback

### `playAudio(base64)`

```javascript
function playAudio(base64) {
  const postcard = shadowRoot.querySelector('#ll-postcard');
  if (postcard && postcard.dataset.muted === 'true') return;
  const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
  audio.play().catch(err =>
    console.warn('[LennyLive] Audio playback failed:', err.message)
  );
}
```

Called by `onMessage` listener when `message.type === 'AUDIO'` arrives. If `AUDIO` arrives before postcard is visible (edge case: very fast TTS), it plays anyway — audio and postcard are decoupled.

### Autoplay Note

The double-tap Ctrl activation is a user gesture. Chrome's autoplay policy allows audio playback within a browsing context that has received recent user interaction. Since the AUDIO message typically arrives 1–3 seconds after the user gesture, autoplay should succeed. If it fails (e.g., page hasn't had interaction), `.play()` rejects and the `.catch()` logs a warning — silent fallback.

---

## Mute Toggle

### State

- Stored in `chrome.storage.local` as `voiceMuted: boolean`
- Loaded once when postcard renders, cached on postcard DOM element as `data-muted="true|false"`
- Default: `false` (voice on)

### Button Behaviour

The mute button is **always visible** regardless of whether TTS audio arrived. It controls the preference for future activations.

Icon convention: the button shows the **action** the user can take (not the current state):
- If `voiceMuted === false` (voice is on): button shows **🔇 Mute** — clicking will mute
- If `voiceMuted === true` (voice is off): button shows **🔊 Unmute** — clicking will unmute

Click: toggle value → persist to `chrome.storage.local` → update button label → update `data-muted` attribute on `#ll-postcard`

### Effect on Playback

`playAudio()` reads `data-muted` attribute at call time. If `true`, returns immediately without playing. This means:
- If user mutes AFTER `AUDIO` message arrives: audio has already played (or failed). Mute takes effect on next activation.
- If user mutes BEFORE `AUDIO` message arrives: audio is skipped on this activation.

---

## Save Behaviour

Clicking `[🔖 Save]` appends an entry to the `savedInsights` array in `chrome.storage.local`. No Supabase write in this sub-project (deferred to Sub-project 4).

**Exact save object shape:**
```javascript
{
  topic:       insight.topic,         // string
  pull_quote:  insight.pull_quote,    // string
  guest_name:  insight.guest_name,    // string
  episode_title: insight.episode_title, // string
  youtube_url: insight.youtube_url,   // string
  saved_at:    new Date().toISOString() // ISO 8601 string
}
```

**Array-append pattern (read-modify-write):**
```javascript
chrome.storage.local.get(['savedInsights'], (result) => {
  const existing = result.savedInsights || [];
  existing.push(saveEntry);
  chrome.storage.local.set({ savedInsights: existing }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[LennyLive] Save failed:', chrome.runtime.lastError.message);
    }
  });
});
```

Duplicate saves (same pull_quote) are allowed in this sub-project — deduplication deferred to Sub-project 4.

---

## Error States and Silent Failures

| Scenario | Behaviour |
|---|---|
| `status: 'no_results'` | Postcard does NOT show. Indicator hides. Silent. |
| `status: 'error'` | Postcard does NOT show. Indicator hides. Console warn only. |
| TTS timeout (3s) | Push 2 never sent. Postcard shows without audio. Mute button still visible (controls preference for future activations). |
| TTS API error (non-2xx) | Same as timeout — caught by `.catch()`, Push 2 not sent. |
| `AUDIO` arrives after postcard dismissed | `playAudio` called — audio plays. Acceptable edge case (user dismissed quickly). Future: check postcard visibility before playing. |
| Audio autoplay blocked by browser | `.play()` rejects, `.catch()` logs warning. Silent fallback. |
| `chrome.storage.local` unavailable | `voiceMuted` defaults to `false`. Storage write errors logged via `chrome.runtime.lastError` check in callback. |

---

## What Sub-Project 3 Does NOT Include

- Supabase `saved_insights` table sync (Sub-project 4 — Save writes to `chrome.storage.local` only)
- Gamification (streaks, scores — Sub-project 4)
- Replay button (deferred — requires re-triggering TTS without re-running RAG; Sub-project 4)
- Full visual polish / production design (Sub-project 4 / post-competition)
- Selection review mode (Sub-project 4)

---

## Verification Criteria

1. Double-tap Ctrl → speak PM query → postcard appears in bottom-right with topic, pull_quote, guest, episode
2. Lenny's voice plays the pull_quote within ~3s of postcard appearing (or silently skipped if timeout)
3. Click 🔇 Mute → voice muted on next activation → button shows 🔊 Unmute → persists after page refresh
4. Hover over postcard → 30s timer pauses → move mouse away → timer restarts from 30s
5. Wait 30s without hovering → postcard slides out and disappears
6. Click ✕ → postcard dismisses immediately
7. Click 🔖 Save → `savedInsights` array in `chrome.storage.local` gains entry with topic, pull_quote, guest, episode, url
8. Disconnect internet mid-query → postcard shows insight (RAG already completed), no voice (TTS failed/timed out)
9. Non-PM query → no postcard, no voice, silent

---

## Dependencies

- Sub-project 2 (RAG pipeline) complete and verified ✅
- ElevenLabs API key in `background/config.js` (add `ELEVENLABS_API_KEY`)
- ElevenLabs voice ID in `background/config.js` (add `ELEVENLABS_VOICE_ID` — currently placeholder `cjVigY5qzO86Huf0OWal`)
- `eleven_turbo_v2` model available on the ElevenLabs account
