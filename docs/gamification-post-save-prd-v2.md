# 🎮 Gamification, Post-Save & Edge Case Resilience — PRD v2.0

> **Version:** 2.0 | **Updated:** April 14, 2026 | **Owner:** Rajat Sharma
> **Status:** 🔴 Final spec — build today, ship tomorrow
> **Replaces:** V1.0 Gamification PRD (March 25, 2026)
> **Notion:** https://www.notion.so/32dfb45ef460814684d0efd4ca095a45

---

## Why V1 Gamification Was Wrong

The V1 gamification PRD modeled Lenny Live after Duolingo. That was a **category error.**

**Duolingo's problem:** Language practice is boring. Gamification makes boring things addictive.
**Lenny Live's problem:** PM insights are intrinsically interesting. But they're ambient — they arrive, the user nods, and they evaporate.

V1 designed 6 mechanics (XP economy, PM career ladder, streak shields, topic badges, rare drops, onboarding commitment) that would take 2–3 weeks to build and solve a problem Lenny Live doesn't have. Nobody needs XP points to want to hear Shreyas Doshi talk about prioritization.

**What Lenny Live actually needs:**
1. A reason to **save** — the insight becomes *yours*, retrievable, organized, useful
2. A reason to **return** — the library grows, progression acknowledges learning
3. A reason **not to stop** — streak + notification (the only Duolingo mechanic that transfers)

This PRD redesigns gamification around what matters for an ambient knowledge tool, not a daily drill app.

---

## Design Principles (Revised)

### 1. The library IS the game
Saving an insight should feel like adding a card to a collection, not clicking a bookmark. The popup should feel like opening a PM knowledge notebook — organized, searchable, growing.

### 2. Progression should acknowledge, not demand
"You've explored 4 PM disciplines" is better than "Complete 3 more for a badge." Lenny Live is ambient — demanding daily engagement contradicts the product's nature.

### 3. One notification, maximum leverage
The 8pm streak saver is the highest-ROI retention mechanic. Everything else (level-up notifications, badge earned, weekly recap) is noise until we have data.

### 4. Every state has a response
Network down, Groq timeout, empty results, audio failure mid-playback — every error path must have a clear, honest user-facing message. Silent failures feel like the product is broken.

### 5. Ship what you can prove works
No mechanic ships without a way to verify it end-to-end. If we can't test it in Chrome before April 15, it doesn't go in.

---

## Part 1 — Post-Save Experience

### Current State (Broken)

Save is a **write-only operation.** User clicks 🔖 → "✓ Saved!" → insight goes into a flat array in `chrome.storage.local` → popup shows last 5 items in a flat list → no search, no grouping, no way to find insight #6+.

**Three questions a PM actually asks that the library can't answer today:**
1. *"I saved something about retention last week — where is it?"* → No search, no topic grouping
2. *"Am I actually getting sharper?"* → No topic coverage, no progression
3. *"What did Shreyas say about prioritization?"* → No guest filter, no full text

### 1.1 — Saved Insights Library (Popup Redesign)

```
┌──────────────────────────────────┐
│  ● lennyLive              [Mute] │
├──────────────────────────────────┤
│  🔥 7 Days  🛡    │  PM · 245 XP │
│                   │  105 → Senior │
├──────────────────────────────────┤
│  PM Knowledge Map                │
│  ■■■■□ Retention (4)             │
│  ■■■■■ PMF (5) ✓                 │
│  ■■□□□ GTM Strategy (2)          │
│  ■□□□□ Pricing (1)               │
├──────────────────────────────────┤
│  🔍 Search saved insights...     │
├──────────────────────────────────┤
│  ▸ Retention (4)                 │
│  ▸ Product-Market Fit (5)        │
│  ▾ Pricing (1)                   │
│    How to find willingness...    │
│    From Madhavan Ramanujam    ↗  │
├──────────────────────────────────┤
│  ⚙ Settings                     │
└──────────────────────────────────┘
```

**Key changes from current popup:**

