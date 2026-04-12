# Widget Onboarding — Design Spec
**Date:** 2026-04-12
**Status:** Approved

---

## Problem

The onboarding experience was implemented as a 3-slide carousel inside the toolbar popup. This approach had two fatal flaws: (1) the popup tears down on focus loss, making the carousel impossible to inspect or debug; (2) seeing slides in the popup before the widget ruins the "magic moment" when onboarding appears contextually inside the page.

---

## Solution

Move onboarding into the shadow DOM widget (content script), triggered by the user's first PM-relevant text highlight. The onboarding doubles as a loading state — the RAG query fires in the background the moment onboarding appears, so the insight is instantly ready when the user dismisses it.

The popup reverts to a clean dashboard with a well-designed empty state.

---

## Trigger & Data Flow

**Trigger condition:**
- User highlights text that matches `PM_ROOTS` regex on any page
- `chrome.storage.local` key `hasOnboarded` is `false` or `undefined`
- Instead of showing the selection dot → show the onboarding panel

**Background RAG — fires the moment onboarding appears:**
- Same message as a normal selection dot query:
  `chrome.runtime.sendMessage({ type: 'QUERY', transcript: '', selection: selectedText, pageContext: '' })`
- Result held in a module-level variable: `let pendingOnboardingResult = null`
- The `chrome.runtime.onMessage` handler stores RESPONSE/AUDIO into `pendingOnboardingResult` when `isOnboarding === true`

**On dismiss (Get Started, Skip, or ✕):**
1. Set `hasOnboarded: true` in `chrome.storage.local`
2. Set `isOnboarding = false`
3. Hide the onboarding panel
4. If `pendingOnboardingResult` has a valid insight → call `showPostcard()` immediately
5. If result still loading → show the normal "Lenny is thinking…" indicator; postcard follows when the RESPONSE message arrives
6. If no result / error → dismiss cleanly, no error shown (user is brand new)
7. All future highlights behave normally — selection dot returns

---

## Panel Design

**Container:** 320px, bottom-right, same position as the postcard. Same slide-up enter animation (`ll-postcard-in`). Same `#fdfcf6` background, orange accent, border, shadow. Reuses postcard CSS variables.

### Slide 1 — Loading state

- **Header:** `lennyLive` logo (italic serif) + ✕ dismiss button
- **Visual:** Large animated orange pulse dot (same as badge dot animation)
- **Headline:** "Lenny is finding something." (serif, 18px)
- **Body:** "You highlighted text about **[concept pill]**. Lenny is matching it to real stories from 300+ product leaders."
  - Concept pill: amber pill using existing `.pc-topic` style, populated from the PM_ROOTS match (extract the matched stem and display a human-readable label)
  - If no clean concept label available: omit the pill, body reads "You highlighted some text. Lenny is matching it…"
- **Footer:** Progress dots (dot 1 active) + `Next →` button

### Slide 2 — Teach double-tap Ctrl

- **Header:** `lennyLive` logo + ✕ dismiss
- **Visual:** Keyboard mock — `[Ctrl]` `+` `[Ctrl]` keys, "double-tap to activate" label below (same style as popup keyboard mock)
- **Headline:** "Ask Lenny anything." (serif, 18px)
- **Body:** "Double-tap Ctrl, speak your question, and Lenny responds in seconds — grounded in real guest stories and episodes."
- **Note:** Small bordered callout: "Chrome will ask for microphone access. This lets Lenny hear your question."
- **Footer:** Progress dots (dot 2 active) + `Skip` text link + `Get Started →` primary button

**Dismiss behaviour (✕ on either slide):** Same as Skip — sets `hasOnboarded`, fires postcard if result ready.

---

## Popup Changes

### Remove entirely
- 3-slide carousel HTML from `popup.html`
- All onboarding JS from `popup.js` (showSlide, finishOnboarding, dot click handlers, storage check for hasOnboarded)
- `#main-content` wrapper div (no longer needed — popup always shows its content)
- All onboarding CSS from `popup.css` (`.onboarding`, `.ob-*` rules)

### Empty state redesign
When `savedInsights` is empty or undefined, the `#saved-list` area shows:

```
┌──────────────────────────────────────┐
│  Highlight any text on a webpage     │
│  to get your first Lenny insight.    │
│  Then hit 🔖 to save it here.        │
└──────────────────────────────────────┘
```

