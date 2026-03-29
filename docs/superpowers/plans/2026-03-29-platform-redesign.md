# Platform Redesign — Element-First Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⚠️ **Do NOT submit to Chrome Web Store until all 6 tasks are complete.** Task 1 changes host permissions — landing it alone without Tasks 2–6 wastes a Web Store review cycle and ships a broken UX.

**Goal:** Replace URL-gated content script injection and global keydown listener with element-first detection — making Lenny Live work on every platform with a text input, with a Grammarly-style badge pill UX replacing the write+pause dot.

**Architecture:** `manifest.json` changes to `<all_urls>` so content scripts inject everywhere. The global `keydown` write+pause logic moves to `focusin`/`focusout` element-level attachment. Three API-cost gates (40-word threshold, paragraph hash cache, session concept dedup) cut Groq calls ~70%. The `#ll-write-pause-dot` and `#ll-questions-panel` components are replaced by a single `#ll-badge-pill` that shows "3 patterns on [topic] →" and expands to chips on click.

**Tech Stack:** Vanilla JS, Chrome MV3, Shadow DOM, Groq `llama-3.1-8b-instant`, existing `chrome.runtime.sendMessage` message contract.

**Spec:** `docs/superpowers/specs/2026-03-29-platform-redesign.md`

---

## File Map

| File | Change type | What changes |
|---|---|---|
| `manifest.json` | Modify | `<all_urls>` in `host_permissions` + `content_scripts.matches` |
| `content/content-script.js` | Modify | focusin/focusout gate; 40-word/hash/dedup gates; badge pill UI replacing write-pause dot + questions panel; Google Docs clipboard intercept |
| `background/abstraction.js` | Modify | `generateQuestions` adds NOT_PM detection + combined chip generation in one Groq call |
| `background/service-worker.js` | Modify | `GENERATE_QUESTIONS` handler handles new return format (NOT_PM vs chips array) |

---

## Task 1: manifest.json — Universal injection

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Read current manifest state**

Open `manifest.json`. Current relevant sections:
```json
"host_permissions": [
  "*://docs.google.com/document/*",
  "*://*.notion.so/*",
  "*://*.atlassian.net/*",
  "*://*.linear.app/*",
  "https://api.elevenlabs.io/*"
],
"content_scripts": [
  {
    "matches": [
      "*://docs.google.com/document/*",
      "*://*.notion.so/*",
      "*://*.atlassian.net/*",
      "*://*.linear.app/*"
    ],
    ...
  }
]
```

- [ ] **Step 2: Replace host_permissions and content_scripts.matches**

Replace the entire `manifest.json` with:
```json
{
  "manifest_version": 3,
  "name": "Lenny Live",
  "version": "0.2.0",
  "description": "Compounded experience. Borrowed intuition.",
  "permissions": ["activeTab", "storage", "scripting", "tabs"],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
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

Note: ElevenLabs API calls come from the service worker (background context) — they don't need a `host_permission` entry since `<all_urls>` covers it. The `host_permissions` `<all_urls>` is required for content scripts to run and access page content on all domains.

- [ ] **Step 3: Manual verify — reload and test**

1. Go to `chrome://extensions`, click the reload (↻) button on Lenny Live.
2. Open **Gmail** (`mail.google.com`). Open browser console.
3. Expected log: `[LennyLive] Content script loaded — Shadow DOM ready`
4. Open **Slack** (`app.slack.com`). Check console.
5. Expected log: `[LennyLive] Content script loaded — Shadow DOM ready`
6. If you see the log on both — content script injection is working universally.

- [ ] **Step 4: Commit**

```bash
cd /Users/rajat/AntiGravity/LennyLive
git add manifest.json
git commit -m "feat: universal content script injection via <all_urls>"
```

---

## Task 2: focusin/focusout sensor gate

**Files:**
- Modify: `content/content-script.js` (lines ~958–1044)

The current write+pause logic lives inside the global `document.addEventListener('keydown', ...)` handler starting at line 961. The goal is to split this: keep the Ctrl + Escape handling in the global listener, but move the write+pause timer logic to element-level `focusin`/`focusout` listeners.

- [ ] **Step 1: Add sensor state variable after existing ambient state variables**