| Element | Current | New |
|---------|---------|-----|
| Insight list | Flat list, last 5 only | Topic-grouped accordion, ALL insights shown |
| Search | None | Search bar: filters by topic, guest, or quote text |
| Topic tracking | None | PM Knowledge Map — 5-bar progress per topic |
| Popup width | 320px | 360px (more room for content) |
| Score display | "🧠 Score: 40" (meaningless) | "PM · 245 XP · 105 → Senior" (career ladder) |

**Search:** Instant local filter — no API call. Matches against topic, guest_name, and pull_quote. Debounce 150ms on keystroke.

**Accordion:** Each topic is collapsible. Sorted by count (most explored first). Clicking topic header toggles expand/collapse. Each insight row: truncated pull_quote (1 line), guest name, ↗ to YouTube at exact timestamp.

**PM Knowledge Map:** 5-bar progress indicator per topic. Fills as user saves more insights in that domain. Checkmark (✓) at 5 saves = "topic explored." This IS the badge — no separate badge shelf needed.

### 1.2 — Save Confirmation (Micro-feedback)

Replace the current "✓ Saved!" with **contextual micro-celebrations:**

| Trigger | Toast Text | Duration |
|---------|-----------|----------|
| First save ever | "Your PM library starts here." | 3s |
| New topic (first save in a domain) | "New topic: [Topic]" | 3s |
| 5th save in a topic | "[Topic] explored — 5 insights deep." | 3s |
| 10th total save | "10 insights. You're building a real PM library." | 3s |
| Regular save | "✓ Saved to [Topic]" | 2s |

These are **toasts on the postcard**, not modals. They don't interrupt flow.

### 1.3 — Duplicate Save Prevention

**Current bug:** Same insight saved twice creates duplicate entries.

**Fix:** Before appending, check if `savedInsights` already contains an entry with matching `pull_quote` + `guest_name`. If found, show toast: "Already in your library" (2s). Do not re-append. Do not increment XP.

### 1.4 — Insight Entry Schema (Updated)

```javascript
{
  topic:          "Retention",
  pull_quote:     "The best retention teams...",
  insight:        "One-line summary",
  guest_name:     "Brian Balfour",
  episode_title:  "How to think about retention",
  youtube_url:    "https://youtube.com/...",
  timestamp_secs: 342,
  saved_at:       "2026-04-14T10:30:00Z",
  source:         "selection" | "voice" | "write-pause"  // NEW
}
```

New field `source` tracks how the user activated. No behavior change — for future analytics only.

---

## Part 2 — Progression System

### 2.1 — XP + PM Level (Career Ladder)

**Kept from V1, simplified.** The PM career ladder is genuinely motivating for the target user (junior PM who viscerally understands APM → PM → Senior PM).

| XP Range | Level | Title |
|----------|-------|-------|
| 0–49 | 1 | Intern |
| 50–149 | 2 | APM |
| 150–349 | 3 | PM |
| 350–699 | 4 | Senior PM |
| 700–1,199 | 5 | Staff PM |
| 1,200+ | 6 | Group PM |

**Popup always shows the gap to next level:** `PM · 245 XP · 105 → Senior PM`

Goal gradient effect — the shrinking distance to the next milestone is what pulls users forward.

### 2.2 — XP Economy (Simplified)

| Action | XP | Rationale |
|--------|-----|-----------|
| Insight delivered (postcard shown) | +5 | Rewards showing up |
| Insight saved | +15 | Explicit value signal |
| Streak day bonus (daily) | +2 × streak_day | Day 7 = +14. Compounds. |

**Cut from V1:**
- ~~Rare drops (+25)~~ — Requires corpus tagging. Premature optimization.
- ~~Topic badge unlocked (+20)~~ — Topic map replaces badges. No one-time XP needed.
- ~~Streak milestone XP (+15/+30/+50/+100)~~ — Milestones get toasts, not bonus XP. Simpler.

### 2.3 — Topic Coverage Map