Styled as a soft-bordered card, italic serif body text, "Highlight" in orange to draw the eye. No buttons. No carousel. One clear prompt.

Everything else in the popup is unchanged — streak, score, mute toggle, saved insights list once populated.

---

## Storage

| Key | Type | Set by | Meaning |
|---|---|---|---|
| `hasOnboarded` | boolean | Widget onboarding dismiss | Controls whether onboarding fires on next highlight |

No other storage changes. Existing keys (`streak`, `knowledge_score`, `savedInsights`, `voiceMuted`) are unaffected.

---

## State Variables (content-script.js additions)

```javascript
let isOnboarding = false;              // true while onboarding panel is visible
let onboardingCancelled = false;       // true if voice mode fired during onboarding — discard pending RAG result
let pendingOnboardingResult = null;    // { insight, relatedInsights } or null
let onboardingSelection = '';          // selected text captured at highlight time — stored before selection can be cleared
```

`isOnboarding = true` blocks the normal RESPONSE handler from calling `showPostcard()` directly — result is buffered into `pendingOnboardingResult` instead.

---

## Architectural Requirements (Mandatory)

### 1. Capture selection text immediately (Selection Loss Trap)

The postcard is `position: fixed` bottom-right and does not anchor to selection coordinates. However, `window.getSelection()` is cleared the moment the user clicks anywhere on the page (e.g., to click "Next →" on the onboarding panel). The `selectedText` string must be stored in `onboardingSelection` at the moment the highlight is detected — before RAG fires, before the onboarding panel appears.

```javascript
// In selectionchange handler, before firing RAG:
onboardingSelection = selectedText; // store immediately
chrome.runtime.sendMessage({ type: 'QUERY', transcript: '', selection: onboardingSelection, pageContext: '' });
```

`onboardingSelection` is cleared to `''` when onboarding is fully dismissed.

### 2. Cancel pending RAG if voice mode fires (Voice Activation Race)

If the user triggers double-tap Ctrl while `isOnboarding === true`:
1. Set `onboardingCancelled = true`
2. Dismiss the onboarding panel (no postcard)
3. Proceed with voice activation normally

In the `chrome.runtime.onMessage` RESPONSE handler:
```javascript
if (isOnboarding) {
  // Buffer result — onboarding still visible
  pendingOnboardingResult = { insight: message.insight, relatedInsights: message.relatedInsights };
  return;
}
if (onboardingCancelled) {
  // Voice mode took over — silently discard this text RAG result
  onboardingCancelled = false;
  return;
}
```

This prevents the text RAG result from colliding with an active voice session UI.

### 3. Guard selectionchange while onboarding is open (Double-Selection Concurrency)

The `selectionchange` listener must return immediately if onboarding is already visible:

```javascript
document.addEventListener('selectionchange', () => {
  if (isOnboarding) return; // prevent duplicate queries or re-triggering UI
  // ... rest of handler
});
```

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| RAG returns no results | Onboarding dismisses cleanly, no postcard, no error |
| RAG errors (network) | Same as no results — silent during onboarding |
| User dismisses before RAG completes | `isOnboarding = false`; when RESPONSE arrives, `showPostcard()` fires normally |
| User highlights non-PM text (PM_ROOTS no match) | Normal behaviour — no onboarding trigger, no selection dot |
| User triggers double-tap Ctrl during onboarding | `onboardingCancelled = true`; panel dismissed; text RAG result silently discarded when it arrives; voice activation proceeds |
| User clicks page (clears selection) during onboarding | Safe — `onboardingSelection` already captured; RAG already fired with correct text |
| User highlights new text while onboarding open | `selectionchange` guard fires `return` immediately — no duplicate query, no UI re-trigger |

---

## Files Changed

| File | Change |
|---|---|
| `content/content-script.js` | Add onboarding panel HTML/CSS into shadow DOM; add trigger logic in selectionchange handler; add `isOnboarding` state; buffer RESPONSE during onboarding |
| `popup/popup.html` | Remove carousel + `#main-content` wrapper; restore plain structure |
| `popup/popup.js` | Remove all onboarding logic; update empty state copy |
| `popup/popup.css` | Remove all `.ob-*` and `.onboarding` rules; add empty state card style |