Find this block at approximately line 659–667:
```js
let ambientState = 'none'; // 'none' | 'selection-dot' | 'write-pause-dot' | 'questions-panel'

// Write+pause sensor state
let lastPrintableKeystroke = 0;       // timestamp of last printable keydown
let lastEagerFetchBlockContent = '';  // blockContent captured at eager fetch time
let pendingQuestions = null;          // { keyword, questions, blockContent, timestamp } | null
let eagerFetchTimer = null;           // 1.5s timer → triggers Groq fetch
let dotAppearTimer = null;            // 3.5s timer → shows write+pause dot
```

Add one variable immediately after `let dotAppearTimer = null;`:
```js
let activeSensorElement = null;       // element the write+pause sensor is currently attached to
```

- [ ] **Step 2: Add attachWritePauseSensor and detachWritePauseSensor functions**

Add these two functions immediately after the `isUserEditing()` function (around line 683):

```js
// ─── Element-First Sensor Attachment ─────────────────────────────────────────
// Attaches the write+pause keydown listener to the specific focused element.
// This replaces the global keydown approach — sensor follows the cursor, not the URL.

function onSensorKeydown(e) {
  // Only track printable characters — ignore Ctrl, Shift, Alt, arrows, etc.
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

  lastPrintableKeystroke = Date.now();

  // User is typing — cancel any pending fetch and reset
  clearTimeout(eagerFetchTimer);
  clearTimeout(dotAppearTimer);
  pendingQuestions = null;
  hideWritePauseDot(); // no-op if not visible

  // Schedule fresh eager fetch 1.5s from now
  eagerFetchTimer = setTimeout(triggerEagerFetch, 1500);
}

function attachWritePauseSensor(el) {
  // Detach from previous element first (covers focus-shift without blur)
  detachWritePauseSensor();
  activeSensorElement = el;
  el.addEventListener('keydown', onSensorKeydown);
  console.log('[LennyLive] Write+pause sensor attached to:', el.tagName, el.id || el.className.slice(0, 30));
}

function detachWritePauseSensor() {
  if (activeSensorElement) {
    activeSensorElement.removeEventListener('keydown', onSensorKeydown);
    activeSensorElement = null;
    // Cancel any pending timers — user left the field
    clearTimeout(eagerFetchTimer);
    clearTimeout(dotAppearTimer);
    console.log('[LennyLive] Write+pause sensor detached');
  }
}
```

- [ ] **Step 3: Add focusin/focusout document listeners**

Add these two listeners immediately after the `detachWritePauseSensor` function:

```js
// focusin fires when any element in the document gains focus (bubbles up).
// We only care about contenteditable divs and form inputs.
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (!el) return;
  if (el.isContentEditable || el.matches('input, textarea')) {
    attachWritePauseSensor(el);
  }
});

// focusout fires when focus leaves any element.
// Detach sensor — user is no longer typing in a monitored field.
document.addEventListener('focusout', () => {
  detachWritePauseSensor();
  hideWritePauseDot();
});
```

- [ ] **Step 4: Remove write+pause logic from the global keydown handler**

Find the global keydown listener at approximately line 961. It currently has two sections:
1. Ctrl double-tap + Escape handling (lines 962–988) — KEEP THIS
2. Write+pause sensor tracking (lines 990–1004) — REMOVE THIS

Remove this block from the global keydown listener:
```js
  // Write+pause sensor — track printable keystrokes
  // e.key.length === 1 catches regular characters; excludes Ctrl, Shift, Alt, Enter, etc.
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    lastPrintableKeystroke = Date.now();

    // User resumed typing — cancel any pending eager fetch and suppress dot.
    // Reset unconditionally: harmless if already null, prevents stale chips.
    clearTimeout(eagerFetchTimer);
    clearTimeout(dotAppearTimer);
    pendingQuestions = null;
    hideWritePauseDot(); // no-op if dot not visible

    // Start new 1.5s eager fetch timer
    eagerFetchTimer = setTimeout(triggerEagerFetch, 1500);
  }
```

After removing, the global keydown handler should only handle `e.key === 'Control'` and `e.key === 'Escape'`.

- [ ] **Step 5: Manual verify — focusin/focusout working on Slack**

1. Reload extension at `chrome://extensions`.
2. Open `app.slack.com`, open browser console.
3. Click into a Slack message compose box.
4. Expected: `[LennyLive] Write+pause sensor attached to: DIV ...`
5. Click outside the message box.
6. Expected: `[LennyLive] Write+pause sensor detached`
7. Now try on `notion.so` — same logs expected.

- [ ] **Step 6: Commit**

```bash
git add content/content-script.js
git commit -m "feat: focusin/focusout element-first sensor gate replaces global keydown"
```

