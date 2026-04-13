# Gamification, Post-Save & Edge Cases — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the gamification v2 system — XP economy, PM levels, topic-grouped library, search, micro-celebrations, streak saver notification, and critical edge case fixes.

**Architecture:** All gamification state lives in `chrome.storage.local`. No Supabase sync. Popup reads on open, content-script writes on events. New manifest permissions: `notifications`, `alarms`. Service-worker gets alarm listener + audio error separation. No new files created — all changes modify existing files.

**Tech Stack:** Vanilla JS, Chrome Manifest V3 APIs (storage, alarms, notifications, tabs), plain CSS

**Spec:** `docs/gamification-post-save-prd-v2.md`

---

## File Map

| File | Changes |
|------|---------|
| `content/content-script.js` | XP on deliver (+5), XP on save (+15), streak on activation, duplicate save prevention, micro-celebration toasts, topicCounts tracking, selection dot viewport clamp, AUDIO_ERROR handler, MUTE_CHANGED handler |
| `popup/popup.html` | PM Knowledge Map section, search bar, topic accordion, PM Level display, wider body |
| `popup/popup.js` | Level calculation, topic grouping, accordion expand/collapse, search filter, knowledge map rendering, MUTE_CHANGED message |
| `popup/popup.css` | Knowledge map bars, accordion styles, search bar, level display, 360px width |
| `background/service-worker.js` | AUDIO_ERROR message type (replace network_error on audio fail), streak saver alarm listener |
| `manifest.json` | Add `notifications` and `alarms` permissions |

---

### Task 1: Manifest — Add Permissions

**Files:**
- Modify: `manifest.json:6`

- [ ] **Step 1: Add notifications and alarms permissions**

In `manifest.json`, change line 6 from:
```json
"permissions": ["activeTab", "storage", "scripting", "tabs"],
```
to:
```json
"permissions": ["activeTab", "storage", "scripting", "tabs", "notifications", "alarms"],
```

- [ ] **Step 2: Verify manifest loads**

Reload extension in `chrome://extensions`. Confirm no errors in the extension card. Chrome may prompt for new permissions on next install — expected.

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: add notifications + alarms permissions for streak saver"
```

---

### Task 2: XP Economy — +5 on Deliver, +15 on Save, Streak Bonus

**Files:**
- Modify: `content/content-script.js:740-760` (showPostcard + updateStreak)
- Modify: `content/content-script.js:895-900` (save handler XP)

- [ ] **Step 1: Add +5 XP on postcard delivery**

In `content/content-script.js`, find the `showPostcard` function. After the existing `updateStreak()` call on line 745, add XP increment:

```javascript
  // Update streak on each successful insight delivery
  updateStreak();

  // +5 XP on insight delivery (PRD v2 §2.2)
  chrome.storage.local.get(['knowledge_score'], (s) => {
    if (!chrome.runtime.lastError) {
      chrome.storage.local.set({ knowledge_score: (s.knowledge_score || 0) + 5 });
    }
  });
```

- [ ] **Step 2: Change save XP from +10 to +15**

In `content/content-script.js`, find the save click handler. Change line 898 from:
```javascript
            chrome.storage.local.set({ knowledge_score: (s.knowledge_score || 0) + 10 });
```
to:
```javascript
            chrome.storage.local.set({ knowledge_score: (s.knowledge_score || 0) + 15 });
```

- [ ] **Step 3: Move streak to fire on activation, not success**

In `content/content-script.js`, remove the `updateStreak()` call from `showPostcard()` (line 745). Instead, add it to the selection dot click handler (line 1082) and the voice query sender (line 1578 area).

In the selection dot click handler around line 1082, add before `chrome.runtime.sendMessage`:
```javascript
  selectionDot.onclick = () => {
    updateStreak(); // Streak fires on activation, not success (PRD v2 §3.1)
    chrome.runtime.sendMessage({ type: 'QUERY', transcript: '', selection: selectedText.slice(0, 2000), pageContext: '' });
    hideSelectionDot();
  };