**Replaces V1's "Topic Mastery Badges."**

- Every saved insight has a `topic` field
- `topicCounts` in storage tracks saves per topic: `{ "Retention": 4, "GTM": 2 }`
- Popup renders a 5-bar progress indicator per topic
- At 5 saves, the bar fills completely and shows ✓
- No "badge unlocked" modal — the map itself IS the achievement

**Canonical topics** (normalize free-form topic labels to these 7):

| Topic | Moments in Corpus | "Explored" at |
|-------|-------------------|---------------|
| Retention | ~45 | 5 saves |
| GTM Strategy | ~35 | 5 saves |
| Product-Market Fit | ~30 | 5 saves |
| Roadmap & Prioritization | ~25 | 5 saves |
| User Research | ~20 | 5 saves |
| Metrics & North Star | ~25 | 5 saves |
| Pricing | ~12 | 3 saves |

*Rarer domains (Pricing) unlock faster to avoid frustration.*

---

## Part 3 — Streak & Notifications

### 3.1 — Streak Logic (Fix Current Bugs)

**Current bug:** Streak only increments on successful postcard. If user highlights but gets `no_results` or `network_error`, streak doesn't count. This **punishes trying.**

**Fix:** Increment streak on any QUERY sent to service-worker — not just successful result. The user showed up and engaged. That's the habit we reinforce.

Move `updateStreak()` from `showPostcard()` to the QUERY message handler in content-script.js.

### 3.2 — Streak Shield

**Kept from V1.** Simple and high-impact.

- **Earned** after 7 consecutive days (natural week anchor)
- **Absorbs** one missed day without resetting streak
- Max 1 shield held at a time
- Popup shows: 🛡 when active
- On use: toast *"Streak shield used! Your 8-day streak lives on."*
- Storage: `streakShield: true | false`

### 3.3 — Streak Milestones (Toasts Only)

| Streak | Toast (on postcard) |
|--------|-------------------|
| 3 days | "3 days with Lenny. You're building a habit." |
| 7 days | "One week straight. Streak shield earned. 🛡" |
| 14 days | "Two weeks of compounded PM knowledge." |
| 30 days | "30 days. Top 1% of PM learners." |

These are **postcard toasts**, not Chrome notifications. Zero infrastructure cost.

### 3.4 — Streak Saver Notification (8pm)

> **The single highest-ROI feature in this entire PRD.**

At 8pm local time, if no insight was delivered today AND user has an active streak ≥ 2:

> *"🔥 Your 7-day streak ends at midnight. Highlight something to keep it alive."*

**Implementation:**
- `chrome.alarms.create('streakSaver', { when: next8pm, periodInMinutes: 1440 })`
- Alarm listener checks: `lastActiveDate !== today` AND `streak >= 2`
- If both true → `chrome.notifications.create(...)` with streak count
- Click notification → opens last active tab (or Notion as default)
- **Requires:** `"notifications"` and `"alarms"` permissions in manifest.json

### 3.5 — Streak Break Feedback

**Current gap:** Streak resets silently. User opens popup, sees "🔥 1 Day" with no explanation.

**Fix:** Store `previousStreak` in storage. On first postcard after a break (streak was > 1, now 1):
Toast: *"Your [N]-day streak ended. Starting fresh — day 1."*

---

## Part 4 — Edge Cases & Error Resilience

### 4.1 — Audio Failure While Postcard Is Visible [CRITICAL]

**Current bug:** If ElevenLabs times out after postcard shows, service-worker sends a *second* RESPONSE with `status='network_error'`. User sees success AND error simultaneously.

**Fix:** New message type `AUDIO_ERROR` — separate from RESPONSE.

```javascript
// service-worker.js — audio catch block
chrome.tabs.sendMessage(tabId, { type: 'AUDIO_ERROR' });
// NOT: pushResponse(tabId, { status: 'network_error' })
```

Content script handles `AUDIO_ERROR`:
- If postcard visible → show small 🔇 icon on postcard. No toast, no error overlay.
- If postcard dismissed → ignore silently.