---

## Task 3: API cost reduction gates in triggerEagerFetch

**Files:**
- Modify: `content/content-script.js` (the `triggerEagerFetch` function, approx lines 1011–1044)

Three gates to add: 40-word minimum, paragraph hash cache, session concept dedup.

- [ ] **Step 1: Add new state variables after `let activeSensorElement = null;`**

```js
// API cost reduction — three gates in triggerEagerFetch
let lastEagerFetchParagraphHash = '';   // first 80 chars of last submitted paragraph
const seenConceptsThisSession = new Set(); // concepts seen this tab session — avoid re-fetching
```

- [ ] **Step 2: Replace the triggerEagerFetch function entirely**

Find `function triggerEagerFetch()` at approximately line 1011. Replace the entire function with:

```js
// ─── Write+Pause Eager Fetch ──────────────────────────────────────────────────
// Called 1.5s after the last printable keystroke in a monitored element.
// Three local gates run before any Groq call:
//   1. 40-word minimum — conversational messages won't trigger
//   2. PM keyword present — no keyword = nothing to surface
//   3. Paragraph hash cache — same paragraph = serve cached chips
//   4. Session concept dedup — same concept this session = serve cached chips
function triggerEagerFetch() {
  if (state !== 'idle') return;          // don't interrupt active voice session

  // Extract paragraph — two-level: cursor block first, semantic container fallback
  const blockContent = extractPageContext();
  if (!blockContent) return;

  // Gate 1: 40-word minimum — short messages are conversational, not PM work
  const wordCount = blockContent.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 40) return;

  // Gate 2: PM keyword present — fast local check, zero API cost
  let keyword = detectPMKeywordInText(blockContent);
  if (!keyword) {
    // Cursor block may be short — check semantic container for broader keyword match
    const mainEl = document.querySelector('article, main, [role="main"]');
    const mainText = mainEl ? (mainEl.innerText || '').slice(0, 5000) : '';
    keyword = mainText ? detectPMKeywordInText(mainText) : null;
  }
  if (!keyword) return;

  // Gate 3: Paragraph hash cache — if paragraph hasn't changed meaningfully, serve cached chips
  const paragraphHash = blockContent.slice(0, 80);
  if (paragraphHash === lastEagerFetchParagraphHash && pendingQuestions) {
    console.log('[LennyLive] Write+pause: paragraph unchanged — serving cached chips');
    dotAppearTimer = setTimeout(() => {
      if (state !== 'idle') return;
      showWritePauseDot('ready');
    }, 500); // shorter delay — chips already ready
    return;
  }

  // Gate 4: Session concept dedup — same canonical concept seen this session = serve cached chips.
  // Key on TOPIC_MAP[keyword] ?? keyword so "retention" and "churn" both map to "Retention"
  // and don't fire duplicate Groq calls for the same PM domain.
  const conceptKey = TOPIC_MAP[keyword] ?? keyword;
  if (seenConceptsThisSession.has(conceptKey) && pendingQuestions?.keyword === keyword) {
    console.log('[LennyLive] Write+pause: concept already seen this session — serving cached chips');
    dotAppearTimer = setTimeout(() => {
      if (state !== 'idle') return;
      showWritePauseDot('ready');
    }, 500);
    return;
  }

  // All gates passed — proceed to Groq fetch
  lastEagerFetchParagraphHash = paragraphHash;
  lastEagerFetchBlockContent = blockContent;
  seenConceptsThisSession.add(conceptKey); // store canonical topic key, not raw keyword

  console.log('[LennyLive] Write+pause: eager Groq fetch for keyword:', keyword, '| words:', wordCount);
  chrome.runtime.sendMessage({ type: 'GENERATE_QUESTIONS', keyword, blockContent });

  // Schedule dot appearance 2s from now (= 3.5s total from last keystroke)
  dotAppearTimer = setTimeout(() => {
    if (state !== 'idle') return;
    if (pendingQuestions) {
      showWritePauseDot('ready');
    } else {
      showWritePauseDot('loading');  // questions still in flight
    }
  }, 2000);
}
```

- [ ] **Step 3: Verify gates work in browser console**

1. Reload extension.
2. Open Notion, click into a fresh block.
3. Type fewer than 40 words including "retention" — pause 2s.
4. Console should show nothing (40-word gate blocked it).
5. Type more than 40 words including "retention" — pause 2s.
6. Console should show: `[LennyLive] Write+pause: eager Groq fetch for keyword: retention | words: XX`
7. Pause again without typing. Console should show: `[LennyLive] Write+pause: paragraph unchanged — serving cached chips`