```

In the voice query sender function (the function that calls `chrome.runtime.sendMessage({ type: 'QUERY', transcript, ... })`), add `updateStreak()` right before the sendMessage call.

- [ ] **Step 4: Add streak day bonus XP to updateStreak()**

Modify the `updateStreak` function (line 748-760) to also grant streak bonus XP:

```javascript
function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['streak', 'lastActiveDate', 'longest_streak', 'knowledge_score'], (data) => {
    if (chrome.runtime.lastError) return;
    const last = data.lastActiveDate;
    let streak = data.streak || 0;
    if (last !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      streak = (last === yesterday) ? streak + 1 : 1;
      const longest = Math.max(streak, data.longest_streak || 0);
      // Streak day bonus: +2 × streak_day (PRD v2 §2.2)
      const streakBonus = streak * 2;
      const newScore = (data.knowledge_score || 0) + streakBonus;
      chrome.storage.local.set({ streak, lastActiveDate: today, longest_streak: longest, knowledge_score: newScore });
    }
  });
}
```

- [ ] **Step 5: Verify in Chrome**

Reload extension. Open Notion. Highlight PM text. Click selection dot. Open popup — streak should be 1, score should be +5 (delivery) + 2 (streak bonus day 1) = 7. Click Save on postcard — score should jump by 15 to 22.

- [ ] **Step 6: Commit**

```bash
git add content/content-script.js
git commit -m "feat: XP economy — +5 deliver, +15 save, streak bonus, streak on activation"
```

---

### Task 3: Duplicate Save Prevention + topicCounts Tracking

**Files:**
- Modify: `content/content-script.js:867-904` (save click handler)

- [ ] **Step 1: Add duplicate check and topicCounts update to save handler**

Replace the entire save click handler (lines 867-904) with:

```javascript
shadow.getElementById('ll-btn-save').addEventListener('click', () => {
  if (!currentInsight) return;
  const entry = {
    topic:         currentInsight.topic,
    pull_quote:    currentInsight.pull_quote,
    insight:       currentInsight.insight || '',
    guest_name:    currentInsight.guest_name,
    episode_title: currentInsight.episode_title,
    youtube_url:   currentInsight.youtube_url,
    timestamp_secs: currentInsight.timestamp_secs,
    saved_at:      new Date().toISOString(),
  };
  chrome.storage.local.get(['savedInsights', 'knowledge_score', 'topicCounts'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('[LennyLive] Save read failed:', chrome.runtime.lastError.message);
      return;
    }
    const existing = result.savedInsights || [];

    // Duplicate check — match on pull_quote + guest_name (PRD v2 §1.3)
    const isDuplicate = existing.some(
      e => e.pull_quote === entry.pull_quote && e.guest_name === entry.guest_name
    );
    if (isDuplicate) {
      const btn = shadow.getElementById('ll-btn-save');
      if (btn) { btn.textContent = 'Already saved'; setTimeout(() => { btn.textContent = '🔖 Save'; }, 2000); }
      return;
    }

    existing.push(entry);

    // Update topicCounts for PM Knowledge Map (PRD v2 §2.3)
    const topicCounts = result.topicCounts || {};
    const topic = entry.topic || 'PM Insights';
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;

    // Micro-celebration toast text (PRD v2 §1.2)
    const totalSaves = existing.length;
    const topicCount = topicCounts[topic];
    let toastText = `✓ Saved to ${topic}`;
    if (totalSaves === 1) {
      toastText = 'Your PM library starts here.';
    } else if (topicCount === 1) {
      toastText = `New topic: ${topic}`;
    } else if (topicCount === 5) {
      toastText = `${topic} explored — 5 insights deep.`;
    } else if (totalSaves === 10) {
      toastText = '10 insights. You\'re building a real PM library.';
    }

    chrome.storage.local.set({ savedInsights: existing, topicCounts, knowledge_score: (result.knowledge_score || 0) + 15 }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[LennyLive] Save write failed:', chrome.runtime.lastError.message);
      } else {
        console.log('[LennyLive] Insight saved:', entry.topic, '| topicCounts:', topicCounts);
        const btn = shadow.getElementById('ll-btn-save');
        if (btn) {
          btn.textContent = toastText;
          setTimeout(() => { btn.textContent = '🔖 Save'; }, toastText.length > 20 ? 3000 : 2000);
        }
      }
    });
  });
});
```

- [ ] **Step 2: Verify in Chrome**

Reload extension. Trigger an insight. Save it. Button should show contextual toast. Save same insight again — should show "Already saved". Open popup — topicCounts should be set in storage (check via `chrome.storage.local.get(['topicCounts'], console.log)` in background console).

- [ ] **Step 3: Commit**

```bash
git add content/content-script.js
git commit -m "feat: duplicate save prevention, topicCounts tracking, micro-celebration toasts"
```

---

### Task 4: Selection Dot Viewport Clamping

**Files:**
- Modify: `content/content-script.js:1073-1074`

- [ ] **Step 1: Clamp selection dot to viewport**

Replace lines 1073-1074:
```javascript
  selectionDot.style.left = `${rect.right - 14}px`;
  selectionDot.style.top = `${rect.bottom + 5}px`;
