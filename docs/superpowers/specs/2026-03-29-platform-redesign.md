# Platform Redesign — Element-First Detection + Grammarly-Inspired UX

**Date:** 2026-03-29
**Status:** Brainstorm complete — ready to plan
**Author:** Rajat Sharma (brainstorm with Claude)

---

## Why This Exists

The current ambient detection architecture has two fundamental problems:

1. **URL-gating kills the demo.** `manifest.json` hardcodes 4 platforms. The extension is completely inert everywhere else. During a live demo with an early PM, the moment they open Slack or Gmail or any unlisted tool, the product doesn't exist.

2. **Write+pause activation is unreliable.** The current `keydown` listener fires globally but depends on `extractPageContext()` returning text with PM keywords — which often fails because Notion's active block is a single short sentence. This was partially fixed (two-level fallback to semantic container), but the root issue is that URL-gating and global listeners are the wrong primitives.

The redesign fixes both by making the detection **element-first** instead of **URL-first**.

---

## Positioning (Locked In)

This context underpins every design decision:

> **Tagline:** "Compounded experience. Borrowed intuition."

> **Core truth:** Senior PMs have gut instinct because they've lived this problem before. You haven't. Yet. Lenny Live gives you the compounded experience of 300 product leaders — borrowed as your intuition, arriving at the exact moment your brain is still inside the problem.

**What it's not:** Not a mentor (no memory, no relationship). Not a chatbot (you don't go to it). Not generated AI advice (100% real stories, real people, real episodes).

**Differentiation:** Grammarly checks your grammar. Lenny Live checks your thinking — and when it spots a PM pattern in what you're writing, it quietly surfaces who solved it before.

---

## The Core Shift: Element-First Detection

### Current model (URL-first)

```
manifest.json declares 4 URLs
→ Chrome injects content-script.js only on those URLs
→ Script attaches global keydown listener to document
→ isUserEditing() called on every keystroke to check if in a text field
```

Every new platform = code change + Chrome Web Store re-review.

### New model (element-first)

```
manifest.json uses <all_urls> (content scripts inject everywhere)
→ Script listens for focusin events on the document
→ When focus lands on a contenteditable or textarea: attach write+pause sensor to THAT element
→ When focus leaves: detach sensor
→ isUserEditing() becomes the attachment gate, not a runtime check
```

**Code shift:**

```js
// Current: global listener, runtime check
document.addEventListener('keydown', (e) => {
  if (e.key.length === 1 && isUserEditing()) {
    // ... write+pause logic
  }
});

// New: focusin/focusout gate
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (el.isContentEditable || el.matches('input, textarea')) {
    attachWritePauseSensor(el);
  }
});
document.addEventListener('focusout', () => {
  detachWritePauseSensor();
});
```

`isUserEditing()`, `triggerEagerFetch()`, `extractPageContext()`, `detectPMKeywordInText()` — all internal logic unchanged. Only where the listener lives changes.

### Platform coverage after this change

| Platform | Today | After redesign |
|---|---|---|
| Notion | ✓ | ✓ |
| Linear | ✓ | ✓ |
| Jira / Atlassian | ✓ | ✓ |
| Google Docs | ✓ (limited) | ✓ (limited — canvas, see exceptions) |
| Gmail | ✗ | ✓ |
| Slack | ✗ | ✓ |
| Discord | ✗ | ✓ |
| Microsoft Word online | ✗ | ✓ |
| Microsoft OneNote online | ✗ | ✓ |
| Substack, Craft, Confluence | ✗ | ✓ |

**Permanent exceptions:**
- **Google Docs / Sheets** — canvas renderer, no text node access. Fallback: clipboard intercept (`document.oncopy`) — PM highlights + copies text → treated as selection trigger. Frame explicitly: "On Google Docs, highlight + copy to ask Lenny."
- **Apple Notes** — native Mac app, Chrome extension boundary. Out of scope.
- **Microsoft Excel** — spreadsheet cells aren't writing contexts. Excluded by PM keyword filter.

---

## Permissions Strategy

**Problem:** `<all_urls>` shows users "This extension can read and change all your data on all websites" — trust-destroying for an unknown product.

**Solution:** Optional host permissions with warm onboarding.

```json
// manifest.json
"host_permissions": ["existing 4 platforms + ElevenLabs API"],
"optional_host_permissions": ["<all_urls>"]
```