- [ ] **Step 4: Commit**

```bash
git add content/content-script.js
git commit -m "feat: 40-word threshold, paragraph hash cache, session concept dedup gates"
```

---

## Task 4: Badge pill UI — replaces write-pause dot and questions panel

**Files:**
- Modify: `content/content-script.js` — CSS, HTML elements, show/hide functions

The `#ll-write-pause-dot` spinner dot and `#ll-questions-panel` floating card are replaced by a single `#ll-badge-pill` component: a fixed bottom-right pill that reads "3 patterns on retention →". Clicking it expands an inline chips panel.

- [ ] **Step 1: Replace CSS for write-pause dot and questions panel**

Find and remove the CSS blocks for `/* 8. Write+Pause Dot */` and `/* 9. Questions Panel */` in the `style.textContent` block. Replace them with:

```css
  /* 8. Badge Pill (replaces Write+Pause Dot + Questions Panel) */
  #ll-badge-pill {
    display: none; position: fixed; bottom: 32px; right: 32px;
    z-index: 2147483647; flex-direction: column; align-items: flex-end; gap: 8px;
  }
  #ll-badge-pill.visible { display: flex; }

  .ll-badge-trigger {
    display: flex; align-items: center; gap: 10px;
    background: var(--bg-dark); border-radius: 20px;
    padding: 8px 16px 8px 12px;
    cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: transform 0.15s, box-shadow 0.15s;
    border: none; font-family: var(--font-sans);
  }
  .ll-badge-trigger:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
  .ll-badge-dot {
    width: 8px; height: 8px; background: var(--accent-orange);
    border-radius: 50%; flex-shrink: 0;
    animation: ll-pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
  }
  .ll-badge-dot.loading {
    animation: ll-spin 1s linear infinite;
    border: 2px solid rgba(255,110,64,0.3); border-top-color: var(--accent-orange);
    background: transparent; width: 10px; height: 10px;
  }
  .ll-badge-text {
    font-size: 12px; font-weight: 500; color: var(--text-light);
    white-space: nowrap;
  }
  .ll-badge-arrow { font-size: 12px; color: rgba(255,255,255,0.5); margin-left: 2px; }

  /* Chips panel — expands below badge pill */
  .ll-chips-panel {
    display: none; width: 320px;
    background: #ffffff; border: 1px solid rgba(222,192,184,0.2); border-radius: 12px;
    box-shadow: 0 32px 32px -4px rgba(26,28,28,0.06);
    flex-direction: column; overflow: hidden; font-family: var(--font-sans);
    animation: ll-postcard-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .ll-chips-panel.visible { display: flex; }
  .ll-chips-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 14px 16px 10px; border-bottom: 1px solid rgba(0,0,0,0.05);
  }
  .ll-chips-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
  .ll-chips-close { background: none; border: none; font-size: 16px; color: var(--text-muted); cursor: pointer; padding: 2px 4px; border-radius: 4px; }
  .ll-chips-close:hover { background: rgba(0,0,0,0.05); color: var(--text-dark); }
  .ll-chips-list { padding: 10px 12px 14px; display: flex; flex-direction: column; gap: 8px; }
  .ll-chip-btn {
    width: 100%; text-align: left; padding: 12px 14px;
    border-radius: 10px; border: 1px solid rgba(222,192,184,0.25);
    background: #f9f9f9; cursor: pointer;
    transition: all 0.15s; display: flex; justify-content: space-between; align-items: flex-start;
    font-family: var(--font-sans);
  }
  .ll-chip-btn:hover { background: #ffffff; border-color: rgba(162,63,29,0.35); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .ll-chip-btn-text { font-size: 13px; font-weight: 500; color: var(--text-dark); line-height: 1.4; padding-right: 12px; margin: 0; }
  .ll-chip-btn-arrow { color: rgba(162,63,29,0.4); font-size: 14px; transition: color 0.15s; flex-shrink: 0; margin-top: 1px; }
  .ll-chip-btn:hover .ll-chip-btn-arrow { color: #a23f1d; }

  /* Loading state for chips panel */
  .ll-chips-loading { padding: 20px 16px; display: flex; align-items: center; gap: 10px; }
  .ll-chips-loading-text { font-size: 12px; color: var(--text-muted); font-style: italic; }
```

