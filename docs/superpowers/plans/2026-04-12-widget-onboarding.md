# Widget Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move onboarding from the popup carousel into the injected shadow DOM widget, triggered by the first PM-relevant text highlight, doubling as a RAG loading state.

**Architecture:** A 2-slide panel is appended to the shadow DOM alongside the postcard. When a first-time user highlights PM-relevant text, the selectionchange handler shows the panel instead of the selection dot and immediately fires a background RAG query. On dismiss, the buffered RAG result shows as a postcard or the loading indicator appears while RAG completes. The popup reverts to a clean always-visible dashboard with a redesigned empty state.

**Tech Stack:** Vanilla JS, plain CSS, Chrome extension MV3 content script + shadow DOM, `chrome.storage.local`, `chrome.runtime.sendMessage`.

---

## File Map

| File | Change |
|---|---|
| `content/content-script.js` | Add CSS, DOM element, state variables, `showOnboarding()`, `dismissOnboarding()`, `getOnboardingConceptLabel()`; modify `selectionchange` handler, `onMessage` listener, `activateLennyLive()` |
| `popup/popup.html` | Remove carousel div + `#main-content` wrapper; add new empty state card; popup always visible |
| `popup/popup.js` | Remove all onboarding JS; update empty state |
| `popup/popup.css` | Remove all `.ob-*` + `.onboarding` rules; replace `.empty-state` with new card styles |

---

### Task 1: Add onboarding state variables and CSS to shadow DOM

**Files:**
- Modify: `content/content-script.js`

- [ ] **Step 1: Add four onboarding state variables**

  Locate the `// ─── Ambient Detection State` block (around line 671). Add a new block directly below the `let ambientState = 'none';` line:

  ```javascript
  // ─── Onboarding State ─────────────────────────────────────────────────────────
  let isOnboarding = false;           // true while onboarding panel is visible
  let onboardingCancelled = false;    // true if voice fired during onboarding — discard pending RAG
  let pendingOnboardingResult = null; // { insight, relatedInsights } | null — buffered RAG result
  let onboardingSelection = '';       // selected text captured before window.getSelection() is cleared
  ```

- [ ] **Step 2: Add onboarding CSS to shadow DOM style block**

  Locate the end of the `style.textContent = \`...\`` block — find the last CSS rule before the closing backtick (it ends just before `shadow.appendChild(style)`). Append this CSS block **inside** the template literal, after the last existing rule:

  ```css
  /* 9. Onboarding Panel */
  #ll-onboarding {
    position: fixed;
    bottom: 32px; right: 32px; width: 320px;
    background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
    font-family: var(--font-sans); z-index: 2147483647; overflow: hidden;
    display: flex; flex-direction: column;
  }
  #ll-onboarding.hidden { display: none; }
  #ll-onboarding:not(.hidden) { animation: ll-postcard-in 0.3s cubic-bezier(0.16, 1, 0.3, 1); }

  .ob-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 16px 8px; }
  .ob-logo { font-family: var(--font-serif); font-size: 16px; font-weight: 600; font-style: italic; color: var(--text-dark); }
  .ob-close { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 14px; padding: 0; transition: color 0.2s; }
  .ob-close:hover { color: var(--accent-orange); }

  .ob-body { padding: 16px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; }

  .ob-slide { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
  .ob-slide.hidden { display: none; }

  /* Slide 1 visual: large animated orange pulse dot */
  .ob-pulse-large {
    width: 48px; height: 48px;
    background: var(--accent-orange); border-radius: 50%;
    position: relative; flex-shrink: 0;
  }
  .ob-pulse-large::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: var(--accent-orange); border-radius: 50%;
    animation: ll-pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
  }

  /* Slide 2 visual: keyboard mock */
  .ob-kbd-mock { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .ob-kbd { display: flex; align-items: center; gap: 6px; }
  .ob-key {
    background: #ffffff; border: 1px solid #d1d5db; border-bottom: 3px solid #9ca3af;
    border-radius: 6px; padding: 6px 14px; font-size: 13px; font-weight: 600;
    color: var(--text-dark); box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  }
  .ob-key-sep { font-size: 14px; color: var(--text-muted); }
  .ob-kbd-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent-orange); text-align: center; }

  /* Text elements */
  .ob-headline {
    font-family: var(--font-serif); font-size: 18px; font-weight: 400;
    line-height: 1.3; color: var(--text-dark); text-align: center; margin: 0;
  }
  .ob-text {
    font-size: 13px; line-height: 1.55; color: var(--text-muted); text-align: center; margin: 0;
  }
  .ob-text strong { font-weight: 600; color: var(--text-dark); }
  .ob-concept-pill {
    background: var(--pill-bg); color: var(--pill-text); font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.05em; padding: 3px 10px; border-radius: 12px;
    display: inline-block; margin: 0 2px;
  }
  .ob-note {
    font-size: 11px; line-height: 1.45; color: var(--text-muted);
    background: rgba(255,110,64,0.06); border-left: 2px solid var(--accent-orange);
    padding: 8px 10px; border-radius: 0 4px 4px 0; width: 100%; text-align: left;
  }

  /* Footer: progress dots + action buttons */
  .ob-footer {
    border-top: 1px solid var(--border-light); padding: 12px 16px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .ob-dots { display: flex; gap: 6px; align-items: center; }
  .ob-dot-step { width: 6px; height: 6px; border-radius: 50%; background: #e2e2e2; transition: background 0.2s, width 0.2s; }
  .ob-dot-step.active { background: var(--accent-orange); width: 18px; border-radius: 3px; }
  .ob-buttons { display: flex; gap: 8px; align-items: center; }
  .ob-btn-skip {
    background: none; border: none; cursor: pointer; font-size: 12px;
    color: var(--text-muted); padding: 4px 8px; border-radius: 4px; font-family: var(--font-sans);
  }
  .ob-btn-skip:hover { color: var(--text-dark); }
  .ob-btn-primary {
    background: var(--text-dark); color: #ffffff; border: none; border-radius: 20px;
    padding: 8px 18px; font-size: 12px; font-weight: 600; cursor: pointer;
    font-family: var(--font-sans); transition: background 0.2s;
  }
  .ob-btn-primary:hover { background: var(--accent-orange-dark); }
  ```