### 4.2 — Duplicate API Calls on Fast Re-Selection [HIGH]

**Current bug:** Two rapid selection-dot clicks → two QUERY messages → two postcards arrive, second overwrites first.

**Fix:** Add `queryId` (incrementing counter) to each QUERY. Content script only accepts RESPONSE where `queryId` matches latest sent. Stale responses silently dropped.

```javascript
// content-script.js
let currentQueryId = 0;

// On QUERY send:
currentQueryId++;
chrome.runtime.sendMessage({ type: 'QUERY', queryId: currentQueryId, ... });

// On RESPONSE receive:
if (message.queryId !== currentQueryId) return; // stale — drop
```

### 4.3 — Service Worker Death Mid-Query [MEDIUM]

MV3 service workers are killed after 5 min of inactivity. If SW dies mid-query, content script gets no response.

**Current handling:** 10s timeout shows generic message.
**Improvement:** Change message: *"Lost connection. Try highlighting again."*

### 4.4 — Selection Dot Off-Screen [MEDIUM]

**Current bug:** Dot positioned at `rect.right, rect.bottom` with no viewport boundary check.

**Fix:** Clamp to viewport with 40px padding:
```javascript
const x = Math.min(rect.right - 14, window.innerWidth - 40);
const y = Math.min(rect.bottom + 5, window.innerHeight - 40);
```

### 4.5 — Mute Toggle Doesn't Stop Current Audio [MEDIUM]

**Current bug:** Popup mute toggle persists preference but doesn't stop currently-playing audio.

**Fix:** Popup sends `MUTE_CHANGED` message to content script. Content script calls `stopCurrentAudio()` on receipt.

### 4.6 — http:// Pages (Mixed Content) [LOW]

**Current bug:** On http:// pages, HTTPS API calls may fail. User sees generic "Network error."

**Fix:** Detect protocol before QUERY: `if (location.protocol === 'http:')` → toast: *"Lenny works best on secure (https) pages."*

### 4.7 — chrome.storage.local Size Limit [LOW]

**Fix:** Cap at 500 saved insights. Toast: *"Library full. Remove some to save more."* Add "Clear all" to popup settings.

### 4.8 — Empty/Whitespace Selection [LOW]

**Current bug:** Whitespace-only selection passes check, produces garbage embeddings.

**Fix:** Require ≥10 non-whitespace characters: `if (trimmed.length < 10) return;`

### 4.9 — Postcard Over Postcard [LOW]

**Current bug:** Second insight overwrites first postcard with a jarring content swap.

**Fix:** Fade out current postcard (200ms CSS transition) before showing new one. Prior save persists regardless.

### 4.10 — Streak Increments Only on Success [MEDIUM]

Covered in Section 3.1. Streak should fire on activation (QUERY sent), not on successful result.

---

## Part 5 — Storage Schema (Complete)

```javascript
{
  // ─── XP & Level ───────────────────────────
  knowledge_score: 245,

  // ─── Streak ───────────────────────────────
  streak: 7,
  longest_streak: 12,
  previousStreak: 0,          // for break detection
  lastActiveDate: "2026-04-14",
  streakShield: false,

  // ─── Topic Coverage ───────────────────────
  topicCounts: {
    "Retention": 4,
    "GTM Strategy": 2,
    "Product-Market Fit": 6,
    "Pricing": 1
  },

  // ─── Saved Insights ───────────────────────
  savedInsights: [ /* insight objects per 1.4 schema */ ],

  // ─── Onboarding ───────────────────────────
  hasOnboarded: true,

  // ─── Settings ─────────────────────────────
  voiceMuted: false
}
```

**Keys removed from V1:**
- ~~`learningGoal`~~ — Onboarding commitment screen cut.
- ~~`badges`~~ — Topic map replaces badge shelf.
- ~~`onboardingComplete`~~ — Redundant with `hasOnboarded`.

---

## Part 6 — Implementation Priority