```
with:
```javascript
  // Clamp to viewport with 40px padding (PRD v2 §4.4)
  const dotX = Math.min(rect.right - 14, window.innerWidth - 40);
  const dotY = Math.min(rect.bottom + 5, window.innerHeight - 40);
  selectionDot.style.left = `${Math.max(8, dotX)}px`;
  selectionDot.style.top = `${Math.max(8, dotY)}px`;
```

- [ ] **Step 2: Test edge cases**

Select text at bottom-right corner of the page. Dot should remain visible within viewport. Select text at top-left — dot should still be at least 8px from edges.

- [ ] **Step 3: Commit**

```bash
git add content/content-script.js
git commit -m "fix: clamp selection dot to viewport bounds"
```

---

### Task 5: Audio Error Separation (AUDIO_ERROR)

**Files:**
- Modify: `background/service-worker.js:325-327` (pushAudio catch block)
- Modify: `content/content-script.js:1624-1656` (onMessage listener)

- [ ] **Step 1: Change service-worker to send AUDIO_ERROR instead of network_error**

In `background/service-worker.js`, find the `pushAudio` function. Replace the catch block (lines 325-327):
```javascript
      .catch(err => {
        console.warn('[LennyLive] Audio skipped:', err.message);
        pushResponse(tabId, { type: 'RESPONSE', status: 'network_error', insight: null });
      })
```
with:
```javascript
      .catch(err => {
        console.warn('[LennyLive] Audio skipped:', err.message);
        // Send AUDIO_ERROR, not RESPONSE — avoids double-error when postcard is visible (PRD v2 §4.1)
        pushResponse(tabId, { type: 'AUDIO_ERROR' });
      })
```

- [ ] **Step 2: Handle AUDIO_ERROR in content script**

In `content/content-script.js`, in the `chrome.runtime.onMessage.addListener` block, after the `if (message.type === 'AUDIO')` block (around line 1656), add:

```javascript
  if (message.type === 'AUDIO_ERROR') {
    // Audio failed but postcard may be visible — don't show error toast (PRD v2 §4.1)
    console.warn('[LennyLive] Audio failed silently — postcard remains visible');
    // No UI change needed — user still has the text insight
  }
```

- [ ] **Step 3: Add MUTE_CHANGED handler to content script**

In the same onMessage listener, add:

```javascript
  if (message.type === 'MUTE_CHANGED') {
    if (message.muted) stopCurrentAudio();
  }
```

- [ ] **Step 4: Verify**

Reload extension. Trigger an insight. If audio plays, good. To test AUDIO_ERROR: temporarily set TTS timeout to 1ms in service-worker, trigger insight — postcard should appear without error toast.

- [ ] **Step 5: Commit**

```bash
git add background/service-worker.js content/content-script.js
git commit -m "fix: separate AUDIO_ERROR from RESPONSE to prevent double-error UX"
```

---

### Task 6: Streak Saver Notification (8pm Alarm)

**Files:**
- Modify: `background/service-worker.js` (add alarm listener at top level)

- [ ] **Step 1: Add alarm creation on service worker startup**

At the bottom of `background/service-worker.js`, after the `pushResponse` function, add:

```javascript
// ─── Streak Saver Notification (PRD v2 §3.4) ─────────────────────────────────
// Fires daily at 8pm local time. If user has an active streak ≥ 2 and hasn't
// used the extension today, show a Chrome notification.