- [ ] **Step 3: Reload extension in Chrome and open DevTools → Elements → #lenny-live-root → shadow-root**

  Verify the `#ll-onboarding` style rules are present in the shadow DOM style block. There should be no errors in the console.

- [ ] **Step 4: Commit**

  ```bash
  git add content/content-script.js
  git commit -m "feat: add onboarding state variables and CSS to shadow DOM"
  ```

---

### Task 2: Append onboarding panel HTML to shadow DOM

**Files:**
- Modify: `content/content-script.js`

- [ ] **Step 1: Create and append the `#ll-onboarding` element**

  Locate the line `shadow.appendChild(badgePill);` (the last DOM element appended to shadow). Add the following **immediately after** it:

  ```javascript
  // 8. Onboarding Panel (slides into position on first PM highlight)
  const onboardingPanel = document.createElement('div');
  onboardingPanel.id = 'll-onboarding';
  onboardingPanel.className = 'hidden';
  onboardingPanel.innerHTML = `
    <div class="ob-header">
      <span class="ob-logo">lennyLive</span>
      <button class="ob-close" id="ll-ob-close" type="button">✕</button>
    </div>
    <div class="ob-body">
      <div class="ob-slide" id="ll-ob-slide-1">
        <div class="ob-pulse-large"></div>
        <p class="ob-headline">Lenny is finding something.</p>
        <p class="ob-text" id="ll-ob-body-text">You highlighted some text. Lenny is matching it to real stories from 300+ product leaders.</p>
      </div>
      <div class="ob-slide hidden" id="ll-ob-slide-2">
        <div class="ob-kbd-mock">
          <div class="ob-kbd">
            <span class="ob-key">Ctrl</span>
            <span class="ob-key-sep">+</span>
            <span class="ob-key">Ctrl</span>
          </div>
          <span class="ob-kbd-label">double-tap to activate</span>
        </div>
        <p class="ob-headline">Ask Lenny anything.</p>
        <p class="ob-text">Double-tap <strong>Ctrl</strong>, speak your question, and Lenny responds in seconds — grounded in real guest stories and episodes.</p>
        <p class="ob-note">Chrome will ask for microphone access. This lets Lenny hear your question.</p>
      </div>
    </div>
    <div class="ob-footer">
      <div class="ob-dots">
        <div class="ob-dot-step active" id="ll-ob-dot-1"></div>
        <div class="ob-dot-step" id="ll-ob-dot-2"></div>
      </div>
      <div class="ob-buttons">
        <button class="ob-btn-skip hidden" id="ll-ob-skip" type="button">Skip</button>
        <button class="ob-btn-primary" id="ll-ob-next" type="button">Next →</button>
      </div>
    </div>
  `;
  shadow.appendChild(onboardingPanel);
  ```

