# Smart PM Detection — Spec

> Status: DRAFT — awaiting approval before execution
> Author: Claude Code (planning session 2026-03-30)
> Relates to: platform redesign (complete), tiered detection architecture (agreed 2026-03-29)

---

## Problem

`PM_BUZZWORDS` (50 exact `\b...\b` words) is broken for `<all_urls>`:
- "strategy" fires on chess forums, wedding planning, military writing
- "launch" fires on rocket news, restaurant openings
- "retention" fires on legal document retention policies
- "retaining", "strategizing", "monetized" — morphological variants missed entirely

The list was acceptable when locked to 4 PM platforms. Universal injection makes false positives constant and misses real PM writing that uses variant forms.

---

## Solution: Hybrid Detection Architecture

Different triggers have different latency budgets. Detection method follows the budget.

| Trigger | Latency budget | Detection method |
|---|---|---|
| Write+pause badge | 1.5s before Groq fires anyway | **Groq only** — no local filter |
| Selection dot | Must appear <100ms | **PM_ROOTS regex** (local, instant) |
| Reading sensor (MutationObserver) | No hard budget, ambient | **PM_ROOTS regex** (local, instant) |
| Google Docs clipboard | On copy event | **PM_ROOTS regex** (local, instant) |

---

## Rule 1: Write+pause — no local keyword filter, Groq is the detector

**Remove Gate 2 from `triggerEagerFetch`** (the `detectPMKeywordInText` call). After the 40-word threshold passes, send the paragraph straight to Groq. Groq does NOT_PM detection + concept identification + chip generation in one call.

**Why this works:** The eager fetch fires at 1.5s. The badge appears at 3.5s. The 300-400ms Groq call has 2 full seconds to complete before anything shows. Zero perceptible latency difference. Groq understands "retaining users over the first 30 days" perfectly — no keyword needed.

**Cost:** Every 40+ word pause on any site fires Groq. At llama-3.1-8b-instant rates (~$0.0001/call), 50 pauses/day = ~$0.005/day. Acceptable. NOT_PM responses are cheap.

### Updated Groq response format (IMPORTANT — new requirement)

Without a local keyword, the badge label and sessionChipsCache key need the concept name from Groq. `generateQuestions` must return the concept alongside chips.

**New system prompt addition:** After the NOT_PM / chips instruction, add:
```
If generating chips: first output "CONCEPT: [2-4 word topic name]" on its own line,
then the 3 questions, one per line.
```

**New response parsing:**
```
CONCEPT: Retention Strategy
What's the most common mistake PMs make around early retention?
How do the best teams think about activation vs retention?
What metrics actually predict 90-day retention?
```

Parse: first line starting with `CONCEPT:` → `concept`. Remaining non-empty lines → `questions`.

**Return shape changes** from `string[]` to `{ concept: string, questions: string[] }`.

**Service worker** passes `concept` back in QUESTIONS_READY:
```js
{ type: 'QUESTIONS_READY', keyword: questions.concept, questions: questions.questions, ... }
```

The `keyword` field in all downstream code is renamed to `concept` conceptually but the field name `keyword` is kept for backward compatibility with QUESTIONS_READY handlers.

### Paragraph hash cache: keyed by hash, not concept

Gates 3 and 4 in `triggerEagerFetch` currently use `conceptKey` derived from `keyword`. With no local keyword, Gate 3 (same paragraph hash) works unchanged — it keys by `paragraphHash`. Gate 4 (session dedup) keys by `sessionChipsCache` using the concept returned by Groq (set in QUESTIONS_READY happy path). No change to cache logic needed.

---

## Rule 2: Selection highlight — PM_ROOTS regex replaces PM_BUZZWORDS

Selection dot must appear instantly on mouseup. Can't wait for Groq.

Replace `PM_BUZZWORDS.some(word => new RegExp(...).test(text))` with `PM_ROOTS.test(text)`.

### PM_ROOTS regex definition

```js
const PM_ROOTS = /retent|retain|churn|activat|growth\s+loop|viral\s+growth|acquisi|referral|network\s+effect|funnel|cohort|metric|north\s+star|KPI|OKR|NPS|CSAT|DAU|MAU|WAU|LTV|CAC|ARR|MRR|product[\s-]market|PMF|strateg|position|competit|differenti|moat|roadmap|prioriti|discovery|pricing|monetiz|freemium|paywall|upsell|subscript|free\s+trial|revenue\s+model|onboard|aha\s+moment|time\s+to\s+value|user\s+journey|drop[\s-]off|go[\s-]to[\s-]market|GTM|product[\s-]led|PLG|launch|sprint|backlog|epic|user\s+stor|feature\s+flag|dogfood|rollout|post[\s-]mortem|user\s+research|jobs\s+to\s+be|JTBD|A[\s\/]B\s+test|experiment|persona|stakehold|cross[\s-]func|alignment|buy[\s-]in|one[\s-]pager|customer\s+develop|feedback\s+loop|feature\s+request|power\s+user|win[\s-]loss|marketplac|cold\s+start|MVP|zero\s+to\s+one|0\s+to\s+1|early\s+stage|pre[\s-]PMF|founding/i;
```

