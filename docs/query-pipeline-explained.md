# How Lenny Live Processes a Query
## From Ctrl double-tap to Lenny's voice

---

## The Pipeline at a Glance

```
User speaks a query
        ↓
[Gate 1] Regex guard — is this obvious small talk?
        ↓ no
Clean filler from query ("tell me about X" → "X")
        ↓
Embed query → search Supabase pgvector (threshold: 0.45)
        ↓
┌─────────────────────────────────────────────────┐
│  similarity > 0.55   → Fast path. Ship it.      │
│  0.45–0.55           → Low confidence.          │
│                         Fall through to Groq.   │
│  < 0.45 (no results) → No match.                │
│                         Fall through to Groq.   │
└─────────────────────────────────────────────────┘
        ↓ (low confidence or no match)
[Gate 2] Groq llama-3.1-8b-instant (<200ms)
         Maps query to 2-3 PM fundamentals
         OR returns NOT_PM for pure social phrases
        ↓
Re-embed abstracted terms → re-search (threshold: 0.35)
        ↓
Result OR no_results toast
```

---

## Understanding the Similarity Numbers

`gemini-embedding-001` produces 768-dimensional vectors. Unlike OpenAI embeddings
(which peak at ~0.90 for near-identical text), Gemini's cosine similarity peaks
at **~0.62 for strongly related content**. This changes what the thresholds mean:

| Score range | What it means in practice |
|---|---|
| 0.60–0.62 | Extremely strong match. Near-perfect semantic alignment. |
| 0.55–0.59 | High confidence. The corpus has a clear answer to this query. |
| 0.45–0.54 | Low confidence. A match exists but the query may be ambiguous or niche. |
| 0.35–0.44 | Abstraction path only. Query is domain-specific; PM fundamentals found. |
| < 0.35 | Nothing. No relevant content even after abstraction. |

A score of 0.62 from Gemini is equivalent to what 0.90 would mean in OpenAI's space.
**Never raise the fast-path threshold above 0.55** — that would drop 80% of valid queries.

---

## 15 Worked Examples

---

### 1. "I'm running"
**Path:** Regex guard → immediate rejection
**Why:** Matches no business noun. Pure physical activity statement.
**Output:** Bloop tone + warm toast ("That's outside my PM brain...")
**Similarity computed:** No — rejected before any API call.

---

### 2. "how are you"
**Path:** Regex guard → immediate rejection
**Why:** Greeting pattern. No PM intent.
**Output:** Bloop tone + toast
**Similarity computed:** No

---

### 3. "let's go"
**Path:** Regex guard → immediate rejection
**Why:** Action/hype phrase. No business subject.
**Output:** Bloop tone + toast
**Similarity computed:** No

---