- [ ] **Step 2: Add slide navigation state variable**

  Add this line right after `let onboardingSelection = '';`:

  ```javascript
  let onboardingSlide = 1; // tracks which slide is currently visible (1 or 2)
  ```

- [ ] **Step 3: Wire up button event listeners**

  Find the section `// ─── Postcard Event Listeners (set up once at load time)` and add the following event wiring block **after** the postcard listeners (after the `shadow.getElementById('ll-btn-save').addEventListener...` block):

  ```javascript
  // ─── Onboarding Event Listeners ────────────────────────────────────────────────

  shadow.getElementById('ll-ob-next').addEventListener('click', () => {
    if (onboardingSlide === 1) {
      // Advance to slide 2
      onboardingSlide = 2;
      shadow.getElementById('ll-ob-slide-1').classList.add('hidden');
      shadow.getElementById('ll-ob-slide-2').classList.remove('hidden');
      shadow.getElementById('ll-ob-dot-1').classList.remove('active');
      shadow.getElementById('ll-ob-dot-2').classList.add('active');
      shadow.getElementById('ll-ob-skip').classList.remove('hidden');
      shadow.getElementById('ll-ob-next').textContent = 'Get Started →';
    } else {
      // Get Started on slide 2 — dismiss
      onboardingSlide = 1;
      dismissOnboarding();
    }
  });

  shadow.getElementById('ll-ob-skip').addEventListener('click', () => {
    onboardingSlide = 1;
    dismissOnboarding();
  });

  shadow.getElementById('ll-ob-close').addEventListener('click', () => {
    onboardingSlide = 1;
    dismissOnboarding();
  });
  ```

- [ ] **Step 4: Reload extension; open any webpage; open DevTools → Elements → shadow-root**

  Confirm `#ll-onboarding` exists as a child of the shadow root with `class="hidden"`. No console errors.

- [ ] **Step 5: Commit**

  ```bash
  git add content/content-script.js
  git commit -m "feat: add onboarding panel HTML and slide navigation wiring to shadow DOM"
  ```

---

### Task 3: Implement showOnboarding(), dismissOnboarding(), getOnboardingConceptLabel()

**Files:**
- Modify: `content/content-script.js`

- [ ] **Step 1: Add getOnboardingConceptLabel() helper**

  Locate the `// ─── Buzzword Scanning` section (after `textMatchesPMRoot`). Add the following function **before** `scanForBuzzwords()`:

  ```javascript
  // Returns a human-readable PM concept label for the onboarding concept pill,
  // extracted from the PM_ROOTS match in the highlighted text.
  // Returns null if no clean label is available (body text falls back to generic copy).
  function getOnboardingConceptLabel(text) {
    const match = PM_ROOTS.exec(text);
    if (!match) return null;
    const stem = match[0].toLowerCase().replace(/[\s\-]+/g, '-');
    const LABEL_MAP = {
      'retent': 'Retention', 'retain': 'Retention', 'churn': 'Churn',
      'activat': 'Activation', 'growth-loop': 'Growth Loops', 'viral-growth': 'Viral Growth',
      'acquisi': 'Acquisition', 'referral': 'Referral', 'network-effect': 'Network Effects',
      'funnel': 'Conversion Funnel', 'cohort': 'Cohort Analysis', 'north-star': 'North Star Metric',
      'kpi': 'KPIs', 'okr': 'OKRs', 'nps': 'NPS', 'csat': 'CSAT',
      'dau': 'DAU / MAU', 'mau': 'DAU / MAU', 'wau': 'WAU', 'ltv': 'LTV / CAC', 'cac': 'LTV / CAC',
      'arr': 'ARR', 'mrr': 'MRR', 'product-market': 'Product-Market Fit', 'pmf': 'PMF',
      'strateg': 'Strategy', 'position': 'Positioning', 'competit': 'Competitive Moat',
      'differenti': 'Differentiation', 'moat': 'Moat', 'roadmap': 'Roadmap',
      'prioriti': 'Prioritization', 'pricing': 'Pricing', 'monetiz': 'Monetization',
      'freemium': 'Freemium', 'upsell': 'Upsell', 'subscript': 'Subscription',
      'onboard': 'Onboarding', 'aha-moment': 'Aha Moment', 'time-to-value': 'Time to Value',
      'user-journey': 'User Journey', 'drop-off': 'Drop-off', 'go-to-market': 'GTM Strategy',
      'gtm': 'GTM Strategy', 'product-led': 'Product-Led Growth', 'plg': 'PLG',
      'sprint': 'Agile / Sprint', 'backlog': 'Backlog', 'user-research': 'User Research',
      'jobs-to-be': 'Jobs to Be Done', 'jtbd': 'JTBD', 'a/b-test': 'A/B Testing',
      'experiment': 'Experimentation', 'persona': 'User Personas', 'stakehold': 'Stakeholders',
      'cross-func': 'Cross-functional', 'mvp': 'MVP', 'zero-to-one': 'Zero to One',
      '0-to-1': 'Zero to One', 'early-stage': 'Early Stage', 'pre-pmf': 'Pre-PMF',
      'founding': 'Founding PM',
    };
    return LABEL_MAP[stem] || null;
  }
  ```

