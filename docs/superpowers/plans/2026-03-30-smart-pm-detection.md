# Smart PM Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.
> **DO NOT EXECUTE** until Rajat approves the spec at `docs/superpowers/specs/2026-03-30-smart-pm-detection.md` and answers the two open design questions.

**Goal:** Replace static PM_BUZZWORDS keyword detection with hybrid PM_ROOTS regex (selection/reading) + Groq-only detection (write+pause), eliminating false positives and catching morphological variants.

**Architecture:** Three-layer approach — PM_ROOTS instant regex for triggers with <100ms budget; Groq concept extraction for write+pause (Groq fires at 1.5s, badge at 3.5s, latency absorbed); `generateQuestions` returns `{concept, questions}` so badge label and cache key come from Groq, not a static list.

**Tech Stack:** Vanilla JS, Chrome MV3, Groq llama-3.1-8b-instant

---

## File Map

- Modify: `content/content-script.js` — PM_BUZZWORDS → PM_ROOTS, remove Gate 2, update 4 callsites
- Modify: `background/abstraction.js` — generateQuestions new prompt + return shape
- Modify: `background/service-worker.js` — GENERATE_QUESTIONS handler updated for new return shape

---

## Task 1: PM_ROOTS regex + textMatchesPMRoot function

**Files:**
- Modify: `content/content-script.js` — replace PM_BUZZWORDS declaration and detectPMKeywordInText function

- [ ] **Step 1: Replace PM_BUZZWORDS array with PM_ROOTS regex**

Find the `const PM_BUZZWORDS = [...]` block (currently ~lines 1465–1477). Replace it entirely with:

```js
// PM_ROOTS — stem-based regex for instant local detection (selection dot, reading sensor, clipboard).
// Uses word stems so morphological variants match: retent = retention/retentive/retaining,
// activat = activation/activated/activating, strateg = strategy/strategic/strategize.
// Multi-word phrases use [\s\-_]+ as separators (NOT . which matches any char).
// NOTE: write+pause no longer uses this — Groq owns that detection path.
const PM_ROOTS = /retent|retain(?!er)|churn|activat|growth[\s-]+loop|viral[\s-]+growth|acquisi|referral|network[\s-]+effect|funnel|cohort|north[\s-]+star|KPI|OKR|NPS|CSAT|DAU|MAU|WAU|LTV|CAC|ARR|MRR|product[\s-]+market|PMF|strateg|position(?:ing)?|competit|differenti|moat|roadmap|prioriti|pricing|monetiz|freemium|paywall|upsell|subscript|free[\s-]+trial|revenue[\s-]+model|onboard|aha[\s-]+moment|time[\s-]+to[\s-]+value|user[\s-]+journey|drop[\s-]+off|go[\s-]+to[\s-]+market|GTM|product[\s-]+led|PLG|sprint|backlog|epic|user[\s-]+stor|feature[\s-]+flag|dogfood|rollout|post[\s-]+mortem|user[\s-]+research|jobs[\s-]+to[\s-]+be|JTBD|A[\/\s]B[\s-]+test|experiment|persona(?!l\b)|stakehold|cross[\s-]+func|buy[\s-]+in|one[\s-]+pager|customer[\s-]+develop|feedback[\s-]+loop|feature[\s-]+request|power[\s-]+user|win[\s-]+loss|marketplac|cold[\s-]+start|MVP|zero[\s-]+to[\s-]+one|0[\s-]+to[\s-]+1|early[\s-]+stage|pre[\s-]+PMF|founding/i;
```

**Negative lookaheads added for high-noise stems:**
- `retain(?!er)` — avoids matching "retainer" (legal/dental)
- `persona(?!l\b)` — avoids matching "personal"

- [ ] **Step 2: Replace detectPMKeywordInText with textMatchesPMRoot**

Find `function detectPMKeywordInText(text)` (currently ~lines 1507–1515). Replace entirely with:

```js
// Quick boolean PM root check — used by selection dot, reading sensor, and clipboard intercept.
// Write+pause does NOT use this — it sends to Groq directly after the 40-word threshold.
function textMatchesPMRoot(text) {
  return PM_ROOTS.test(text.slice(0, 5000));
}
```

- [ ] **Step 3: Verify regex in browser console**