### 4. "retention"
**Path:** Fast path
**Similarity:** ~0.62 (Gemini's ceiling — corpus is rich with retention content)
**Output:** Uri Levine 2.0 — "Retention is the single metric for product-market fit"
**Why it works:** Direct PM term with dense corpus coverage. No abstraction needed.

---

### 5. "reten" (partial word, speech recognition cut off)
**Path:** Fast path
**Similarity:** ~0.62
**Output:** Same Uri Levine retention result
**Why it works:** Gemini's embedding still maps partial words to the right semantic space.
The vector for "reten" sits close enough to "retention" in 768 dimensions.

---

### 6. "Re" (too short, speech cut off very early)
**Path:** Fast path — but wrong
**Similarity:** ~0.55 (squeezes past the threshold)
**Output:** Phyl Terry — Roadmap Prioritisation
**Why it's unreliable:** "Re" is noise. Gemini finds the closest thing it can, but
there's no real signal. A minimum query length guard would filter this out.
Current state: the system serves a result even when the query is meaningless.

---

### 7. "insurance"
**Path:** Low confidence match (0.531) → Groq abstraction fallback
**Groq output:** `pricing strategy, customer experience, user adoption`
**Re-search similarity:** 0.695 — Naomi Ionita, GTM Strategy
**Why:** "Insurance" has faint semantic overlap with pricing content in the corpus
(score: 0.531 — above 0.45 but below 0.55). Groq correctly identifies pricing as
the dominant PM angle for insurance products. The re-search on "pricing strategy"
hits Naomi's insight about treating pricing like a roadmap with high confidence.
**Is this the right answer?** Reasonable but generic. "Insurance" alone has no PM
specificity — any query about insurance could be about pricing, retention, GTM,
or claims ops. The system picked pricing because that's what Groq inferred.

---

### 8. "claim settlement"
**Path:** Low confidence match (0.536) → Groq abstraction fallback
**Groq output:** `dispute resolution, claims processing, customer satisfaction`
**Re-search similarity:** 0.610 — Jason Shah, Stakeholder Management
**Why:** Claims processing maps to dispute resolution → stakeholder alignment.
Jason Shah's insight ("reframe pushback as aligning on shared goals") applies
to insurance adjusters managing claimant expectations.
**Note:** Before the prompt fix, Groq was echoing back `claim settlement → "..."`,
which polluted the re-embedding vector. Now it returns clean terms only.

---

### 9. "I'm writing a PRD on retention"
**Path:** Filler stripped → fast path
**Cleaned query:** `retention` (prefix stripped by cleanQuery())
**Similarity:** ~0.62
**Output:** Same Uri Levine retention result as example 4
**Why it works:** cleanQuery() strips "I'm writing a PRD on" before embedding.
The pageContext (what's actually in the document) is reserved for Groq only.

---

### 10. "I'm writing a PRD on insurance"
**Path:** Filler stripped → low confidence → Groq with pageContext
**Cleaned query:** `insurance`
**Fast-path similarity:** ~0.531
**Groq receives:** transcript=`insurance` + pageContext=`<whatever is in the PRD>`
**Why pageContext matters here:** If the PRD mentions "claim settlement" and
"policyholders," Groq can infer this is about insurance ops, not InsurTech pricing,
and abstract to `friction reduction, activation, onboarding` instead.
Without pageContext, Groq only has "insurance" — a much weaker signal.

---

### 11. "privacy and GDPR"
**Path:** No direct match (< 0.45) → Groq abstraction
**Groq output:** `user trust, data transparency, compliance`
**Output:** Josh Miller — user trust and privacy insight
**Why it works:** The corpus has no GDPR-specific content. Groq maps the
regulatory framing to the underlying PM concern (user trust). High-quality
abstraction because the PM fundamental is clear even when the domain is niche.

---

### 12. "hospital EHR adoption by nurses"
**Path:** No direct match → Groq abstraction
**Groq output:** `enterprise onboarding, change management, user adoption`
**Output:** Enterprise onboarding insight (most relevant in corpus)
**Why it works:** Healthcare IT has no corpus coverage, but the PM problem
(getting reluctant users to adopt a new tool) is universal. Groq nails it.

---

### 13. "it's time to disco"
**Path:** Regex misses → Groq → NOT_PM
**Why regex misses it:** No pattern matches "it's time to disco."
It doesn't look like a greeting, affirmation, or meta question.
**Why Groq catches it:** No business noun. Pure cultural reference.
**Output:** Bloop tone + toast
**This is why both gates are needed:** Regex handles obvious social patterns
(greetings, thanks, "let's go"). Groq handles the long tail (travel, jokes,
pop culture, personal statements).

---

### 14. "B2B SaaS pricing vs D2C"
**Path:** Likely fast path or low confidence → direct hit
**Why:** "pricing" is a dense corpus topic. Gemini maps SaaS pricing language
directly to pricing content without needing abstraction.
**Expected output:** Pricing strategy insight (high similarity)

---

### 15. "xkcd meme about agile"
**Path:** Regex misses → Groq → NOT_PM
**Why:** No business subject — pure entertainment reference.
"Agile" appears but the intent is a meme request, not a PM question.
**Output:** Bloop tone + toast
**Edge case:** If someone asks "agile vs waterfall" (genuine PM question),
Groq MUST abstract (business subject present) — NOT_PM would be wrong there.

---

## The NOT_PM Boundary (Critical)

The single most important tuning decision in the whole pipeline:

| Query | Has business noun? | Correct output |
|---|---|---|
| "how are you" | No | NOT_PM |
| "I'm hungry" | No | NOT_PM |
| "it's time to disco" | No | NOT_PM |
| "how do I get to England" | No (travel, not business) | NOT_PM |
| "insurance" | Yes (business domain) | Abstract → PM terms |
| "claim settlement" | Yes (business process) | Abstract → PM terms |
| "agile vs waterfall" | Yes (process methodology) | Abstract → PM terms |
| "xkcd meme about agile" | No (entertainment request) | NOT_PM |

**Rule:** When in doubt → abstract. NOT_PM is the rare exception.
Any noun that could describe a business domain, product, service, or process
must be abstracted — even if the query sounds informal or off-topic.

---

## What Can Go Wrong

| Failure mode | Example | Root cause |
|---|---|---|
| Too-short query | "Re" → wrong result | No minimum length guard |
| Ambiguous niche domain | "insurance" → pricing (not ops) | No pageContext on blank page |
| Groq echoes the input | "claim settlement → ..." | Prompt examples used arrow notation |
| Stale UI topic pill | Shows "0-to-1 Building" for GTM result | V1 bucket labels in DB — fixed by retag-topics.js |
| Audio fails silently | TTS timeout | Now surfaces network_error toast |