function scheduleStreakSaver() {
  const now = new Date();
  const next8pm = new Date(now);
  next8pm.setHours(20, 0, 0, 0);
  if (now >= next8pm) next8pm.setDate(next8pm.getDate() + 1);

  chrome.alarms.create('streakSaver', {
    when: next8pm.getTime(),
    periodInMinutes: 1440, // repeat daily
  });
  console.log('[LennyLive] Streak saver alarm set for', next8pm.toLocaleString());
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'streakSaver') return;

  chrome.storage.local.get(['streak', 'lastActiveDate'], (data) => {
    if (chrome.runtime.lastError) return;
    const today = new Date().toISOString().split('T')[0];
    const streak = data.streak || 0;

    // Only notify if: active streak ≥ 2, AND user hasn't activated today
    if (streak >= 2 && data.lastActiveDate !== today) {
      chrome.notifications.create('streakSaver', {
        type: 'basic',
        iconUrl: 'assets/icons/icon128.png',
        title: `🔥 Your ${streak}-day streak ends at midnight`,
        message: 'Highlight something to keep it alive.',
        priority: 2,
      }, (notifId) => {
        if (chrome.runtime.lastError) {
          console.warn('[LennyLive] Notification failed:', chrome.runtime.lastError.message);
        } else {
          console.log('[LennyLive] Streak saver notification shown:', notifId);
        }
      });
    }
  });
});

// Click handler: open the last active tab or Notion as fallback
chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId === 'streakSaver') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: 'https://notion.so' });
      }
    });
    chrome.notifications.clear(notifId);
  }
});

// Schedule on first load
scheduleStreakSaver();
```

- [ ] **Step 2: Verify alarm is registered**

Reload extension. Open `chrome://extensions` → service worker "Inspect". In console, run:
```javascript
chrome.alarms.getAll(a => console.log(a))
```
Should show one alarm named `streakSaver` with `scheduledTime` around the next 8pm.

- [ ] **Step 3: Commit**

```bash
git add background/service-worker.js
git commit -m "feat: streak saver notification — 8pm daily alarm with Chrome notification"
```

---

### Task 7: Popup HTML — PM Level, Knowledge Map, Search, Topic Accordion

**Files:**
- Modify: `popup/popup.html:55-77` (stats grid + saved insights section)

- [ ] **Step 1: Replace the stats grid and saved insights section**

Replace the entire `<!-- Gamification Stats -->` and `<!-- Saved Insights -->` sections (lines 55-77) with:

```html
  <!-- Gamification Stats — PM Level + Streak -->
  <section class="stats-grid">
    <div class="stat-card">
      <span class="stat-title">🔥 Streak</span>
      <span class="stat-value"><span id="streak-value">0</span> <small>Days</small></span>
      <span class="stat-sub" id="streak-shield"></span>
    </div>
    <div class="stat-card">
      <span class="stat-title" id="level-title">Intern</span>
      <span class="stat-value"><span id="score-value">0</span> <small>XP</small></span>
      <span class="stat-sub" id="level-progress"></span>
    </div>
  </section>

  <!-- PM Knowledge Map -->
  <section class="knowledge-map-section">
    <h2 class="section-heading">PM Knowledge Map</h2>
    <div id="knowledge-map" class="knowledge-map"></div>
  </section>

  <!-- Saved Insights — Topic Accordion -->
  <section class="saved-insights-section">
    <div class="saved-header">
      <h2 class="section-heading">Saved Insights</h2>
    </div>
    <input type="text" id="search-bar" class="search-bar" placeholder="Search by topic, guest, or keyword...">
    <div id="saved-list" class="saved-list">
      <div class="empty-state-card" id="empty-state">
        <p class="empty-state-text"><span class="empty-highlight">Highlight</span> any text on a webpage to get your first Lenny insight. Then hit 🔖 to save it here.</p>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Commit**

```bash
git add popup/popup.html
git commit -m "feat: popup HTML — PM level, knowledge map, search bar, topic accordion"
```

---

### Task 8: Popup CSS — New Styles

**Files:**
- Modify: `popup/popup.css` (body width, new sections)

- [ ] **Step 1: Change body width to 360px**

In `popup/popup.css`, change line 22:
```css
  width: 320px;
```
to:
```css
  width: 360px;
```

Also change line 281 `.teaching-state` width:
```css
.teaching-state { width: 320px; background: var(--bg-color); }
```
to:
```css
.teaching-state { width: 360px; background: var(--bg-color); }
```

- [ ] **Step 2: Add PM Level, Knowledge Map, Search, and Accordion styles**

Append the following to the end of `popup/popup.css`:

```css
/* ─── PM Level (stat card sub-text) ──────────────────────── */