- [ ] **Step 2: Replace the HTML element for write-pause dot**

Find:
```js
// 7. Write+Pause Dot
const wpDot = document.createElement('div');
wpDot.id = 'll-write-pause-dot';
shadow.appendChild(wpDot);

// 8. Questions Panel
const questionsPanel = document.createElement('div');
questionsPanel.id = 'll-questions-panel';
shadow.appendChild(questionsPanel);
```

Replace with:
```js
// 7. Badge Pill (replaces Write+Pause Dot + Questions Panel)
const badgePill = document.createElement('div');
badgePill.id = 'll-badge-pill';
badgePill.innerHTML = `
  <div class="ll-chips-panel" id="ll-chips-panel"></div>
  <button class="ll-badge-trigger" id="ll-badge-trigger" type="button">
    <span class="ll-badge-dot" id="ll-badge-dot"></span>
    <span class="ll-badge-text" id="ll-badge-text">Lenny has thoughts</span>
    <span class="ll-badge-arrow">→</span>
  </button>
`;
shadow.appendChild(badgePill);
```

Note: `badgePill` now replaces both `wpDot` and `questionsPanel` variables. Update the JS references in the next step.

- [ ] **Step 3: Replace showWritePauseDot, hideWritePauseDot, showQuestionsPanel functions**

Find and replace these three functions (approximately lines 715–777):

```js
function showWritePauseDot(mode = 'ready') { ... }
function hideWritePauseDot() { ... }
function showQuestionsPanel(questions) { ... }
function updateWritePauseDotReady() { ... }
```

Replace with:

```js
// Show badge pill — either loading state or ready state with question count
function showWritePauseDot(mode = 'ready') {
  const dot = shadow.getElementById('ll-badge-dot');
  const text = shadow.getElementById('ll-badge-text');
  const trigger = shadow.getElementById('ll-badge-trigger');

  if (mode === 'loading') {
    dot.className = 'll-badge-dot loading';
    text.textContent = 'Lenny is thinking...';
    trigger.onclick = null; // disabled while loading
  } else {
    // mode === 'ready'
    dot.className = 'll-badge-dot';
    const keyword = pendingQuestions?.keyword || '';
    const count = pendingQuestions?.questions?.length || 3;
    text.textContent = `${count} pattern${count !== 1 ? 's' : ''} on ${keyword}`;
    trigger.onclick = () => {
      if (ambientState === 'write-pause-dot' && pendingQuestions) {
        // Check if paragraph changed since questions were generated — re-fetch if so
        const currentHash = extractPageContext().slice(0, 80);
        if (currentHash !== lastEagerFetchParagraphHash) {
          console.log('[LennyLive] Badge clicked — paragraph drifted, re-fetching');
          showWritePauseDot('loading');
          const blockContent = extractPageContext();
          const keyword2 = detectPMKeywordInText(blockContent) || pendingQuestions.keyword;
          pendingQuestions = null;
          lastEagerFetchParagraphHash = currentHash;
          lastEagerFetchBlockContent = blockContent;
          chrome.runtime.sendMessage({ type: 'GENERATE_QUESTIONS', keyword: keyword2, blockContent });
          return;
        }
        showChipsPanel(pendingQuestions.questions);
      }
    };
  }

  badgePill.classList.add('visible');
  ambientState = 'write-pause-dot';
}

function hideWritePauseDot() {
  badgePill.classList.remove('visible');
  shadow.getElementById('ll-chips-panel').classList.remove('visible');
  if (ambientState === 'write-pause-dot') ambientState = 'none';
}

function showChipsPanel(questions) {
  ambientState = 'questions-panel';
  const panel = shadow.getElementById('ll-chips-panel');

  const chipsHtml = questions.map((q, i) => `
    <button class="ll-chip-btn" data-idx="${i}" type="button">
      <span class="ll-chip-btn-text">${q}</span>
      <span class="ll-chip-btn-arrow">→</span>
    </button>
  `).join('');

  panel.innerHTML = `
    <div class="ll-chips-header">
      <span class="ll-chips-title">What Lenny would ask</span>
      <button class="ll-chips-close" id="ll-chips-close-btn" type="button">✕</button>
    </div>
    <div class="ll-chips-list">${chipsHtml}</div>
  `;

  panel.classList.add('visible');

  shadow.getElementById('ll-chips-close-btn').onclick = hideAllAmbientUI;

  const chips = panel.querySelectorAll('.ll-chip-btn');
  chips.forEach(chip => {
    chip.onclick = () => {
      const idx = parseInt(chip.getAttribute('data-idx'), 10);
      fireQuestionQuery(questions[idx]);
    };
  });
}

// Called when QUESTIONS_READY arrives and dot is already showing in loading state
function updateWritePauseDotReady() {
  showWritePauseDot('ready');
}
```