> **Deadline: April 15, 2026.** Everything below must be buildable in one focused day.

### Must Ship (April 14)

| # | Feature | Effort | Files |
|---|---------|--------|-------|
| 1 | Fix XP: +5 on deliver, +15 on save, +streak bonus | 10 min | content-script.js |
| 2 | Fix streak: increment on activation, not on success | 10 min | content-script.js |
| 3 | PM Level labels + gap-to-next in popup | 20 min | popup.js, popup.html, popup.css |
| 4 | Topic-grouped accordion for saved insights | 45 min | popup.js, popup.html, popup.css |
| 5 | Duplicate save prevention | 10 min | content-script.js |
| 6 | Save micro-celebration toasts | 20 min | content-script.js |
| 7 | Streak saver notification (8pm) | 30 min | service-worker.js, manifest.json |
| 8 | Audio error separation (AUDIO_ERROR type) | 15 min | service-worker.js, content-script.js |
| 9 | Search bar in popup | 20 min | popup.js, popup.html, popup.css |
| 10 | Selection dot viewport clamping | 5 min | content-script.js |

**Total: ~3 hours of focused work.**

### Nice to Have (If Time)

| # | Feature | Effort |
|---|---------|--------|
| 11 | Streak shield (earn at 7 days) | 20 min |
| 12 | Streak break toast | 10 min |
| 13 | queryId deduplication (stale response guard) | 15 min |
| 14 | Mute stops current audio | 10 min |
| 15 | http:// page detection | 5 min |

### Post-Launch (Not V1)

- Rare drops (gold insights)
- Onboarding commitment screen
- Weekly recap notification
- Shareable weekly card (PNG export)
- Supabase cloud sync for gamification data

---

## Part 7 — What We're NOT Building

| Feature | Why Not |
|---------|---------|
| Rare drops (+25 XP gold insights) | Requires corpus tagging + gold postcard treatment. High effort, unproven. |
| Onboarding goal commitment | Ambient tools don't benefit from stated goals. User didn't come here to commit. |
| Leaderboards | Single-player product. Social comparison between junior PMs is counterproductive. |
| Weekly recap notification | One notification type (streak saver) until we have opt-out data. |
| Shareable PNG card | Growth feature. Premature before 100 users. |
| Supabase cloud sync | Local storage sufficient. Users don't switch Chrome profiles. |
| Daily lessons / curriculum | We're ambient, not a course. |

---

## Part 8 — Key Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| D7 retention | >30% | PostHog: unique users day 7 / installs |
| Insights saved / user / week | >3 | chrome.storage.local savedInsights count |
| % users with 7+ streak by week 4 | >20% | chrome.storage.local streak value |
| Avg topics explored / user | >3 | chrome.storage.local topicCounts keys |
| Streak saver → re-engagement | >15% | Notification click / notifications sent |
| Save rate | >25% | Saves / insights delivered |

---

## Part 9 — Open Questions

1. **Should streak fire on selection-dot click or only on double-tap Ctrl?** Recommendation: any activation that sends a QUERY. Most inclusive definition of "showed up."

2. **Topic normalization.** The `topic` field on corpus entries is free-form. Normalize to 7 canonical topics (Retention, GTM, PMF, Roadmap, User Research, Metrics, Pricing) via a lookup map. Unmapped topics get "PM Insights" fallback.

3. **Storage migration.** Current users have `knowledge_score` with +10 per save. New system: +5/+15 split. Recommendation: grandfather existing scores. Don't punish early users.

---

## Sources

- Duolingo retention mechanics: Lenny's Newsletter — *"How Duolingo reignited user growth"*
- Variable ratio / compounding: Lenny's Newsletter — *"The secret to Duolingo's exponential growth"*
- Behavioral science: Lenny's Newsletter — *"How behavioral science can boost your conversion rates"* (Kristen Berman, Irrational Labs)
- Kahneman & Tversky — Prospect Theory (loss aversion)
- V1 audit: Full codebase review April 14, 2026