.stat-sub {
  font-size: 10px;
  color: var(--accent-orange);
  font-weight: 600;
  margin-top: 2px;
}

small {
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  color: var(--text-tertiary);
}

/* ─── Section Headings ───────────────────────────────────── */

.section-heading {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 14px;
  font-style: italic;
  font-weight: 400;
  color: var(--text-primary);
  margin-bottom: 10px;
}

/* ─── PM Knowledge Map ───────────────────────────────────── */

.knowledge-map-section {
  padding: 0 16px 16px;
}

.knowledge-map {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.km-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.km-bars {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.km-bar {
  width: 16px;
  height: 8px;
  border-radius: 2px;
  background: var(--card-border);
}

.km-bar.filled {
  background: var(--accent-orange);
}

.km-label {
  font-size: 11px;
  color: var(--text-secondary);
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.km-check {
  font-size: 11px;
  color: var(--accent-orange);
  flex-shrink: 0;
}

/* ─── Search Bar ─────────────────────────────────────────── */

.search-bar {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  color: var(--text-primary);
  background: var(--card-bg);
  outline: none;
  margin-bottom: 10px;
  transition: border-color 0.2s;
}

.search-bar:focus {
  border-color: var(--accent-orange);
}

.search-bar::placeholder {
  color: var(--text-tertiary);
}

/* ─── Topic Accordion ────────────────────────────────────── */

.topic-group {
  margin-bottom: 4px;
}

.topic-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}

.topic-header:hover {
  background: var(--hover-bg);
}

.topic-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.topic-count {
  font-size: 11px;
  color: var(--text-tertiary);
}

.topic-arrow {
  font-size: 10px;
  color: var(--text-tertiary);
  transition: transform 0.2s;
  margin-left: 4px;
}

.topic-group.expanded .topic-arrow {
  transform: rotate(90deg);
}

.topic-items {
  display: none;
  padding-left: 12px;
}

.topic-group.expanded .topic-items {
  display: block;
}

.no-results-text {
  font-size: 12px;
  font-style: italic;
  color: var(--text-tertiary);
  text-align: center;
  padding: 12px;
}
```

- [ ] **Step 3: Commit**

```bash
git add popup/popup.css
git commit -m "feat: popup CSS — PM level, knowledge map bars, search, topic accordion"
```

---

### Task 9: Popup JS — Full Dashboard Logic

**Files:**
- Rewrite: `popup/popup.js`

- [ ] **Step 1: Rewrite popup.js with level calculation, knowledge map, topic grouping, search**

Replace the entire contents of `popup/popup.js` with:

```javascript
// popup/popup.js
// Dashboard — PM Level, Knowledge Map, Topic-Grouped Insights, Search
// Storage keys: streak, lastActiveDate, longest_streak, knowledge_score, savedInsights, topicCounts, voiceMuted, hasOnboarded, streakShield

// PM Career Ladder (PRD v2 §2.1)
const LEVELS = [
  { min: 0,    title: 'Intern' },
  { min: 50,   title: 'APM' },
  { min: 150,  title: 'PM' },
  { min: 350,  title: 'Senior PM' },
  { min: 700,  title: 'Staff PM' },
  { min: 1200, title: 'Group PM' },
];

function getLevel(xp) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.min) level = l;
    else break;
  }
  return level;
}

function getNextLevel(xp) {
  for (const l of LEVELS) {
    if (xp < l.min) return l;
  }
  return null; // max level
}