**Notes on construction:**
- `.` is NOT used as a phrase separator (`.` matches any char). Use `\s+`, `[\s-]`, `[\s\/]` for phrase gaps.
- Stems match morphological variants: `retent` matches retention/retentive, `activat` matches activation/activated/activating
- High-false-positive roots (`strateg`, `growth`, `viral`, `launch`) are kept because selection mode is local-only — a dot appearing unnecessarily costs zero API calls. User ignores it. No harm done.
- `experiment` and `persona` kept intentionally — selection in PM context = PM work. Reading mode has a 20s cooldown and general 3-min cooldown that limits noise.

### Selection trigger: no concept label needed

The selection dot fires QUERY with the full selection as `selection` field. No concept label needed for selection — the RAG pipeline handles concept identification from the text itself.

---

## Rule 3: Reading sensor (scanForBuzzwords / MutationObserver) — PM_ROOTS + simplified

Replace `for (const buzzword of PM_BUZZWORDS)` with `PM_ROOTS.test(text)`.

### Display topic in reading mode

**Decision (locked 2026-03-30):** Option B — drop topic label from glow dot.

Glow dot shows "Lenny has thoughts →" without topic. User learns the topic when they click. This means `PM_BUZZWORDS` and `TOPIC_MAP` are fully deleted — no residual use.

---

## Rule 4: TOPIC_MAP — demoted from detection to display only

`TOPIC_MAP` currently serves two purposes:
1. Detection: used as cache key in `sessionChipsCache` (`TOPIC_MAP[keyword] ?? keyword`)
2. Display: used in `getDisplayTopic()` for reading mode labels

After this change:
- **Write+pause:** concept comes from Groq, not TOPIC_MAP. Cache key = Groq's concept string.
- **Reading mode:** TOPIC_MAP optionally used for display (see Option A above) or dropped (Option B).
- **Selection:** no concept label needed.

TOPIC_MAP is kept but no longer drives detection logic. `getDisplayTopic()` kept for reading mode if Option A chosen.

---

## What gets deleted

| Current | Replaced with |
|---|---|
| `PM_BUZZWORDS` array | `PM_ROOTS` regex |
| `detectPMKeywordInText()` | `textMatchesPMRoot(text)` — one-liner: `return PM_ROOTS.test(text)` |
| Gate 2 in `triggerEagerFetch` (keyword check) | Removed — 40-word threshold is the only local gate |
| `generateQuestions` returns `string[]` | Returns `{ concept: string, questions: string[] }` |

---

## What stays unchanged

- 40-word threshold in write+pause ✅
- Paragraph hash cache (Gate 3) ✅
- sessionChipsCache Map (Gate 4) — cache key becomes Groq's concept string ✅
- Combined NOT_PM + chip generation Groq call ✅
- Fail-open behavior on Groq errors ✅
- focusin/focusout element-first detection ✅
- Selection trigger fires QUERY with full selection text ✅
- Badge pill UI, chips panel, postcard ✅
- Google Docs clipboard intercept — replace `detectPMKeywordInText(clipText)` with `textMatchesPMRoot(clipText)` ✅

---

## Design decisions (locked 2026-03-30)

**Q1: Reading mode glow dot label** → **Option B** — "Lenny has thoughts →" (no topic label). `PM_BUZZWORDS` and `TOPIC_MAP` fully deleted.

**Q2: "Retaining a lawyer" selection false positive** → Acceptable for now. Selection dot appearing on legal/personal "retain" costs zero API calls. Revisit with smarter negative lookaheads in a future iteration.

---

## Files touched

| File | Change |
|---|---|
| `content/content-script.js` | Replace PM_BUZZWORDS + detectPMKeywordInText with PM_ROOTS + textMatchesPMRoot; remove Gate 2 from triggerEagerFetch; update selectionchange handler; update scanForBuzzwords; update badge-click re-fetch path; update Google Docs clipboard intercept |
| `background/abstraction.js` | Update generateQuestions: new system prompt (CONCEPT: line), new return shape `{concept, questions}` |
| `background/service-worker.js` | Update GENERATE_QUESTIONS handler: pass `keyword: questions.concept`; update QUESTIONS_READY shape |