Open any page, open DevTools console, paste:
```js
// Should be true:
/retent|retain(?!er)/i.test("We need to improve our user retention strategy")
/retent|retain(?!er)/i.test("The team is focused on retaining early users")
// Should be false:
/retent|retain(?!er)/i.test("I'm retaining a lawyer for this case")
/persona(?!l\b)/i.test("I have a personal goal")
// Should be true:
/persona(?!l\b)/i.test("We built three user personas for this product")
```

All should return the expected boolean.

- [ ] **Step 4: Commit**

```bash
git add content/content-script.js
git commit -m "feat: PM_ROOTS stem regex replaces PM_BUZZWORDS array, textMatchesPMRoot replaces detectPMKeywordInText"
```

---

## Task 2: Update selectionchange handler and scanForBuzzwords to use textMatchesPMRoot

**Files:**
- Modify: `content/content-script.js` — 2 callsites

- [ ] **Step 1: Update selectionchange handler**

Find the `selectionchange` listener (~line 1193). The current check:
```js
const hasPMKeyword = PM_BUZZWORDS.some(word => {
  const re = new RegExp(`\\b${word}\\b`, 'i');
  return re.test(text);
});

if (!hasPMKeyword) {
  hideSelectionDot();
  return;
}
```

Replace with:
```js
if (!textMatchesPMRoot(text)) {
  hideSelectionDot();
  return;
}
```

- [ ] **Step 2: Update scanForBuzzwords**

Find `function scanForBuzzwords()` (~line 1522). The current loop:
```js
for (const buzzword of PM_BUZZWORDS) {
  const regex = new RegExp(`\\b${buzzword}\\b`, 'i');
  if (!regex.test(text)) continue;
  const displayTopic = getDisplayTopic(buzzword);
  ...
}
```

Replace the loop with a single boolean check. The glow dot drops the topic label (shows "Lenny has thoughts →" instead of "Lenny has thoughts on Retention"). Simpler — user learns topic when they click:

```js
if (!textMatchesPMRoot(text)) return;

const displayTopic = 'PM concepts'; // generic label — Groq identifies specific topic on click
```

Then continue with the rest of the cooldown logic, replacing `buzzword` references with `displayTopic`.

- [ ] **Step 3: Update Google Docs clipboard intercept**

Find the `document.addEventListener('copy', ...)` block at the bottom. Change:
```js
const keyword = detectPMKeywordInText(clipText);
if (!keyword) return;
```
To:
```js
if (!textMatchesPMRoot(clipText)) return;
```

- [ ] **Step 4: Commit**

```bash
git add content/content-script.js
git commit -m "feat: selection dot and reading sensor use PM_ROOTS via textMatchesPMRoot"
```

---

## Task 3: Remove Gate 2 from triggerEagerFetch, clean up badge-click re-fetch

**Files:**
- Modify: `content/content-script.js` — triggerEagerFetch and badge onclick handler

- [ ] **Step 1: Remove Gate 2 from triggerEagerFetch**

Find `function triggerEagerFetch()`. Remove the Gate 2 block entirely:
```js
// DELETE THIS ENTIRE BLOCK:
// Gate 2: PM keyword present — fast local check, zero API cost
let keyword = detectPMKeywordInText(blockContent);
if (!keyword) {
  // Cursor block may be short — check semantic container for broader keyword match
  const mainEl = document.querySelector('article, main, [role="main"]');
  const mainText = mainEl ? (mainEl.innerText || '').slice(0, 5000) : '';
  keyword = mainText ? detectPMKeywordInText(mainText) : null;
}
if (!keyword) return;

// Canonical concept key — "retention" and "churn" both map to "Retention" via TOPIC_MAP
const conceptKey = TOPIC_MAP[keyword] ?? keyword;
```

After deletion, Gates 3 and 4 will reference `conceptKey`. Update them to use `paragraphHash` as the only local key until Groq returns the concept:

```js
// Gate 3: same paragraph hash — skip
const paragraphHash = blockContent.slice(0, 80);
if (paragraphHash === lastEagerFetchParagraphHash) {
  // Restore cached chips if available (from prior Groq call for this paragraph)
  if (pendingQuestions) {
    const cached = sessionChipsCache.get(pendingQuestions.keyword);
    if (cached) {
      pendingQuestions = { ...cached, blockContent, timestamp: Date.now() };
      console.log('[LennyLive] Write+pause: paragraph unchanged — restoring cached chips');
      dotAppearTimer = setTimeout(() => { if (state !== 'idle') return; showWritePauseDot('ready'); }, 500);
    }
  }
  return;
}

// Gate 4: session dedup by last returned concept
// concept is populated in sessionChipsCache after QUESTIONS_READY happy path
// Check if we already have chips for the currently active concept
const lastConcept = pendingQuestions?.keyword;
if (lastConcept && sessionChipsCache.has(lastConcept)) {
  const cached = sessionChipsCache.get(lastConcept);
  pendingQuestions = { ...cached, blockContent, timestamp: Date.now() };
  lastEagerFetchParagraphHash = paragraphHash;
  lastEagerFetchBlockContent = blockContent;
  console.log('[LennyLive] Write+pause: concept cached — restoring chips');
  dotAppearTimer = setTimeout(() => { if (state !== 'idle') return; showWritePauseDot('ready'); }, 500);
  return;
}
```

Update the Groq send line — no keyword to pass:
```js
console.log('[LennyLive] Write+pause: sending to Groq for concept detection | words:', wordCount);
chrome.runtime.sendMessage({ type: 'GENERATE_QUESTIONS', keyword: '', blockContent });
```

- [ ] **Step 2: Update badge-click paragraph-drift re-fetch**

Find the badge trigger's `onclick` handler (~line 832):
```js
// CURRENT (broken after detectPMKeywordInText deleted):
const keyword2 = detectPMKeywordInText(blockContent) || pendingQuestions.keyword;
```

Replace with:
```js
// Use existing concept as hint — Groq will re-identify if paragraph has shifted
const keyword2 = pendingQuestions.keyword || '';
```

- [ ] **Step 3: Update comment block at top of triggerEagerFetch**

Update the comment to reflect the new gate structure:
```js
// Three local gates run before any Groq call:
//   1. 40-word minimum — conversational messages won't trigger
//   2. Paragraph hash cache — same paragraph = serve cached chips
//   3. Session concept dedup — same concept this session = serve cached chips
// No keyword gate — Groq owns PM detection for write+pause.
```

- [ ] **Step 4: Commit**

```bash
git add content/content-script.js
git commit -m "feat: write+pause skips keyword gate, sends paragraph straight to Groq for concept detection"
```

---

## Task 4: Update generateQuestions to return {concept, questions}

**Files:**
- Modify: `background/abstraction.js` — updated system prompt, new return shape

- [ ] **Step 1: Update the system prompt in generateQuestions**

Find the `content` field of the system message in `generateQuestions`. Replace the system prompt with:

```js
content: `Is the text below clearly personal, social, or completely unrelated to professional product or business work — e.g., a personal email, social chat message, or content with no business subject?
If YES: output exactly NOT_PM on a single line and nothing else.
If there is ANY ambiguity or professional context: identify the most relevant PM concept and output 3 chips.
When in doubt, output 3 chips.

Output format when generating chips:
CONCEPT: [2-4 word PM topic name, e.g. "Retention Strategy", "North Star Metrics", "GTM Motion"]
[question 1]
[question 2]
[question 3]

Rules: One question per line. No numbering. No bullets. No preamble. Do NOT repeat the keyword verbatim as the full question. The CONCEPT line must be first.`,
```

- [ ] **Step 2: Update the response parser**

Find the parser block after `const text = data.choices?.[0]?.message?.content?.trim() ?? '';`.

Replace the current parser:
```js
if (text.toUpperCase().startsWith('NOT_PM')) {
  console.log('[LennyLive] generateQuestions: NOT_PM — badge suppressed');
  return [];
}

return text
  .split('\n')
  .map(q => q.replace(/^[-•\d.)\s]+/, '').trim())
  .filter(q => q.length > 5)
  .slice(0, 3);
```

With:
```js
if (text.toUpperCase().startsWith('NOT_PM')) {
  console.log('[LennyLive] generateQuestions: NOT_PM — badge suppressed');
  return { concept: null, questions: [] };
}

const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// Extract CONCEPT line
let concept = '';
const conceptLineIdx = lines.findIndex(l => l.toUpperCase().startsWith('CONCEPT:'));
if (conceptLineIdx !== -1) {
  concept = lines[conceptLineIdx].replace(/^CONCEPT:\s*/i, '').trim();
  lines.splice(conceptLineIdx, 1); // remove concept line from questions
}
if (!concept) concept = 'PM Insights'; // fallback if Groq doesn't output CONCEPT line

const questions = lines
  .map(q => q.replace(/^[-•\d.)\s]+/, '').trim())
  .filter(q => q.length > 5)
  .slice(0, 3);

return { concept, questions };
```

