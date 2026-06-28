# CLAUDE.md — Lenny Live

> Read this fully at the start of every session. When you discover a learning, bug fix, or architectural decision, update this file immediately under the relevant section.

---

## What Is This Project

**Lenny Live** is an ambient Chrome extension that brings Lenny Rachitsky's voice and wisdom into a PM's workflow — contextually, non-intrusively. **Not a chatbot. A mentor.**

- **Launch:** April 15, 2026 (competition deadline)
- **Full PRD:** `LENNY_LIVE_PRD.md`
- **Built with Lenny's explicit permission** to use his voice and likeness
- **Primary user:** Early-stage PM / APM (0–3 yrs)

> **CRITICAL:** Real users ship on April 15. There is NO phase 2. Every feature needed for a good UX must ship in V1. Never defer essential features.

---

## Workflow

Superpowers is the primary orchestrator: `/superpowers:brainstorm` → `/superpowers:write-plan` → `/superpowers:executing-plans`. If something goes sideways mid-execution, STOP and re-plan.

- Always check `LENNY_LIVE_PRD.md` before implementing a feature
- One task per subagent — keep context windows clean
- After any user correction: update `tasks/lessons.md` AND the Lessons section below
- Never mark complete without proving it works (test in actual Chrome)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- Bug reports: just fix it, check browser console first, no hand-holding

Task management: write plan to `tasks/todo.md` with checkable items, verify before implementing, document results, capture lessons.

---

## Core Principles

- **Vanilla JS only** — no TypeScript, no React, no Tailwind
- **Plain CSS** with CSS variables for theming
- **Simplicity first** — minimal code impact, root-cause fixes, no temporary patches
- **Senior-engineer standards** — would a staff engineer approve this?

---

## Project Structure

```
LennyLive/
├── CLAUDE.md, LENNY_LIVE_PRD.md
├── .env                               # scripts/ toolchain only — gitignored
├── manifest.json                      # MV3
├── background/
│   ├── service-worker.js              # RAG pipeline orchestrator (push model)
│   ├── config.js                      # Hardcoded API keys for extension — gitignored
│   ├── rag.js                         # embedQuery, searchChunks, searchChunksAt
│   ├── abstraction.js                 # Groq llama-3.1-8b-instant — abstraction + page classification
│   └── tts.js                         # ElevenLabs REST TTS → base64 audio blob
├── content/content-script.js          # Detection, sensors, shadow DOM postcard, onboarding
├── popup/                             # popup.html, popup.js, popup.css
├── data/
│   ├── curated_moments.json           # Canonical corpus (312 moments)
│   └── pm_buzzwords.js                # PM keyword stems (PM_ROOTS regex)
├── scripts/
│   ├── embed.js, curate.js, finalize-corpus.js, watch-and-finalize.js
│   ├── seed-audio.js                  # Pre-generate ElevenLabs MP3s → Supabase Storage
│   └── create-icons.js
├── supabase/migrations/001_initial_schema.sql  # source of truth
├── landing/                           # Next.js 16 + Tailwind v4 — waitlist page
├── docs/                              # query-pipeline-explained.md, gamification-post-save-prd-v2.md, superpowers/
├── package.json                       # ESM; for scripts/ only — Chrome doesn't load this
└── tasks/                             # todo.md, lessons.md
```