- [ ] **Step 4: Update hideAllAmbientUI to use new element reference**

Find `function hideAllAmbientUI()`. Update it to reference `badgePill` and `ll-chips-panel` instead of `wpDot` and `questionsPanel`:

```js
function hideAllAmbientUI() {
  hideSelectionDot();
  hideWritePauseDot(); // handles badgePill + chips panel
  clearTimeout(eagerFetchTimer);
  clearTimeout(dotAppearTimer);
  pendingQuestions = null;

  if (ambientState === 'questions-panel') {
    const panel = shadow.getElementById('ll-chips-panel');
    panel.classList.remove('visible');
    ambientState = 'none';
  }
}
```

- [ ] **Step 5: Manual verify — badge pill appears on Notion**

1. Reload extension.
2. Open Notion, create a new page, start typing.
3. Type 50+ words including "retention" or "roadmap".
4. Stop typing for 3.5s.
5. Expected: orange badge pill appears bottom-right — "3 patterns on retention →"
6. Click the pill.
7. Expected: chips panel expands above the pill with 3 question chips.
8. Click a chip.
9. Expected: postcard appears (existing QUERY → RAG → RESPONSE flow).
10. Test on Slack — same flow should work.

- [ ] **Step 6: Commit**

```bash
git add content/content-script.js
git commit -m "feat: badge pill UI replaces write-pause dot and questions panel"
```

---

## Task 5: Combined Groq prompt — PM detection + chip generation in one call

**Files:**
- Modify: `background/abstraction.js` (the `generateQuestions` function)
- Modify: `background/service-worker.js` (the `GENERATE_QUESTIONS` handler)

Currently `generateQuestions` always generates chips. It needs to also detect if the content is NOT_PM work (e.g. a casual Slack message mentioning "strategy" in a non-PM context) and return an empty array in that case.

- [ ] **Step 1: Update generateQuestions in abstraction.js**

Find the `generateQuestions` function starting at line 104. Replace it entirely:

```js
/**
 * Generate 2-3 contextual PM question chips for the write+pause badge pill.
 * Single Groq call: detects PM context AND generates chips simultaneously.
 * Returns empty array if content is NOT PM work.
 *
 * @param {string} keyword      - PM keyword detected in the active block
 * @param {string} blockContent - Text of the active block (first 300 chars)
 * @returns {Promise<string[]>} - Array of 2-3 question strings, or [] if NOT_PM
 */
export async function generateQuestions(keyword, blockContent) {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0.4,
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `Is the text below clearly personal, social, or completely unrelated to professional product or business work — e.g., a personal email, social chat message, or content with no business subject?
If YES: output exactly NOT_PM on a single line and nothing else.
If there is ANY ambiguity or professional context: output 3 chips.
When in doubt, output 3 chips.

Output 3 short, specific questions a senior PM mentor would ask to deepen thinking on this topic. One question per line. No numbering. No bullets. No preamble. Do NOT repeat the keyword verbatim as the full question.`,
        },
        {
          role: 'user',
          content: `Keyword detected: ${keyword}\nContent: ${blockContent.slice(0, 300)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq generateQuestions failed: ${res.status} — ${errBody}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';

  // NOT_PM response — return empty array so service worker suppresses the badge
  if (text === 'NOT_PM') {
    console.log('[LennyLive] generateQuestions: NOT_PM — badge suppressed');
    return [];
  }

  // Strip leading bullets/numbers — LLaMA occasionally ignores "no numbering" instruction
  return text
    .split('\n')
    .map(q => q.replace(/^[-•\d.)\s]+/, '').trim())
    .filter(q => q.length > 5) // filter out any accidental empty or single-word lines
    .slice(0, 3);
}
```

- [ ] **Step 2: Update GENERATE_QUESTIONS handler in service-worker.js to handle empty array**

Find the `GENERATE_QUESTIONS` handler in service-worker.js (approximately line 32–54). Update the `.then` callback:

```js
  if (message.type === 'GENERATE_QUESTIONS') {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    generateQuestions(message.keyword, message.blockContent)
      .then(questions => {
        // Empty array = NOT_PM — send back with null so content script suppresses badge
        chrome.tabs.sendMessage(tabId, {
          type: 'QUESTIONS_READY',
          keyword: message.keyword,
          questions: questions.length > 0 ? questions : null,
          notPm: questions.length === 0,
        });
      })
      .catch(err => {
        console.warn('[LennyLive] generateQuestions failed:', err.message);
        chrome.tabs.sendMessage(tabId, {
          type: 'QUESTIONS_READY',
          keyword: message.keyword,
          questions: null,
          error: true,
        });
      });
    return;
  }