- [ ] **Step 2: Add showOnboarding() function**

  Add immediately after `getOnboardingConceptLabel()`:

  ```javascript
  // Shows the onboarding panel and fires RAG in the background.
  // selectedText: the highlighted string, already captured before selection can be cleared.
  // conceptLabel: human-readable PM concept from getOnboardingConceptLabel(), or null.
  function showOnboarding(selectedText, conceptLabel) {
    isOnboarding = true;
    onboardingCancelled = false;
    pendingOnboardingResult = null;
    onboardingSlide = 1;

    // Spec §Arch-1: store selected text NOW — window.getSelection() is cleared on next click.
    onboardingSelection = selectedText;

    // Populate concept pill in slide 1 body text.
    // Using DOM API (not innerHTML) to prevent XSS from page-sourced selectedText.
    const bodyEl = shadow.getElementById('ll-ob-body-text');
    bodyEl.textContent = '';
    if (conceptLabel) {
      bodyEl.appendChild(document.createTextNode('You highlighted text about '));
      const pill = document.createElement('span');
      pill.className = 'ob-concept-pill';
      pill.textContent = conceptLabel;
      bodyEl.appendChild(pill);
      bodyEl.appendChild(document.createTextNode('. Lenny is matching it to real stories from 300+ product leaders.'));
    } else {
      bodyEl.textContent = 'You highlighted some text. Lenny is matching it to real stories from 300+ product leaders.';
    }

    // Reset slides to slide 1 state
    shadow.getElementById('ll-ob-slide-1').classList.remove('hidden');
    shadow.getElementById('ll-ob-slide-2').classList.add('hidden');
    shadow.getElementById('ll-ob-dot-1').classList.add('active');
    shadow.getElementById('ll-ob-dot-2').classList.remove('active');
    shadow.getElementById('ll-ob-skip').classList.add('hidden');
    shadow.getElementById('ll-ob-next').textContent = 'Next →';

    // Show the panel
    shadow.getElementById('ll-onboarding').classList.remove('hidden');

    // Spec §Arch-1: fire RAG immediately using stored onboardingSelection, not live selection.
    chrome.runtime.sendMessage({
      type: 'QUERY',
      transcript: '',
      selection: onboardingSelection,
      pageContext: '',
    });

    console.log('[LennyLive] Onboarding shown — RAG firing for:', onboardingSelection.slice(0, 60));
  }
  ```

- [ ] **Step 3: Add dismissOnboarding() function**

  Add immediately after `showOnboarding()`:

  ```javascript
  // Dismisses the onboarding panel (called by Skip, Get Started, or ✕).
  // If RAG result is already buffered, shows postcard immediately.
  // If RAG is still in flight, shows loading indicator — postcard follows when RESPONSE arrives.
  function dismissOnboarding() {
    chrome.storage.local.set({ hasOnboarded: true });
    isOnboarding = false;
    onboardingSelection = '';

    // Hide panel with slide-up exit
    shadow.getElementById('ll-onboarding').classList.add('hidden');

    if (pendingOnboardingResult) {
      // RAG already returned — show postcard immediately
      showPostcard(pendingOnboardingResult.insight, pendingOnboardingResult.relatedInsights || []);
      pendingOnboardingResult = null;
    } else {
      // RAG still in flight — show "Lenny is thinking…" indicator.
      // When RESPONSE arrives, the normal handleResponse() path runs and shows the postcard.
      showIndicator('loading');
    }

    console.log('[LennyLive] Onboarding dismissed');
  }
  ```