**Two credential stores:** `.env` for `scripts/` toolchain (dotenv); `background/config.js` for the extension (Chrome can't read .env). Both gitignored.

**Manifest:** `<all_urls>` injection (element-first detection — see Architecture).

---

## Credentials & IDs

```bash
SUPABASE_URL=https://kjbeubcbhbjrnbnztwap.supabase.co
ELEVENLABS_AGENT_ID=agent_7901km588s7mekpthtfw3y9zcykw
ELEVENLABS_VOICE_ID=8tZdziIM3Y7ERvK9TUjy   # Lenny clone, stability 0.45, similarity_boost 0.85
GOOGLE_AI_API_KEY=                          # gemini-embedding-001 (768 dims)
GROQ_API_KEY=                               # llama-3.1-8b-instant
```

---

## Architecture (V2 — Element-First + Contextual Fallback)

**Page classification (Groq, 2s after load):** `pageIsPMContext` boolean cached. PM page → highlights show selection dot. Non-PM page → no dot. Null (first 2s) → PM_ROOTS regex fallback. SPA navigation re-classifies via pushState/popstate.

**Detection paths:**
1. **Selection dot** — `selectionchange` + PM_ROOTS regex (or `pageIsPMContext=true`). Dot anchored bottom-right of selection rect, viewport-clamped.
2. **Write+pause badge pill** — `focusin` on contenteditable/textarea attaches sensor; on keystroke/paste pause (1.5s) sends paragraph to Groq for concept extraction; badge pill appears.
3. **Onboarding nudge** — first-run pulsing dot + popup teaching state.

**Activation:** click dot/pill OR double-tap Ctrl (300ms window) → captures `transcript` (Web Speech API) + `selection` + `pageContext` → service-worker.

**RAG pipeline:**
```
cleanQuery + selection + pageContext → gemini-embedding-001 (768d)
  → Supabase pgvector (threshold 0.45)
       similarity > 0.55  → ship directly
       similarity 0.45–0.55 OR no match → Groq abstraction → re-embed → re-search (threshold 0.35)
                                          → push with abstracted: true
  → Push 1: RESPONSE → postcard
  → Push 2: AUDIO → buildSpokenText (Lenny Formula: Hook + Source → Insight → Push) → ElevenLabs TTS
```

**Conversational guard:** regex + Groq `NOT_PM` classifier reject small talk before any API call. Both are required (regex catches obvious patterns; Groq catches the long tail). Non-PM with business noun (e.g. "insurance claim") → abstract, never reject.

**Audio:** `URL.createObjectURL(blob)` only — `data:` URIs blocked by site CSP. `audio_url` cache currently bypassed (stale format); real-time TTS only until reseeded.

**Errors:** every catch maps to `network_error` push (toast), not silent. `AUDIO_ERROR` is separate from `RESPONSE` to avoid double-toast.

---

## Database Schema

Source of truth: `supabase/migrations/001_initial_schema.sql`. Summary:

- **transcript_chunks** — id, topic, guest_name, insight, pull_quote, episode_title, youtube_url, timestamp_secs, embedding vector(768), audio_url
- **user_data** — anonymous_id (unique), knowledge_score, current_streak, longest_streak, last_active_date, total_insights_engaged
- **saved_insights** — anonymous_id, chunk_id, topic, saved_at; unique(anonymous_id, chunk_id)
- **waitlist** — landing-page email capture (RLS enabled)

**RAG function:** `match_transcript_chunks(query_embedding vector(768), match_threshold float, match_count int)` — returns chunks + similarity. Always `DROP FUNCTION IF EXISTS` before recreating with new return columns.

---

## ElevenLabs Agent

**Agent ID:** `agent_7901km588s7mekpthtfw3y9zcykw`. Spoken text built in `service-worker.js::buildSpokenText()` (Lenny Formula), not in agent prompt. Agent rules: ONE insight, references real guest+episode, 3–5 sentences, ends with a pushy question, document review = 1 strength + 1 improvement + 1 question, never mentions `[DOCUMENT CONTEXT:]` injection.

---

## Gamification (v2 — see `docs/gamification-post-save-prd-v2.md`)

- **XP:** +5 deliver, +15 save, +2×streak_day daily bonus
- **PM Levels:** Intern (0) → APM (50) → PM (150) → Senior PM (350) → Staff PM (700) → Group PM (1200+)
- **Storage:** `chrome.storage.local` — `voiceMuted`, `topicCounts`, `hasOnboarded`, savedInsights, score, streak fields
- **Streak Saver:** `chrome.alarms` daily at 8pm local → `chrome.notifications` if streak ≥2 and no activation today
- **Dedup saves** by pull_quote + guest_name; "Already saved" toast, no XP
- **Popup:** PM Knowledge Map (5-bar progress per topic), topic-grouped library, search (150ms debounce), level + XP-to-next

---

## Commands

```bash
npm install                        # scripts/ toolchain only
node scripts/embed.js --dry-run    # validate without API calls
node scripts/embed.js              # embed (idempotent)
node scripts/seed-audio.js         # pre-generate TTS MP3s
```

---

## Coding Conventions

- ES6+ modules, async/await — no callbacks
- Always wrap Supabase / ElevenLabs / Chrome API calls in try/catch
- Logging prefix: `console.log('[LennyLive]', ...)`
- Comments: WHY not WHAT
- Commits: short, imperative ("Add double-tap Ctrl detection")
- Env vars from `.env` (scripts) or `background/config.js` (extension) — never hardcode

---

## Positioning (Locked 2026-03-29)

**Tagline:** "Compounded experience. Borrowed intuition."

Senior PMs have gut instinct because they've lived this before. You haven't yet. Lenny Live = compounded experience of 300 product leaders, borrowed as your intuition, arriving when your brain is in the problem. **NOT** a generated-advice chatbot — 100% real stories, real people, real episodes.

---

## What's Done & What's Next

**Done:** corpus (312 moments embedded), full UI redesign (Newsreader/Inter, cream/orange), gamification v2, onboarding (nudge + popup teaching + 2-slide widget), Groq page classification, smart PM detection (PM_ROOTS hybrid), Lenny voice clone, landing page + waitlist on Vercel, popup editorial redesign, Chrome notifications, YouTube clickthrough on saved insights, all platform/element-first detection work.

**Remaining for April 15 ship:**
- [ ] Analytics (PostHog) — `background/analytics.js` + wire events. Needs Rajat's PostHog API key. See Notion: 📊 Analytics
- [ ] Re-seed `audio_url` cache with Lenny Formula text (real-time TTS only until then)
- [ ] Dynamic push question — inject page context into Sentence 3 of Lenny Formula
- [ ] E2E testing + final bug fixes + submit

> Detailed history of completed work lives in git log. Don't re-add it here.

---

## Known Issues & Gotchas

- Supabase MCP needs Claude Code restart after first config
- Web Speech API requires https:// or localhost
- MV3 service workers are ephemeral — use `chrome.storage`, never in-memory state
- Double-tap Ctrl may conflict on some Mac keyboard layouts — test on Rajat's MacBook Air
- Groq `NOT_PM` gate must be paired with regex guard — neither alone is sufficient

---

## Lessons Learned

> Grouped by theme. Add new lessons under the matching group; don't append a flat date list.

**Process & scope**
- "Good enough for demo" / "phase 2" is the wrong frame — real product, real users, April 15. No phase 2
- Pasted file paths into Supabase SQL Editor don't execute → cat the file, copy content, paste into SQL Editor
- Supabase MCP needs Claude Code restart after first config AND requires a Personal Access Token, not the project anon key

**Embeddings & RAG**
- Use `gemini-embedding-001` with `outputDimensionality: 768` (text-embedding-004 was removed)
- Cosine peaks ~0.62 for related content → `match_threshold: 0.45`; never set fast-path threshold above 0.50
- Strip conversational filler in `cleanQuery()` before embedding — it dilutes similarity
- `pull_quote` fields are 300+ word essays → use `insight` for TTS; `pull_quote` for postcard reading
- `CREATE OR REPLACE FUNCTION` fails when changing return type → `DROP FUNCTION IF EXISTS fn(arg_types)` first
- Pre-seeded `audio_url` cache becomes stale when spoken text format changes → bypass cache until reseeded; never mix formats

**Audio / TTS**
- `data:` URI audio blocked by strict CSP (Notion/Linear) → always `URL.createObjectURL(blob)` in content scripts
- `ctx.resume()` returns a Promise → always `.catch(() => {})` to suppress AudioContext autoplay warning
- `Promise.race([fetch, timeout])` leaks a dangling rejection → extract setTimeout to a var, `clearTimeout` in `.finally()`
- ElevenLabs REST TTS reads text verbatim — Lenny Formula must be built in `buildSpokenText()`, not the agent dashboard

**Groq inference**
- Use `llama-3.1-8b-instant` (`llama3-8b-8192` decommissioned). Claude API adds 500–1500ms — too slow for ambient inference
- `NOT_PM` gate scope: ONLY pure social/emotional/entertainment phrases with no business noun. Anything with a business noun → abstract, never reject. Removing `NOT_PM` entirely is wrong — entertainment phrases get mapped to PM topics. Both regex + Groq gates required
- Groq echoes input when system-prompt examples use arrow notation → add "Do NOT repeat the input. Do NOT use arrow notation."
- Silent API failures look broken → every catch must push `network_error` status (incl. Push 2 / audio failures, separated as `AUDIO_ERROR` to avoid double-toast)

**Detection architecture**
- URL-gating in manifest kills demos on unlisted platforms → element-first detection on `<all_urls>`
- Static buzzword lists are wrong semantics on `<all_urls>` ("strategy", "launch" fire on chess/wedding/legal pages) → tiered detection (PM_ROOTS regex + Groq concept extraction). Never expand the static list
- Groq `pageIsPMContext` is the authority; regex is only fallback for the ~2s before Groq responds. On non-PM pages the regex must be off
- Short PM acronyms (≤4 chars: ARR, MRR, CAC, DAU…) match inside common words ("starred"→ARR) → all ≤4-char stems need `\b` boundaries
- URL/page title are useless context in SPAs (Notion/Linear/Docs) → `pageContext` from DOM: `document.activeElement` first, then semantic containers (`article`/`main`/`[role="main"]`). `document.body.innerText` is polluted with nav/sidebar — never use it
- Eager-fetch keyword check on `extractPageContext` (often one short block) is too restrictive → two-level: cursor block first, fall back to semantic container

**Sensor & UI lifecycle**
- `focusout` hiding the badge pill makes it disappear before user can click → never hide on focusout; only on explicit dismiss / new typing / `hideAllAmbientUI`
- `metaKey` guard in keydown blocks Cmd+V → dedicated `paste` listener on sensor
- Selection cap of 200 chars drops paragraph highlights → raise to 2000 chars (RAG-side `slice(0, 500)` handles downstream)
- Cache keys must persist across keystroke resets: use module-level `lastKnownConcept` set to normalized key (`TOPIC_MAP[keyword] ?? keyword`) in `QUESTIONS_READY` happy path. Don't read `pendingQuestions?.keyword` — it's null on every keystroke. Use `sessionChipsCache` Map (not Set) so chips survive resets
- Ambient "Lenny has thoughts" glow dot was bait-and-switch + Clippy-like → killed entirely; write+pause + selection dot + onboarding nudge cover the journey

**Onboarding**
- Popup carousel is fundamentally broken (popup tears down on focus loss, can't inspect with DevTools) → onboarding lives in content-script shadow DOM
- AUDIO arrives separately from RESPONSE — buffering only RESPONSE during onboarding lets TTS play over slides → buffer both, play on dismiss
- Content scripts only update on page reload, not extension reload → always refresh the page after extension reload

**Chrome storage**
- Different keys for the same setting in popup vs content-script breaks sync silently → cross-check key names. Both use `voiceMuted`

---

## References

- `LENNY_LIVE_PRD.md`, `tasks/todo.md`, `tasks/lessons.md`
- ChatPRD Transcripts: `github.com/ChatPRD/lennys-podcast-transcripts`
- Supabase pgvector: `https://supabase.com/docs/guides/ai/vector-columns`
- Chrome MV3: `https://developer.chrome.com/docs/extensions/mv3`
- ElevenLabs: `https://elevenlabs.io/docs`
- Superpowers: `github.com/obra/superpowers`

---

*Lenny Live — Built by Rajat Sharma, Mumbai — Lenny Rachitsky Data Challenge — April 2026*
