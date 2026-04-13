# Task Backlog — Lenny Live

---

## ✅ DONE — Platform Redesign (Element-First Detection)

Completed 2026-03-30. Branch: `feature/platform-redesign`. 10 commits.

**What shipped:**
- `<all_urls>` manifest — extension works on any platform
- `focusin`/`focusout` element-first sensor gate
- 40-word threshold + `sessionChipsCache` Map dedup (Groq fires once per concept per session)
- Badge pill UI — fixed bottom-right, "3 patterns on retention →", chips panel on click
- Combined NOT_PM detection + chip generation in single Groq call
- Fail-open on Groq errors (template chips served, badge never goes dark)
- Google Docs clipboard intercept
- Google Fonts removed → system font stack (fixes 33 CSP violations per page load)
- Paste triggers write+pause sensor
- Selection cap raised 200 → 2000 chars
- focusout no longer hides badge pill

---

## ✅ DONE — Smart PM Detection (Hybrid Detection Architecture)

Completed 2026-03-30. Branch: `feature/platform-redesign` (merged to main). 9 commits.

**What shipped:**
- `PM_ROOTS` stem regex replaces `PM_BUZZWORDS` array — morphological variants match (`retent` → retention/retaining/retentive)
- `textMatchesPMRoot()` replaces `detectPMKeywordInText()` — one-liner boolean
- Write+pause path sends paragraph straight to Groq — no local keyword gate, zero false positives
- Selection dot + reading sensor + clipboard → `PM_ROOTS` instant regex (<100ms)
- `generateQuestions` returns `{concept, questions}` — Groq names the concept ("Retention Strategy")
- Badge label and cache key driven by Groq concept, not static TOPIC_MAP
- `lastKnownConcept` module-level variable — cache gates work even when `pendingQuestions` is null (cleared on keystrokes)
- `TOPIC_MAP` and `getDisplayTopic` deleted — fully removed
- Glow dot shows "Lenny has thoughts →" (generic label — Option B, locked 2026-03-30)

---

## 🔴 Next Up — Smart PM Detection (Tiered Buzzword Architecture)

**Why:** `PM_BUZZWORDS` static list is broken for `<all_urls>`. Words like "strategy", "launch", "retention", "roadmap" fire on chess forums, wedding docs, legal policies. With platform-wide injection, false positives will be constant.

**Decision (2026-03-30):** Tiered detection — do NOT expand static list, redesign the architecture.

**Architecture (planned, not yet specced):**

**Tier 1 — Unambiguous PM jargon (fire immediately, zero verification)**
High-confidence terms where false positives are near-zero:
`DAU`, `MAU`, `WAU`, `ARR`, `MRR`, `ARPU`, `LTV`, `CAC`, `NPS`, `CSAT`, `PMF`, `OKR`, `KPI`, `JTBD`, `PLG`, `GTM`, `A/B test`, `north star`, `product market fit`, `churn rate`, `retention rate`

**Tier 2 — Ambiguous words (require PM co-occurrence in 200-word window)**
`strategy`, `launch`, `retention`, `roadmap`, `prioritisation`, `discovery`, `viral`, `acquisition`, `competitive`, `positioning`, `stakeholder`, `funnel`, `conversion`
Co-occurrence signal: must appear with `product`, `user`, `feature`, `metric`, `sprint`, `backlog`, `customer`, or any Tier 1 term within 200 words.

**Tier 3 — Groq concept extraction (once per page session, cached by URL)**
Drop PM_BUZZWORDS entirely as primary trigger for new contexts. Groq identifies actual PM concepts present: "Retention · Roadmap · OKR". Returns NONE for non-PM pages.
Badge label changes: "3 patterns on retention" → "Lenny sees: Retention · Roadmap · OKR →"

**Local model note:** DeepSeek/Ollama via localhost works for developer use only — not viable for real users. Keep Groq as default; optionally add `LOCAL_OLLAMA_URL` config override in `background/config.js` for zero-cost development.

**Status:** ✅ COMPLETE — see Done section above.

---

## Planned — Ready to Execute

### Dynamic Topic Re-tag (Groq Ingestion Layer)

**Problem:** 280 existing rows in `transcript_chunks` have stale V1 topic labels forced into 10 rigid buckets.

**Tasks:**
- [ ] `scripts/retag-topics.js` — fetch all rows, Groq re-tag with 2-3 word PM topic label, UPDATE Supabase
- [ ] Update `scripts/curate.js` — replace hardcoded 10-bucket topic with Groq-generated free-form label

---

## Up Next (ordered)

- [ ] Voice clone — ElevenLabs Starter ($5), clone Lenny's real voice; update `ELEVENLABS_VOICE_ID`
- [ ] Gamification — PM Levels, full XP economy, topic badges, streak milestones (3/7/14/30d), streak shield
- [ ] Onboarding commitment screen — first-open popup, learning goal selection
- [ ] Chrome notifications — Streak Saver at 8pm
- [ ] Dynamic push question — inject pageContext into Sentence 3 of Lenny Formula
- [ ] Re-seed audio_url cache with Lenny Formula formatted text
- [ ] Analytics (PostHog) — needs Rajat to create account + share `phc_...` API key