document.addEventListener('DOMContentLoaded', () => {
  const teachingEl  = document.getElementById('teaching-state');
  const dashboardEl = document.getElementById('dashboard');

  // ─── Routing: teaching state vs dashboard ─────────────────────
  chrome.storage.local.get(['hasOnboarded'], (data) => {
    if (!data.hasOnboarded) {
      teachingEl.classList.remove('hidden');
      dashboardEl.style.display = 'none';
    } else {
      teachingEl.classList.add('hidden');
      dashboardEl.style.display = 'block';
      loadDashboard();
    }
  });

  // ─── Teaching CTA ─────────────────────────────────────────────
  document.getElementById('teaching-cta').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'NUDGE_PULSE' });
      }
      setTimeout(() => window.close(), 100);
    });
  });

  // ─── Dashboard ────────────────────────────────────────────────
  function loadDashboard() {
    chrome.storage.local.get(
      ['streak', 'knowledge_score', 'savedInsights', 'voiceMuted', 'topicCounts', 'streakShield', 'longest_streak'],
      (data) => {
        renderStats(data);
        renderKnowledgeMap(data.topicCounts || {});
        renderSavedInsights(data.savedInsights || []);
        setupSearch(data.savedInsights || []);
        setupMuteToggle(data.voiceMuted);
      }
    );
  }

  function renderStats(data) {
    const xp = data.knowledge_score || 0;
    const streak = data.streak || 0;
    const level = getLevel(xp);
    const next = getNextLevel(xp);

    document.getElementById('streak-value').textContent = streak;
    document.getElementById('score-value').textContent = xp;
    document.getElementById('level-title').textContent = level.title;

    // Shield indicator
    const shieldEl = document.getElementById('streak-shield');
    if (data.streakShield) shieldEl.textContent = '🛡 Shield';

    // "47 → Senior PM"
    const progressEl = document.getElementById('level-progress');
    if (next) {
      progressEl.textContent = `${next.min - xp} → ${next.title}`;
    } else {
      progressEl.textContent = 'Max level!';
    }
  }

  function renderKnowledgeMap(topicCounts) {
    const mapEl = document.getElementById('knowledge-map');
    const sorted = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
      mapEl.innerHTML = '<p class="no-results-text">Save insights to build your knowledge map.</p>';
      return;
    }

    mapEl.innerHTML = sorted.map(([topic, count]) => {
      const maxBars = 5;
      const filled = Math.min(count, maxBars);
      const bars = Array.from({ length: maxBars }, (_, i) =>
        `<div class="km-bar${i < filled ? ' filled' : ''}"></div>`
      ).join('');
      const check = count >= maxBars ? '✓' : '';
      return `
        <div class="km-row">
          <div class="km-bars">${bars}</div>
          <span class="km-label">${topic} (${count})</span>
          ${check ? `<span class="km-check">${check}</span>` : ''}
        </div>
      `;
    }).join('');
  }

  function renderSavedInsights(insights, filter = '') {
    const listEl = document.getElementById('saved-list');
    const emptyEl = document.getElementById('empty-state');

    if (insights.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      listEl.querySelectorAll('.topic-group').forEach(g => g.remove());
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    // Filter
    const lowerFilter = filter.toLowerCase();
    const filtered = filter
      ? insights.filter(i =>
          (i.topic || '').toLowerCase().includes(lowerFilter) ||
          (i.guest_name || '').toLowerCase().includes(lowerFilter) ||
          (i.pull_quote || '').toLowerCase().includes(lowerFilter)
        )
      : insights;

    // Group by topic
    const groups = {};
    filtered.forEach(insight => {
      const topic = insight.topic || 'PM Insights';
      if (!groups[topic]) groups[topic] = [];
      groups[topic].push(insight);
    });

    // Sort groups by count descending
    const sortedTopics = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

    // Remove old groups
    listEl.querySelectorAll('.topic-group, .no-results-text').forEach(g => g.remove());

    if (sortedTopics.length === 0 && filter) {
      const noRes = document.createElement('p');
      noRes.className = 'no-results-text';
      noRes.textContent = 'No matching insights.';
      listEl.appendChild(noRes);
      return;
    }

    sortedTopics.forEach(([topic, items]) => {
      const group = document.createElement('div');
      group.className = 'topic-group';

      const header = document.createElement('div');
      header.className = 'topic-header';
      header.innerHTML = `
        <span class="topic-name">${topic}</span>
        <span><span class="topic-count">(${items.length})</span> <span class="topic-arrow">▸</span></span>
      `;
      header.addEventListener('click', () => group.classList.toggle('expanded'));

      const itemsDiv = document.createElement('div');
      itemsDiv.className = 'topic-items';

      // Sort items newest first
      items.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));

      items.forEach(insight => {
        const item = document.createElement('div');
        item.className = 'saved-item';

        const ytUrl = insight.youtube_url
          ? (insight.timestamp_secs
              ? `${insight.youtube_url}?t=${insight.timestamp_secs}`
              : insight.youtube_url)
          : null;

        item.innerHTML = `
          <div class="item-content">
            <div class="item-title">${insight.pull_quote || insight.topic || 'Saved Insight'}</div>
            <div class="item-meta">From ${insight.guest_name || 'Lenny Rachitsky'}</div>
          </div>
          ${ytUrl ? '<div class="item-arrow">↗</div>' : ''}
        `;

        if (ytUrl) {
          item.title = 'Open source episode';
          item.addEventListener('click', () => chrome.tabs.create({ url: ytUrl }));
        }

        itemsDiv.appendChild(item);
      });

      group.appendChild(header);
      group.appendChild(itemsDiv);
      listEl.appendChild(group);
    });
  }

  function setupSearch(insights) {
    const searchEl = document.getElementById('search-bar');
    if (!searchEl) return;
    let debounceTimer;
    searchEl.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        renderSavedInsights(insights, searchEl.value.trim());
      }, 150);
    });
  }

  function setupMuteToggle(muted) {
    const muteCheckbox = document.getElementById('mute-checkbox');
    if (muted) muteCheckbox.checked = true;
    muteCheckbox.addEventListener('change', (e) => {
      const newMuted = e.target.checked;
      chrome.storage.local.set({ voiceMuted: newMuted });
      // Send MUTE_CHANGED to active tab (PRD v2 §4.5)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'MUTE_CHANGED', muted: newMuted });
        }
      });
    });
  }
});
```

- [ ] **Step 2: Verify full popup**

Reload extension. Open popup. Should show:
- Streak + shield indicator
- PM Level title + XP + gap to next
- Knowledge Map (empty or with bars if topicCounts exist)
- Search bar
- Topic-grouped saved insights (or empty state if none saved)
- Mute toggle

- [ ] **Step 3: Commit**

```bash
git add popup/popup.js
git commit -m "feat: popup dashboard — PM levels, knowledge map, topic accordion, search"
```

---

### Task 10: End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Clean state test**

Clear extension storage: in background service worker console, run:
```javascript
chrome.storage.local.clear(() => console.log('cleared'))
```

Reload extension. Open popup — should show teaching state. Click "Got it, let me try."

- [ ] **Step 2: First insight flow**

Go to Notion. Highlight PM text (e.g. "retention strategy"). Click selection dot. Postcard should appear. Score should be 7 (5 delivery + 2 streak bonus). Click Save — button should show "Your PM library starts here." Score should be 22 (7 + 15).

- [ ] **Step 3: Popup verification**

Open popup. Should show:
- 🔥 1 Days
- Intern · 22 XP · 28 → APM
- Knowledge Map with 1 topic, 1 bar filled
- Saved Insights: one group with one item
- Search bar works (type guest name → filters)

- [ ] **Step 4: Duplicate save test**

Trigger the same insight again. Click Save — should show "Already saved". Score should NOT increment.

- [ ] **Step 5: Streak saver alarm check**

In background console:
```javascript
chrome.alarms.getAll(a => console.log(a))
```
Should show `streakSaver` alarm scheduled for next 8pm.

- [ ] **Step 6: Second topic test**

Highlight different PM text (e.g. "pricing strategy"). Click dot. Save. Open popup — should show 2 topic groups in accordion, 2 bars in knowledge map. Score should be 42 (22 + 5 delivery + 15 save). Second save toast should say "New topic: [Topic]".

- [ ] **Step 7: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: post-verification tweaks for gamification v2"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 10 "Must Ship" items from PRD v2 §6 are covered in Tasks 1-10
- [x] **No placeholders:** Every step has exact code or exact commands
- [x] **Type consistency:** `topicCounts` key name matches across content-script save handler (Task 3) and popup.js reader (Task 9)
- [x] **Storage keys consistent:** `knowledge_score`, `streak`, `lastActiveDate`, `longest_streak`, `topicCounts`, `streakShield`, `savedInsights`, `voiceMuted`, `hasOnboarded` — all match between writers and readers
- [x] **XP values match PRD:** +5 deliver (Task 2), +15 save (Task 3), +2×streak (Task 2)
- [x] **PM Level thresholds match PRD:** Intern 0, APM 50, PM 150, Senior 350, Staff 700, Group 1200 (Task 9)