```

- [ ] **Step 3: Add fail-open handler in content-script.js QUESTIONS_READY listener**

Find the `QUESTIONS_READY` block inside `chrome.runtime.onMessage.addListener` in `content/content-script.js` (approximately line 1178). Replace the entire `QUESTIONS_READY` branch:

```js
// Current (suppresses badge on error):
if (message.error || !message.questions || message.questions.length === 0) {
  pendingQuestions = null;
  clearTimeout(dotAppearTimer);
  hideWritePauseDot();
  console.warn('[LennyLive] QUESTIONS_READY: Groq failed — dot suppressed');
  return;
}
```

Replace with:

```js
if (message.type === 'QUESTIONS_READY') {
  // NOT_PM: model identified non-professional content — suppress badge silently
  if (message.notPm || (!message.error && (!message.questions || message.questions.length === 0))) {
    pendingQuestions = null;
    clearTimeout(dotAppearTimer);
    hideWritePauseDot();
    console.log('[LennyLive] QUESTIONS_READY: NOT_PM — badge suppressed');
    return;
  }

  // Groq error: fail-open — local gates already validated PM intent, don't go dark.
  // Serve template chips so the badge still appears and the chip fires the RAG pipeline.
  if (message.error) {
    const kw = message.keyword || 'this topic';
    pendingQuestions = {
      keyword: kw,
      questions: [
        `What's the most common mistake PMs make around ${kw}?`,
        `How do the best product teams think about ${kw}?`,
        `What should I know about ${kw} at my stage?`,
      ],
      blockContent: lastEagerFetchBlockContent,
      timestamp: Date.now(),
    };
    console.warn('[LennyLive] QUESTIONS_READY: Groq error — serving template chips (fail-open)');
    if (ambientState === 'write-pause-dot') updateWritePauseDotReady();
    return;
  }

  // Happy path: real chips from Groq
  pendingQuestions = {
    keyword: message.keyword,
    questions: message.questions,
    blockContent: lastEagerFetchBlockContent,
    timestamp: Date.now(),
  };

  console.log('[LennyLive] QUESTIONS_READY:', message.keyword, message.questions);

  if (ambientState === 'write-pause-dot') {
    updateWritePauseDotReady();
  }
}
```

Note: Remove the existing `pendingQuestions = { ... }` block and the `if (ambientState === 'write-pause-dot') updateWritePauseDotReady()` that follow the current error check — they are now inside the rewritten handler above.

- [ ] **Step 4: Manual verify — NOT_PM suppression and fail-open**

1. Reload extension.
2. Open Gmail, compose a new email. Type 50+ words of casual text mentioning "strategy" — e.g. "Hi Sarah, our strategy for the team dinner is to book the Italian place. Let me know your thoughts on this approach. The retention of table spots at popular restaurants requires early booking. Looking forward to catching up..."
3. Stop typing 3.5s.
4. Expected: badge pill does NOT appear (NOT_PM path).
5. Open Notion, type a genuine PRD section with "retention strategy" and PM concepts.
6. Expected: badge pill DOES appear with real chips.
7. **Fail-open test:** In DevTools Network tab, block requests to `api.groq.com`. Type 50+ PM words in Notion. Stop typing 3.5s.
8. Expected: badge pill appears with 3 template questions ("What's the most common mistake PMs make around retention?", etc.).
9. Unblock Groq. Verify real chips return.

- [ ] **Step 5: Commit**

```bash
git add background/abstraction.js background/service-worker.js content/content-script.js
git commit -m "feat: combined NOT_PM detection + chip generation, fail-open on Groq errors"
```

---

## Task 6: Google Docs clipboard intercept

**Files:**
- Modify: `content/content-script.js` — add `document.oncopy` listener at bottom of file

On Google Docs, `getSelection()` returns empty (canvas renderer). Write+pause also doesn't work well there. The fallback: when a user highlights text and copies it (`Cmd+C`/`Ctrl+C`), intercept the clipboard event, check for PM keywords, and treat the copied text as a selection trigger.

- [ ] **Step 1: Add clipboard intercept listener**

Add this block immediately before the final `console.log('[LennyLive] Content script loaded...')` line at the bottom of `content-script.js`:

```js
// ─── Google Docs Clipboard Intercept ─────────────────────────────────────────
// Google Docs uses a canvas renderer — getSelection() and contenteditable detection
// both fail. Fallback: intercept copy events. When a PM copies text containing a
// PM keyword on docs.google.com, treat it as a selection trigger.
//
// UX framing: "On Google Docs, highlight + copy to ask Lenny."
// This is explicitly framed as a different interaction model, not a broken version
// of the standard flow. The behavior is honest: copy is the trigger.