Core 4 platforms always on. On first encounter with a new domain (e.g. Slack), show warm onboarding card: *"Want Lenny on Slack too? Enable it here."* User clicks → `chrome.permissions.request()` → granted.

Per-site opt-in builds trust. Full coverage available, user feels in control.

---

## API Cost Reduction — Three Layers

Prevents Groq rate limits with a shared API key across users.

| Layer | Mechanism | Estimated reduction |
|---|---|---|
| Local pre-filter | PM buzzword check (existing list) before any Groq call | ~60% of calls eliminated |
| 40-word threshold | Paragraphs under 40 words are conversational, not PM work | ~15% additional |
| Paragraph hash cache | Skip Groq if paragraph hasn't changed meaningfully | ~10% additional |
| Session concept dedup | Skip Groq if same core concept already seen this tab session | ~10% additional |

**Net result:** 1-hour writing session goes from 40+ potential Groq triggers to ~5-8 actual calls.

**Final call chain:**
```
User types in contenteditable
→ write+pause (1.5s)
→ 40+ words? NO → stop
→ PM keyword present? NO → stop
→ Paragraph hash changed? NO → serve cached chips
→ Concept seen this session? YES → serve cached chips
→ Groq call: context check + chip generation combined
    → NOT_PM → do nothing
    → PM → surface badge pill
```

---

## UX Design — Grammarly-Inspired

### The key shift

| | Current | Redesigned |
|---|---|---|
| Badge position | Floating glow dot (disconnected from work) | Fixed bottom-right pill: "3 patterns on retention →" |
| Chip generation | Keyword match only | Groq reads the full paragraph, generates contextual chips |
| Insight card | Two components (compact vs full postcard) | One component, two disclosure states |
| Platform coverage | 4 hardcoded URLs | Any platform with a text input |

### Four triggers

**Trigger 1: Write + pause (primary)**
User types 40+ words in any contenteditable → pauses 1.5s → local keyword filter → Groq generates 3 contextual chips → badge pill appears bottom-right: *"3 patterns on retention →"* → click pill → chips expand → tap chip → insight card (compact state).

**Trigger 2: Selection highlight (highest signal)**
User selects text containing PM concept → small dot near selection → click → insight card (expanded state, with audio). No chips needed — selection IS the query.

**Trigger 3: Double-tap Ctrl (explicit activation)**
Unchanged. Full existing flow. Power user path.

**Trigger 4: Reading sensor (passive)**
Existing behaviour, gated: not in first 20s on page, not during active editing.

### Single progressive disclosure card

One card component, two default states:
- **Compact** (chip tap): topic pill + 1-line pull quote + guest name
- **Expanded** (selection / double-tap Ctrl): full postcard with audio, source link, save button
- Click "expand" on compact card → transitions to expanded state

### Edge cases resolved

| Edge Case | Resolution |
|---|---|
| Chatty paragraph false positives | 40-word minimum threshold (1 line of code) |
| Inline badge DOM positioning complexity | Fixed bottom-right pill — no DOM injection, no getBoundingClientRect per element |
| Chip staleness after paragraph drift | Re-generate chips on click if paragraph hash changed (200ms Groq refresh) |
| Google Docs canvas limitation | Clipboard intercept (`document.oncopy`) as fallback trigger |
| `<all_urls>` trust problem | Optional permissions + warm per-site onboarding |
| Two card components for same data | Single component with two disclosure states |

---

## Files That Change

| File | What changes |
|---|---|
| `manifest.json` | Add `optional_host_permissions: ["<all_urls>"]`, keep 4 core platforms in `host_permissions` |
| `content/content-script.js` | Replace global keydown with focusin/focusout gate; add hash cache + session dedup; badge pill UI; single progressive card; clipboard intercept for Google Docs; 40-word threshold |
| `background/service-worker.js` | `GENERATE_QUESTIONS` handler updated — combined context detection + chip generation prompt |
| `background/abstraction.js` | Updated Groq prompt: single call does PM detection AND chip generation |

**Everything else unchanged:** RAG pipeline, TTS, Supabase, postcard for double-tap Ctrl, gamification storage.

---

## What's Deferred (Post-April 15)

- Backend proxy with per-user API keys (shared key fine for V1 scale)
- True inline text underline (Grammarly-identical, requires Range API per platform)
- Google Docs full inline support (canvas limitation, needs separate research)
- Safari extension for Apple Notes

---

## Next Step

Write implementation plan (`superpowers:writing-plans`) breaking this into tasks, then execute with `superpowers:subagent-driven-development`.