- [ ] **Step 4: Manually test the functions in DevTools**

  Load any page with the extension, open DevTools console (in page context), and run:

  ```javascript
  // Force show onboarding with a concept label
  // (access shadow functions via the extension's content script context)
  // In the service worker console, you can't call these. 
  // Instead: reload, highlight PM text, the flow will trigger once wired in Task 4.
  // For now, confirm no syntax errors by reloading extension — check console for errors.
  ```

  Expected: Extension reloads cleanly, no `ReferenceError` or `SyntaxError` in the console.

- [ ] **Step 5: Commit**

  ```bash
  git add content/content-script.js
  git commit -m "feat: implement showOnboarding, dismissOnboarding, getOnboardingConceptLabel"
  ```

---

### Task 4: Guard selectionchange handler and route first-time users to onboarding

**Files:**
- Modify: `content/content-script.js`

- [ ] **Step 1: Add isOnboarding guard at the top of the selectionchange callback**

  Find `document.addEventListener('selectionchange', () => {` (around line 1187). The inner `setTimeout` callback begins with `if (state !== 'idle') return;`. Add the `isOnboarding` guard **as the very first line** of the `setTimeout` callback, before the state check:

  ```javascript
  // Before (existing):
  selectionDebounceTimer = setTimeout(() => {
    // Don't interrupt active voice session
    if (state !== 'idle') return;

  // After:
  selectionDebounceTimer = setTimeout(() => {
    // Spec §Arch-3: prevent duplicate queries or re-triggering UI while onboarding is open
    if (isOnboarding) return;
    // Don't interrupt active voice session
    if (state !== 'idle') return;
  ```

- [ ] **Step 2: Replace the tail of selectionchange with onboarding-aware routing**

  The current selectionchange ends with:

  ```javascript
    // Position dot near selection
    if (sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return; // empty rect (Google Docs canvas)

    ambientState = 'selection-dot';
    showSelectionDot(rect);
  }, 150); // 150ms debounce — prevents flicker during drag-select
  ```

  Replace that tail (from `// Position dot near selection` to `showSelectionDot(rect);`) with:

  ```javascript
    // Position dot near selection
    if (sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return; // empty rect (Google Docs canvas)

    // Check onboarding status — async read is ~1ms; text is already captured in closure above.
    chrome.storage.local.get(['hasOnboarded'], (data) => {
      if (isOnboarding) return; // guard again after async gap
      if (!data.hasOnboarded) {
        // First-time user: show onboarding panel instead of selection dot.
        // text is in closure — safe; selection may already be cleared.
        const conceptLabel = getOnboardingConceptLabel(text);
        showOnboarding(text, conceptLabel);
      } else {
        // Returning user: normal selection dot behaviour.
        ambientState = 'selection-dot';
        showSelectionDot(rect);
      }
    });
  }, 150); // 150ms debounce — prevents flicker during drag-select
  ```

- [ ] **Step 3: Reload extension; open DevTools; clear `hasOnboarded` from storage**

  In the DevTools console (Extensions → Service Worker → Console), run:

  ```javascript
  chrome.storage.local.remove('hasOnboarded');
  ```

- [ ] **Step 4: Highlight PM text on any page**

  Highlight a sentence containing a PM word (e.g. "user retention strategy"). Expected:
  - Onboarding panel slides up bottom-right (320px, same position as postcard)
  - Slide 1 shows with animated orange pulse dot
  - Body text shows the concept pill (e.g. "Retention") if matched, or generic copy if not
  - Console shows `[LennyLive] Onboarding shown — RAG firing for: user retention strategy`

- [ ] **Step 5: Verify slide navigation**

  Click "Next →" → Slide 2 appears with keyboard mock. Click "Skip" → panel hides. Either "Lenny is thinking…" indicator appears briefly, or postcard appears if RAG already returned.

- [ ] **Step 6: Highlight PM text again (after dismissing)**

  Expected: normal selection dot appears (hasOnboarded is now true in storage).

- [ ] **Step 7: Commit**

  ```bash
  git add content/content-script.js
  git commit -m "feat: route first-time users to onboarding panel on PM highlight"
  ```

---

### Task 5: Buffer RESPONSE during onboarding + cancel on double-tap Ctrl

**Files:**
- Modify: `content/content-script.js`