if (location.hostname === 'docs.google.com') {
  document.addEventListener('copy', (e) => {
    // e.clipboardData.getData only available on cut/copy events, not paste
    const clipText = e.clipboardData?.getData('text/plain')?.trim() ?? '';

    if (clipText.length < 10 || clipText.length > 2000) return;

    const keyword = detectPMKeywordInText(clipText);
    if (!keyword) return;

    console.log('[LennyLive] Google Docs clipboard intercept — keyword:', keyword, 'length:', clipText.length);

    // Treat copied text as a selection — fire QUERY directly (same as selection dot click)
    // Small delay so the copy completes before we show UI
    setTimeout(() => {
      if (state !== 'idle') return;
      chrome.runtime.sendMessage({
        type: 'QUERY',
        transcript: '',
        selection: clipText.slice(0, 500),
        pageContext: '',
      });
    }, 100);
  });

  console.log('[LennyLive] Google Docs clipboard intercept active');
}
```

- [ ] **Step 2: Manual verify — clipboard intercept on Google Docs**

1. Reload extension.
2. Open a Google Doc (`docs.google.com`).
3. Type a sentence containing "retention" or "product-market fit".
4. Highlight that sentence with the mouse.
5. Press `Cmd+C` (Mac) or `Ctrl+C` (Windows).
6. Expected console log: `[LennyLive] Google Docs clipboard intercept — keyword: retention length: XX`
7. Expected: postcard appears with an insight about the detected keyword.
8. Verify no postcard appears when copying text without PM keywords (e.g. "Meeting notes from Tuesday").

- [ ] **Step 3: Commit**

```bash
git add content/content-script.js
git commit -m "feat: Google Docs clipboard intercept as fallback selection trigger"
```

---

## Self-Review Checklist

After completing all tasks, run through this before marking the plan done:

**Spec coverage:**
- [x] Element-first detection via focusin/focusout → Task 2
- [x] `<all_urls>` manifest change → Task 1
- [x] 40-word threshold → Task 3
- [x] Paragraph hash cache → Task 3
- [x] Session concept dedup → Task 3
- [x] Badge pill UI → Task 4
- [x] Stale chip re-generation on badge click → Task 4 (showWritePauseDot 'ready' onclick)
- [x] Combined NOT_PM + chip generation Groq call → Task 5
- [x] Google Docs clipboard intercept → Task 6
- [x] Double-tap Ctrl unchanged → existing code untouched
- [x] Selection dot unchanged → existing code untouched
- [x] Postcard unchanged → existing code untouched

**Deferred per spec:**
- Optional permissions flow with `chrome.permissions.request` — V2 (used `<all_urls>` directly for V1 simplicity)
- True inline text underline (Range API per platform) — V2
- Progressive disclosure single card (compact → expanded) — V2 (postcard already handles this)

**Type/naming consistency across tasks:**
- `badgePill` variable (Task 4) replaces both `wpDot` and `questionsPanel`
- `shadow.getElementById('ll-chips-panel')` (Task 4) — panel lives inside `badgePill`, accessed via shadow query
- `showWritePauseDot()` name preserved from original — keeps `QUESTIONS_READY` handler compatible (calls `updateWritePauseDotReady()` which calls `showWritePauseDot('ready')`)
- `hideWritePauseDot()` preserved — called in `hideAllAmbientUI()` and `detachWritePauseSensor()`
- `pendingQuestions.keyword` — same structure as before, chip-click staleness check in Task 4 uses it correctly
- `lastEagerFetchParagraphHash` set in Task 3, read in Task 4 badge click handler — defined before both tasks use it
