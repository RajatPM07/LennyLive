# Task Backlog — Lenny Live

---

## Planned — Ready to Execute

### Dynamic Topic Re-tag (Groq Ingestion Layer)

**Problem:** 280 existing rows in `transcript_chunks` have stale V1 topic labels forced into 10 rigid buckets. The RAG retrieval is correct but the UI pill reads "Roadmap Prioritisation" for an AI Strategy quote — breaking the illusion.

**Solution:** One-time Groq batch re-tag + forward pipe update.

**Tasks:**
- [ ] `scripts/retag-topics.js` — fetch all rows from Supabase, send `insight + pull_quote + guest_name + episode_title` to Groq `llama3-8b-8192`, get back a 2-3 word title-case PM topic label, UPDATE `topic` column in Supabase
  - Prompt constraints: 2-3 words max, title case, PM vocabulary (e.g. "AI Strategy", "Pricing Models", "Hiring Decisions")
  - Rate limit: 1.5s delay between calls (Groq free tier: 30 req/min)
  - Estimated runtime: ~7 minutes for 280 rows
  - Estimated cost: ~$0.08 one-time
- [ ] Update `scripts/curate.js` — replace hardcoded 10-bucket topic assignment with Groq-generated free-form label (same prompt), so all future episode curation is fully dynamic
- [ ] Verify postcard UI pill renders correctly with new free-form labels post-retag

**Files to touch:**
- `scripts/retag-topics.js` (new)
- `scripts/curate.js` (update topic generation)

**No extension code changes needed** — `topic` is already returned by `match_transcript_chunks` and rendered directly on the postcard pill.

---

## Up Next (ordered)

- [ ] Voice clone — ElevenLabs Starter ($5), clone Lenny's real voice; update `ELEVENLABS_VOICE_ID` in `background/config.js`
- [ ] Clippy UX fix — replace keyword chip notification with ambient glow dot
- [ ] Gamification — streaks, scores, saved library popup UI
- [ ] Postcard output redesign — teaser text + "Read more" CTA (~800 chars expanded)
- [ ] Honest mentor framing UI — `abstracted: true` → bridging copy on postcard
- [ ] Dynamic push question — inject pageContext into Sentence 3 of Lenny Formula
- [ ] Re-seed audio_url cache with Lenny Formula formatted text (currently bypassed)
- [ ] **Session memory + deduplication** — conversational context chaining across activations (e.g. "retention" → "B2B retention" → "B2C retention" should give progressively refined, non-repeating insights). Needs brainstorming session before implementation: scope of session reset (per tab / per browser session / time-bounded), dedup strategy (exclude seen chunk IDs from Supabase RPC), and query context injection.