- [ ] **Step 1: Modify the onMessage RESPONSE handler to buffer during onboarding**

  Find the `chrome.runtime.onMessage.addListener` block (around line 1304). The current handler is:

  ```javascript
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'RESPONSE') { handleResponse(message); }
    if (message.type === 'AUDIO')    { playAudio(message.audio); }
  ```

  Replace the `RESPONSE` line with this expanded block:

  ```javascript
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'RESPONSE') {
      // Spec §Arch-2: buffer result while onboarding is visible — don't call showPostcard yet.
      if (isOnboarding) {
        if (message.status === 'ok' && message.insight) {
          pendingOnboardingResult = { insight: message.insight, relatedInsights: message.relatedInsights || [] };
          console.log('[LennyLive] Onboarding: RAG result buffered — will show on dismiss');
        } else {
          pendingOnboardingResult = null; // no results or error — dismiss cleanly
        }
        return;
      }
      // Spec §Arch-2: voice mode took over — silently discard this text RAG result.
      if (onboardingCancelled) {
        onboardingCancelled = false;
        console.log('[LennyLive] Discarding stale onboarding RAG result (voice took over)');
        return;
      }
      handleResponse(message);
    }
    if (message.type === 'AUDIO')    { playAudio(message.audio); }
  ```

- [ ] **Step 2: Modify activateLennyLive() to cancel onboarding if voice fires during it**

  Find `function activateLennyLive()` (around line 1223):

  ```javascript
  function activateLennyLive() {
    if (state !== 'idle') return;
    hideAllAmbientUI();   // clear any active ambient dots before voice activates
    state = 'listening';
    playPing();
    showIndicator('listening');
    startListening(); // defined below
  }
  ```

  Replace it with:

  ```javascript
  function activateLennyLive() {
    if (state !== 'idle') return;

    // Spec §Arch-2: voice fired while onboarding is open — cancel onboarding.
    // Set onboardingCancelled so the in-flight text RAG result is silently discarded when it arrives.
    if (isOnboarding) {
      onboardingCancelled = true;
      isOnboarding = false;
      onboardingSelection = '';
      pendingOnboardingResult = null;
      shadow.getElementById('ll-onboarding').classList.add('hidden');
      console.log('[LennyLive] Double-tap Ctrl during onboarding — onboarding cancelled, voice takes over');
    }

    hideAllAmbientUI();
    state = 'listening';
    playPing();
    showIndicator('listening');
    startListening();
  }
  ```

- [ ] **Step 3: Test the buffering path**

  1. Clear `hasOnboarded` in storage (see Task 4 Step 3).
  2. Highlight PM text → onboarding panel appears.
  3. Wait ~3 seconds for RAG to return in background.
  4. Click "Next →" then "Get Started →".

  Expected:
  - If RAG returned before dismiss: postcard appears immediately (no "Lenny is thinking…").
  - If RAG still in flight: "Lenny is thinking…" indicator shows, then postcard follows within a second.

- [ ] **Step 4: Test the voice cancellation path**

  1. Clear `hasOnboarded`.
  2. Highlight PM text → onboarding appears.
  3. Immediately double-tap Ctrl before RAG returns.

  Expected:
  - Onboarding panel hides immediately.
  - Voice listening indicator appears ("Lenny is listening...").
  - No postcard collision — text RAG result is silently discarded if it arrives later.

- [ ] **Step 5: Commit**

  ```bash
  git add content/content-script.js
  git commit -m "feat: buffer RESPONSE during onboarding, cancel on voice activation"
  ```

---

### Task 6: Popup cleanup — HTML

**Files:**
- Modify: `popup/popup.html`