- [ ] **Step 3: Verify return shape in the function signature JSDoc**

Update the `@returns` comment:
```js
 * @returns {Promise<{concept: string, questions: string[]} | {concept: null, questions: []}>}
```

- [ ] **Step 4: Commit**

```bash
git add background/abstraction.js
git commit -m "feat: generateQuestions returns {concept, questions} — concept drives badge label and cache key"
```

---

## Task 5: Update service-worker and content-script for new return shape

**Files:**
- Modify: `background/service-worker.js` — GENERATE_QUESTIONS handler
- Modify: `content/content-script.js` — QUESTIONS_READY handler, fail-open template chips

- [ ] **Step 1: Update GENERATE_QUESTIONS handler in service-worker.js**

Find the `.then(questions => {` callback in the GENERATE_QUESTIONS handler. Update it:

```js
.then(result => {
  // result = { concept, questions } or { concept: null, questions: [] }
  const isEmpty = !result.questions || result.questions.length === 0;
  chrome.tabs.sendMessage(tabId, {
    type: 'QUESTIONS_READY',
    keyword: result.concept || '',     // concept drives badge label
    questions: isEmpty ? null : result.questions,
    notPm: isEmpty,
  });
})
```

- [ ] **Step 2: Update fail-open template in content-script.js QUESTIONS_READY handler**

Find the fail-open branch in the QUESTIONS_READY handler:
```js
const kw = message.keyword || 'this topic';
pendingQuestions = {
  keyword: kw,
  questions: [
    `What's the most common mistake PMs make around ${kw}?`,
    ...
  ],
```

This still works — `message.keyword` is now the Groq-returned concept string (e.g. "Retention Strategy") or empty string. The `|| 'this topic'` fallback handles the empty case. No change needed.

- [ ] **Step 3: Verify QUESTIONS_READY sessionChipsCache set**

Find in QUESTIONS_READY happy path:
```js
const ck = TOPIC_MAP[message.keyword] ?? message.keyword;
sessionChipsCache.set(ck, { keyword: message.keyword, questions: message.questions });
```

Update to not use TOPIC_MAP (concept from Groq is already canonical):
```js
const ck = message.keyword || 'unknown'; // concept from Groq — already canonical
sessionChipsCache.set(ck, { keyword: message.keyword, questions: message.questions });
```

- [ ] **Step 4: Commit**

```bash
git add background/service-worker.js content/content-script.js
git commit -m "feat: GENERATE_QUESTIONS handler and QUESTIONS_READY use Groq concept as badge label and cache key"
```

---

## Verification checklist

After all 5 tasks complete:

1. **Stem matching works**: Open Notion, type "We are struggling with retaining our early users in the first week" (40+ words). Pause 3.5s → badge appears. (No keyword "retention" needed — "retaining" triggers Groq path.)

2. **NOT_PM suppression**: Type 50+ words of clearly personal content (wedding planning, sports commentary). Pause 3.5s → no badge.

3. **Badge label is Groq concept**: Badge shows "3 patterns on Retention Strategy →" (not "3 patterns on retention") — concept string from Groq.

4. **Selection dot on stems**: Highlight "The team is working on retaining power users in the freemium tier" → orange dot appears. (PM_ROOTS matches "retain" and "freemium".)

5. **Selection dot NOT on personal text**: Highlight "I'm retaining a lawyer for my divorce" → no dot. (`retain(?!er)` catches "retaining" but the surrounding text has no other PM roots, and the regex will still match "retain" here... actually this test may fail — see open concern below.)

6. **Reading sensor ambient dot**: Open a PM article, wait 20s → glow dot appears saying "Lenny has thoughts →".

7. **Google Docs clipboard**: Paste PM text into a Google Doc, copy some of it → postcard fires.

---

## Open questions (MUST be answered by Rajat before execution)

**Q1**: Reading mode glow dot label — should it say "Lenny has thoughts →" (generic, simpler) or keep the topic label "Lenny has thoughts on Retention"? This determines whether `PM_BUZZWORDS` and `TOPIC_MAP` are kept at all.

**Q2**: Selection dot for "retaining a lawyer" — PM_ROOTS will still match `retain` in this sentence because the stem is present. Selection false positives cost zero (no API call). Is this acceptable, or should we add more aggressive negative lookaheads for clearly legal/dental contexts?