- [ ] **Step 1: Replace popup.html entirely with clean structure**

  The current file has a carousel div and a hidden `#main-content` wrapper. Replace the full file content with:

  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="popup.css">
    <!-- No external font requests — MV3 CSP blocks them. System font stack used instead. -->
  </head>
  <body>

    <!-- Header -->
    <header>
      <div class="logo">
        <div class="logo-dot"></div>
        <span class="logo-name">lennyLive</span>
      </div>
    </header>
    <hr class="divider">

    <!-- Status & Mute -->
    <section class="status-section">
      <div class="status-indicator">
        <div class="pulse-dot"></div>
        <span class="status-text">Status: Ready</span>
      </div>
      <label class="mute-toggle">
        <input type="checkbox" id="mute-checkbox">
        <span class="toggle-slider"></span>
        <span class="mute-label">Mute</span>
      </label>
    </section>

    <!-- Gamification Stats -->
    <section class="stats-grid">
      <div class="stat-card">
        <span class="stat-title">🔥 Streak</span>
        <span class="stat-value"><span id="streak-value">0</span> Days</span>
      </div>
      <div class="stat-card">
        <span class="stat-title">🧠 Score</span>
        <span class="stat-value" id="score-value">0</span>
      </div>
    </section>

    <!-- Saved Insights -->
    <section class="saved-insights-section">
      <div class="saved-header">
        <h2>Saved Insights</h2>
      </div>
      <div id="saved-list" class="saved-list">
        <div class="empty-state-card">
          <p class="empty-state-text"><span class="empty-highlight">Highlight</span> any text on a webpage to get your first Lenny insight. Then hit 🔖 to save it here.</p>
        </div>
      </div>
    </section>

    <script src="popup.js"></script>
  </body>
  </html>
  ```

- [ ] **Step 2: Open the popup (click extension icon)**

  Expected:
  - Dashboard renders immediately — no white flash, no invisible `display:none` wrapper.
  - Stats section, mute toggle, and "Saved Insights" header all visible.
  - Empty state card shows "Highlight any text on a webpage…" text.

- [ ] **Step 3: Commit**

  ```bash
  git add popup/popup.html
  git commit -m "feat: remove popup carousel, restore clean always-visible dashboard structure"
  ```

---

### Task 7: Popup cleanup — JS

**Files:**
- Modify: `popup/popup.js`

- [ ] **Step 1: Replace popup.js with carousel-free version**

  The current file has onboarding JS (showSlide, finishOnboarding, showMain, dot click handlers, hasOnboarded storage check). Replace the full file with:

  ```javascript
  // popup/popup.js
  // Reads from chrome.storage.local on open to populate the dashboard.
  // Storage keys used: streak, lastActiveDate, knowledge_score, savedInsights, voiceMuted
  // NOTE: hasOnboarded is no longer read here — onboarding now lives in content-script.js.

  document.addEventListener('DOMContentLoaded', () => {
    const streakEl     = document.getElementById('streak-value');
    const scoreEl      = document.getElementById('score-value');
    const savedListEl  = document.getElementById('saved-list');
    const muteCheckbox = document.getElementById('mute-checkbox');

    // ─── Dashboard ─────────────────────────────────────────────────
    chrome.storage.local.get(['streak', 'knowledge_score', 'savedInsights', 'voiceMuted'], (data) => {
      // 1. Gamification stats
      if (data.streak !== undefined) streakEl.textContent = data.streak;
      if (data.knowledge_score !== undefined) scoreEl.textContent = data.knowledge_score;

      // 2. Mute toggle
      if (data.voiceMuted) muteCheckbox.checked = true;

      // 3. Saved insights — most recent 5, clickable to YouTube at exact timestamp
      if (data.savedInsights && data.savedInsights.length > 0) {
        savedListEl.innerHTML = '';
        const recent = data.savedInsights.slice(-5).reverse();

        recent.forEach(insight => {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'saved-item';

          const ytUrl = insight.youtube_url
            ? (insight.timestamp_secs
                ? `${insight.youtube_url}?t=${insight.timestamp_secs}`
                : insight.youtube_url)
            : null;

          itemDiv.innerHTML = `
            <div class="item-icon">📄</div>
            <div class="item-content">
              <div class="item-title">${insight.topic || 'Saved Insight'}</div>
              <div class="item-meta">From ${insight.guest_name || 'Lenny Rachitsky'}</div>
            </div>
            ${ytUrl ? '<div class="item-arrow">↗</div>' : ''}
          `;

          if (ytUrl) {
            itemDiv.title = 'Open source episode';
            itemDiv.addEventListener('click', () => chrome.tabs.create({ url: ytUrl }));
          }

          savedListEl.appendChild(itemDiv);
        });
      }
      // If savedInsights is empty or missing, the empty-state-card from HTML remains visible.
    });

    // Mute toggle — persists across popup opens
    muteCheckbox.addEventListener('change', (e) => {
      chrome.storage.local.set({ voiceMuted: e.target.checked });
    });
  });
  ```

- [ ] **Step 2: Open popup; verify no JS errors**

  Open DevTools → Extensions → click the extension → Inspect popup. In the console, confirm there are no `ReferenceError` or `TypeError` messages.

- [ ] **Step 3: Commit**

  ```bash
  git add popup/popup.js
  git commit -m "feat: remove onboarding JS from popup — onboarding now lives in widget"
  ```

---

### Task 8: Popup cleanup — CSS

**Files:**
- Modify: `popup/popup.css`

- [ ] **Step 1: Remove the onboarding CSS block**

  Find the comment `/* ─── Onboarding Overlay ─────────────────────────────────────────── */` (around line 266). Delete everything from that comment to the end of the file (the `.ob-btn-next:hover` rule is the last one). This removes all `.onboarding`, `.ob-slide`, `.ob-visual`, `.ob-badge-mock`, `.ob-kbd-mock`, `.ob-stats-mock`, `.ob-headline`, `.ob-body`, `.ob-note`, `.ob-nav`, `.ob-dots`, `.ob-dot`, `.ob-btn-skip`, `.ob-btn-next` rules.

- [ ] **Step 2: Replace the old .empty-state rule with the new card styles**

  Find the existing `.empty-state` rule (currently around line 258):

  ```css
  .empty-state {
    font-size: 12px;
    color: var(--text-tertiary);
    font-style: italic;
    text-align: center;
    padding: 16px;
  }
  ```

  Replace it with:

  ```css
  /* Empty state — shown when no saved insights yet */
  .empty-state-card {
    border: 1px solid var(--card-border);
    border-radius: 8px;
    padding: 20px 16px;
    background: #f9f8f4;
  }

  .empty-state-text {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
    text-align: center;
    margin: 0;
  }

  .empty-highlight {
    color: var(--accent-orange);
  }
  ```

- [ ] **Step 3: Remove `position: relative` from body if it was added only for onboarding overlay**

  Check the `body` rule (around line 22). The `position: relative` comment reads `/* needed for onboarding overlay positioning */`. Since the overlay is gone, remove that property:

  ```css
  /* Before: */
  body {
    width: 320px;
    background-color: var(--bg-color);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    padding: 0;
    overflow-x: hidden;
    position: relative; /* needed for onboarding overlay positioning */
  }

  /* After: */
  body {
    width: 320px;
    background-color: var(--bg-color);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    padding: 0;
    overflow-x: hidden;
  }
  ```

- [ ] **Step 4: Open popup and inspect visually**

  Expected:
  - Popup opens without carousel (clean dashboard immediately).
  - Empty state card renders: soft border, italic serif text, "Highlight" in orange.
  - If savedInsights exist in storage, the list renders correctly over the card.
  - No layout shifts, no missing styles.

- [ ] **Step 5: Commit**

  ```bash
  git add popup/popup.css
  git commit -m "feat: remove onboarding CSS from popup, add empty state card styles"
  ```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task(s) |
|---|---|
| Trigger on PM_ROOTS match + hasOnboarded false | Task 4 |
| Show onboarding panel instead of selection dot | Task 4 |
| Background RAG fires immediately when panel appears | Task 3 (showOnboarding) |
| Panel: 320px bottom-right, slide-up animation, postcard CSS vars | Task 1 (CSS) |
| Slide 1: pulse dot + headline + concept pill in body | Task 2 (HTML) + Task 3 |
| Slide 2: keyboard mock + mic note + Skip + Get Started | Task 2 (HTML) |
| Dismiss: set hasOnboarded, hide panel, show postcard or loading | Task 3 (dismissOnboarding) |
| Buffer RESPONSE while isOnboarding is true | Task 5 |
| Cancel onboarding + set onboardingCancelled on voice activation | Task 5 |
| selectionchange guard: `if (isOnboarding) return` | Task 4 |
| onboardingSelection captured before RAG fires | Task 3 (showOnboarding) |
| Popup: remove carousel HTML | Task 6 |
| Popup: remove #main-content wrapper | Task 6 |
| Popup: new empty state card | Task 6 |
| popup.js: remove all onboarding logic | Task 7 |
| popup.css: remove .ob-* rules | Task 8 |
| popup.css: add empty state card style | Task 8 |

**No placeholders or TBD items found.**

**Type consistency check:**
- `dismissOnboarding()` references `pendingOnboardingResult.insight` and `.relatedInsights` — matches the shape set in Task 5's onMessage handler (`{ insight: message.insight, relatedInsights: message.relatedInsights || [] }`). ✓
- `showOnboarding(text, conceptLabel)` stores `text` into `onboardingSelection` before `chrome.runtime.sendMessage` — matches spec §Arch-1. ✓
- `getOnboardingConceptLabel(text)` takes the same `text` string captured in selectionchange. ✓
- `onboardingSlide` (let, integer) initialized to 1 in both state declaration and `showOnboarding()` reset. ✓
- All four state variables declared in Task 1 are read/written consistently across Tasks 3, 4, and 5. ✓
