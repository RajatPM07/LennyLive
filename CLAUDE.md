# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# CLAUDE.md — Lenny Live

> This file is read automatically at the start of EVERY Claude Code session.
> Before writing a single line of code, read this file completely.
> When you discover a new learning, bug fix, architectural decision, or convention:
> UPDATE THIS FILE IMMEDIATELY under the relevant section before moving on.
> Never let a session end without capturing what was learned.

---

## What Is This Project

**Lenny Live** is an ambient Chrome extension that brings Lenny Rachitsky's voice and wisdom into a PM's workflow — contextually, non-intrusively, exactly when needed.

**Not a chatbot. A mentor.**

- **Launch date:** April 15, 2026 (also the competition deadline)
- **Full PRD:** See `LENNY_LIVE_PRD.md` in this folder — read it for full product context
- **Built with Lenny Rachitsky's explicit permission** to use his voice and likeness
- **Primary user:** Early-stage PM / APM (0–3 years experience)

> **CRITICAL:** This is a full product for real users — not a demo or prototype. Real users will use this after April 15th. There is NO phase 2. Every feature needed for a good user experience must ship in V1. Never defer essential features to "post-competition" or "phase 2". Build it right the first time.

---

## Workflow Orchestration

> Superpowers is the primary workflow orchestrator for all plan → build → review cycles.
> When Superpowers commands are invoked, follow that workflow.
> Everything else in this file (conventions, architecture, principles) applies during execution.

### 1. Plan Mode Default
- For ANY non-trivial task, use the Superpowers workflow:
  1. `/superpowers:brainstorm` — refine what you're building
  2. `/superpowers:write-plan` — break it into bite-sized tasks
  3. `/superpowers:executing-plans` — execute with subagents + review
- Always check `LENNY_LIVE_PRD.md` before implementing a feature
- If something goes sideways mid-execution, STOP and re-plan — don't keep pushing

### 2. Subagent Strategy
- Superpowers `/superpowers:executing-plans` manages subagent dispatch automatically
- Each subagent gets one task + a two-stage review (spec compliance, then code quality)
- For research or exploration outside the plan, still spin up manual subagents freely
- One task per subagent — keep context windows clean and focused

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review `tasks/lessons.md` at session start for relevant learnings
- **Also update the Lessons Learned section at the bottom of THIS file**

### 4. Verification Before Done
- Never mark a task complete without proving it works
- For Chrome extension: always test in actual Chrome with extension loaded
- For Supabase: verify queries return expected results before moving on
- For ElevenLabs: test voice response quality before marking complete
- Ask yourself: "Would a staff engineer approve this?"

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Check browser console for extension errors before asking Rajat anything

---

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` AND this file after corrections

---

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **No TypeScript**: Vanilla JavaScript only — keep the extension lightweight and fast
- **No Frameworks**: Plain CSS, no Tailwind, no React — Manifest V3 extensions stay lean

---

## Project Structure

```
LennyLive/
├── CLAUDE.md                          # This file — read FIRST every session
├── LENNY_LIVE_PRD.md                  # Full PRD — read for complete product context
├── .env                               # API keys for scripts/ toolchain — NEVER commit
├── .gitignore                         # Must include .env and background/config.js
├── manifest.json                      # Chrome Extension Manifest V3
├── background/
│   ├── service-worker.js              # Entry point — RAG pipeline orchestrator (push model)
│   ├── config.js                      # Hardcoded API keys for Chrome extension — gitignored, NEVER commit
│   ├── rag.js                         # embedQuery(), searchChunks(), searchChunksAt()
│   ├── abstraction.js                 # Groq llama-3.1-8b-instant — maps niche domains to PM concepts
│   └── tts.js                         # ElevenLabs REST TTS — returns base64 audio blob
├── content/
│   └── content-script.js             # Page reader, keyword detection, double-tap Ctrl, shadow DOM postcard
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── data/
│   ├── curated_moments.json           # Canonical corpus — source for embedding pipeline
│   └── pm_buzzwords.js               # PM keyword list for passive detection
├── scripts/
│   ├── embed.js                       # Embed curated_moments.json → Supabase pgvector (idempotent)
│   ├── curate.js                      # Gemini-2.5-flash: process transcripts → curated_moments
│   ├── finalize-corpus.js             # Validate → backup → swap JSON → wipe DB → re-embed
│   ├── watch-and-finalize.js          # Auto-trigger finalize when curate.js sets complete:true
│   ├── seed-audio.js                  # Pre-generate ElevenLabs MP3s → Supabase Storage (idempotent)
│   └── create-icons.js               # Generate extension icon PNGs
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql     # Source of truth for DB schema — always read this
├── docs/
│   ├── query-pipeline-explained.md   # 15 worked examples with similarity score reference
│   └── superpowers/                   # Plans and specs from Superpowers workflow
├── package.json                       # Node.js ESM config for scripts/ toolchain only (not loaded by Chrome)
└── tasks/
    ├── todo.md                        # Current sprint tasks
    └── lessons.md                     # Learnings from corrections
```

### Credentials: two stores, not one

- **`scripts/` toolchain** → reads from `.env` (dotenv) — for Node.js scripts only
- **Chrome extension** → reads from `background/config.js` (hardcoded, gitignored) — Chrome cannot access `.env`

`background/config.js` is the extension's credential file. It is gitignored and must never be committed. When adding a new API key to the extension, add it to `background/config.js` and export it; then import it in the module that needs it (e.g. `abstraction.js` imports `GROQ_API_KEY`).

### Supported domains (manifest.json host_permissions)

The extension activates on: **Notion**, **Linear**, **Atlassian/Jira** (`*.atlassian.net`), **Google Docs**. To add a new domain, update both `host_permissions` and `content_scripts.matches` in `manifest.json`.

---

## Key Credentials & IDs

```bash
# All in .env — NEVER hardcode, NEVER commit
SUPABASE_URL=https://kjbeubcbhbjrnbnztwap.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...        # Full key from Supabase dashboard
ELEVENLABS_AGENT_ID=agent_7901km588s7mekpthtfw3y9zcykw
ELEVENLABS_VOICE_ID=cjVigY5qzO86Huf0OWal   # Eric placeholder — swap when Lenny cloned
GOOGLE_AI_API_KEY=                           # For gemini-embedding-001 (768 dims) — free via aistudio.google.com
CLAUDE_API_KEY=                              # For query understanding
```

**Lenny Voice ID:** TBD — update this line when ElevenLabs voice clone is complete

---

## Architecture — How It All Connects (V2)

```
User double-taps Ctrl anywhere in Chrome
        ↓
content-script.js — detects double-tap (300ms window)
        ↓
3 signals captured:
  transcript  — Web Speech API (spoken query)
  selection   — window.getSelection() (highlighted text, ≤500 chars)
  pageContext — extractPageContext() cascade:
                  1. document.activeElement (contenteditable/textarea/input)
                  2. article / main / [role="main"] container
                  3. document.title fallback
        ↓
QUERY message → service-worker.js
        ↓
cleanQuery(transcript) + selection + pageContext → gemini-embedding-001 (768 dims)
        ↓
Supabase pgvector search (threshold: 0.45)
        ↓                                  ↓
similarity > 0.55 (high confidence)    similarity 0.45–0.55 (low confidence)
ship directly                          OR no match → Groq llama-3.1-8b-instant (<200ms)
        ↓                              maps niche domain → 2-3 PM concepts
Push 1: RESPONSE → Postcard                    ↓
Push 2: AUDIO → ElevenLabs TTS        Re-embed → re-search (threshold: 0.35)
        ↓                                          ↓ match found
Audio plays in browser                 Push 1: RESPONSE (abstracted: true)
                                       Push 2: AUDIO
        ↓
User saves insight → chrome.storage.local
Gamification: streak + score updated in chrome.storage.local
```

---

## Database Schema

### transcript_chunks
```sql
create extension if not exists vector;

create table if not exists transcript_chunks (
  id              uuid primary key default gen_random_uuid(),
  topic           text not null,
  guest_name      text not null,
  insight         text not null,
  pull_quote      text not null,
  episode_title   text not null,
  youtube_url     text not null,
  timestamp_secs  integer not null,
  embedding       vector(768),
  created_at      timestamptz not null default now()
);
```

### user_data
```sql
create table if not exists user_data (
  id                      uuid primary key default gen_random_uuid(),
  anonymous_id            text unique not null,   -- generated client-side UUID
  knowledge_score         integer not null default 0,
  current_streak          integer not null default 0,
  longest_streak          integer not null default 0,
  last_active_date        date,
  total_insights_engaged  integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
```

### saved_insights
```sql
create table if not exists saved_insights (
  id            uuid primary key default gen_random_uuid(),
  anonymous_id  text not null references user_data(anonymous_id) on delete cascade,
  chunk_id      uuid not null references transcript_chunks(id) on delete cascade,
  topic         text not null,           -- denormalised for fast topic filtering
  saved_at      timestamptz not null default now(),
  unique (anonymous_id, chunk_id)        -- no duplicates in library
);
```

> **Schema source of truth:** Always read `supabase/migrations/001_initial_schema.sql` — it is authoritative. The snippets above are summaries only.

### RAG search function
```sql
create or replace function match_transcript_chunks(
  query_embedding vector(768),
  match_threshold float default 0.5,
  match_count int default 3
)
returns table (
  id uuid,
  guest_name text,
  topic text,
  insight text,
  pull_quote text,
  episode_title text,
  youtube_url text,
  timestamp_secs integer,
  similarity float
)
language sql stable
as $$
  select
    id, guest_name, topic, insight,
    pull_quote, episode_title, youtube_url, timestamp_secs,
    1 - (embedding <=> query_embedding) as similarity
  from transcript_chunks
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

---

## Activation Logic

### Double tap Ctrl (primary activation)
```javascript
// In content-script.js
let lastCtrlPress = 0;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') {
    const now = Date.now();
    if (now - lastCtrlPress < 300) {
      activateLennyLive(); // Double tap within 300ms
    }
    lastCtrlPress = now;
  }
});
```

### Passive keyword detection
- Read active page text every 30 seconds
- Check against PM_BUZZWORDS list in `data/pm_buzzwords.js`
- Show floating notification if match found
- Fade after 10 seconds if ignored

### Selection review
- `window.getSelection().toString()` captures highlighted text
- Inject as `[DOCUMENT CONTEXT: ...]` into ElevenLabs agent
- Max 500 words for optimal response

---

## ElevenLabs Agent

**Agent ID:** `agent_7901km588s7mekpthtfw3y9zcykw`

**Context injection format:**
```
[DOCUMENT CONTEXT:
Episode: <episode_title>
Guest: <guest_name>
Excerpt: <content>

Episode: <episode_title>
Guest: <guest_name>
Excerpt: <content>
]

User: <what the PM asked or was writing about>
```

**Agent behaviour rules (never violate these):**
- ONE insight only — never a list
- Always references a real guest + episode from context
- 3–5 sentences max (unless document review mode)
- Ends with a question that pushes the PM to think harder
- Document review: 1 strength + 1 improvement + 1 question
- Reads `[DOCUMENT CONTEXT: ...]` naturally — never mentions the injection

---

## PM Buzzword List (Passive Detection)

```javascript
// data/pm_buzzwords.js
const PM_BUZZWORDS = [
  'retention', 'churn', 'DAU', 'MAU', 'WAU', 'activation',
  'conversion', 'funnel', 'cohort', 'ARR', 'MRR', 'ARPU',
  'LTV', 'CAC', 'NPS', 'CSAT', 'north star', 'KPI', 'OKR',
  'PMF', 'product market fit', 'GTM', 'go-to-market', 'roadmap',
  'prioritization', 'prioritisation', 'discovery', 'strategy',
  'positioning', 'competitive', 'moat', 'differentiation',
  'growth loop', 'viral', 'acquisition', 'referral', 'PLG',
  'product-led', 'paid acquisition', 'SEO', 'content marketing',
  'user research', 'user interview', 'jobs to be done', 'JTBD',
  'hypothesis', 'A/B test', 'experiment', 'sprint', 'backlog',
  'stakeholder', 'cross-functional',
  'MVP', 'launch', 'go live', 'zero to one', '0 to 1',
  'early stage', 'pre-PMF', 'founding'
];
```

---

## Commands

```bash
# Install Node.js dependencies (for scripts/ toolchain only — not Chrome extension)
npm install

# Validate curated_moments.json against Supabase schema without API calls
node scripts/embed.js --dry-run

# Embed curated moments into Supabase pgvector (idempotent — safe to re-run)
node scripts/embed.js
```

> `package.json` uses `"type": "module"` (ESM). The `node_modules/` directory is gitignored and only used by `scripts/` — Chrome loads extension files directly.

---

## Coding Conventions

- **Language:** Vanilla JavaScript — NO TypeScript
- **Style:** ES6+ modules, async/await throughout — no callbacks
- **No frameworks:** No React, no Vue — plain HTML/CSS/JS only
- **CSS:** Plain CSS variables for theming — no Tailwind, no Bootstrap
- **Error handling:** ALWAYS wrap Supabase + ElevenLabs + Chrome API calls in try/catch
- **Logging:** `console.log('[LennyLive]', ...)` prefix on all logs for easy filtering
- **Comments:** Explain WHY not WHAT
- **Commits:** Short, imperative — "Add double-tap Ctrl detection" not "Fixed stuff"
- **Environment vars:** ALWAYS loaded from `.env` — never hardcoded

---

## What's Done ✅

- [x] Product fully defined and scoped
- [x] Lenny's permission secured — voice + likeness
- [x] ElevenLabs agent created and tested — Agent ID: `agent_7901km588s7mekpthtfw3y9zcykw`
- [x] GitHub transcript repo forked — `ChatPRD/lennys-podcast-transcripts`
- [x] Supabase project set up — lenny-live, Singapore region
- [x] pgvector enabled
- [x] transcript_chunks + user_data tables created
- [x] Claude Code + Supabase MCP configured
- [x] LENNY_LIVE_PRD.md written
- [x] CLAUDE.md written
- [x] Superpowers plugin installed (v5.0.5)
- [x] 25 PM moments curated (Retention×10, GTM Strategy×8, PMF×7) — `data/curated_moments.json`
- [x] Embedding pipeline built — `scripts/embed.js` using `gemini-embedding-001` (768 dims)
- [x] 25 moments embedded into Supabase pgvector — RAG verified at threshold 0.5
- [x] Chrome extension shell — Manifest V3
- [x] content-script.js — double-tap Ctrl + passive buzzword detection + shadow DOM
- [x] service-worker.js — RAG pipeline (embed → pgvector search → push model)
- [x] Postcard UI — shadow DOM, CSS variables theme, enter/exit animations
- [x] ElevenLabs TTS integration — blob: URL audio (bypasses site CSP), 8s timeout
- [x] Save to chrome.storage.local — read-modify-write, ✓ Saved! feedback
- [x] Mute toggle — persisted via chrome.storage.local
- [x] Auto-dismiss (30s) + hover-to-pause
- [x] E2E verified on Notion — all 9 criteria pass
- [x] Corpus expanded to 40 moments — added Metrics & North Star×6, Roadmap Prioritisation×5, User Research×4
- [x] All 40 pull_quotes rewritten to 2-3 sentences (≤550 chars) — postcard-readable
- [x] `audio_url` column added to `transcript_chunks`; `match_transcript_chunks` updated to return it
- [x] 40 MP3s pre-generated via ElevenLabs, stored in Supabase Storage bucket `tts-audio` (public)
- [x] Service worker lazy cache — CDN audio (~1-2s) with real-time TTS fallback
- [x] `scripts/seed-audio.js` — idempotent TTS seeder with `--dry-run` flag
- [x] curate.js scaling — all 303 episodes processed, 280 moments curated and embedded
- [x] `scripts/curate.js` — gemini-2.5-flash, resume support, quota polling, 280 moments output
- [x] `scripts/finalize-corpus.js` — validate → backup → swap JSON → wipe DB → re-embed pipeline
- [x] `scripts/watch-and-finalize.js` — auto-triggers finalize when curate.js sets `complete: true`
- [x] V2 Contextual Fallback Architecture — 3-signal injection + Groq abstraction fallback
- [x] `extractPageContext()` — 3-priority cascade (active cursor / semantic container / title)
- [x] `background/abstraction.js` — Groq `llama3-8b-8192`, maps niche domains to PM fundamentals
- [x] `background/rag.js` — `searchChunksAt(embedding, threshold)` for variable-threshold re-search
- [x] DB topic CHECK constraint removed — topic is now free-form display label only
- [x] `abstracted: true` flag on insight object — ready for honest mentor UI framing
- [x] Conversational query guard — regex + Groq `NOT_PM` classifier rejects small talk before any API call
- [x] Lenny Formula spoken text — `buildSpokenText()` constructs Hook + Source → Core Insight → Push Question; real-time TTS only (audio_url cache bypassed until re-seeded with formula format)
- [x] Groq model updated to `llama-3.1-8b-instant` — `llama3-8b-8192` decommissioned
- [x] `network_error` status + toast — Groq/ElevenLabs/Supabase failures now surface "Network error. Lenny needs a second to reconnect." (previously silent)
- [x] Groq echo bug fixed — prompt now says "Do NOT repeat the input query. Do NOT use arrow notation." (was echoing `claim settlement → "..."`)
- [x] `docs/query-pipeline-explained.md` — 15 worked examples across all query states with similarity score reference
- [x] `scripts/curate-v2.js` — V2 curation script, corpus expanded to **312 moments** across 303 episodes
- [x] **Full UI redesign** — Newsreader/Inter editorial fonts, warm off-white (`#fdfcf6`), orange accent (`#ff6e40`), matches Lenny Newsletter aesthetic
- [x] **Ambient glow dot** — replaces buzzword chip; pulsing orange dot, hover-expand pill "Lenny has thoughts on [topic]"
- [x] **Postcard redesigned** — serif quote at 18px, Read more/collapse with gradient fade, honest mentor framing ("Connecting X to Y...") shown when `abstracted: true`
- [x] **Popup gamification dashboard** — streak, score, saved insights list, mute toggle (shell complete, full XP logic pending)
- [x] Mute toggle key fixed — popup and postcard now both use `voiceMuted` key (was `isMuted` vs `voiceMuted` mismatch)
- [x] Google Fonts (`Inter` + `Newsreader`) injected into `document.head` — available inside shadow DOM
- [x] `updateStreak()` — increments streak on each successful insight delivery; consecutive-day detection with yesterday comparison
- [x] Score increments on deliver (+5) and save (+15) — upgraded from flat +10 on save only
- [x] **Gamification PRD** written — full game-theory-grounded spec. Notion: 🎮 Gamification System — PRD
- [x] **Analytics design** written — PostHog via REST API, dropout funnel, all events defined. Notion: 📊 Analytics — Events, Metrics & Dropout Funnels

## Positioning (Locked 2026-03-29)

**Tagline:** "Compounded experience. Borrowed intuition."

**Core truth:** Senior PMs have gut instinct because they've lived this before. You haven't. Yet. Lenny Live gives you the compounded experience of 300 product leaders — borrowed as your intuition, arriving at the exact moment your brain is inside the problem.

NOT a mentor, NOT a chatbot, NOT generated advice — 100% real stories, real people, real episodes.

---

## What's Next 🔨

> All items below are V1 requirements — real users ship on April 15th. Nothing here is optional or "phase 2".

- [ ] **🔴 Platform Redesign (Element-First Detection)** — URL-gating kills the demo; write+pause unreliable on current arch. Spec: `docs/superpowers/specs/2026-03-29-platform-redesign.md`. Core: `focusin`/`focusout` gate, `<all_urls>` optional permissions, badge pill UX, hash cache + session dedup. Next: `superpowers:writing-plans` → `superpowers:subagent-driven-development`
- [ ] **Full gamification system** — PM Levels + XP economy (+5 deliver/+15 save/+25 rare) + topic badges + streak milestones (3/7/14/30d) + streak shield + rare drops. See Notion: 🎮 Gamification System — PRD
- [ ] **Onboarding commitment screen** — first-open popup moment, learning goal selection (behavioral commitment device — required for retention)
- [ ] **Chrome notifications** — Streak Saver at 8pm if no activation that day (highest retention lever per Duolingo research)
- [ ] **Saved insights YouTube clickthrough** — clicking saved insight opens YouTube at `youtube_url?t=timestamp_secs`; add link on postcard footer too
- [ ] **Analytics (PostHog)** — `background/analytics.js` + wire all events. Needs Rajat to create PostHog account (US region) and share `phc_...` API key. See Notion: 📊 Analytics — Events, Metrics & Dropout Funnels
- [ ] **ElevenLabs voice clone** — Starter plan ($5), clone Lenny's voice; update `ELEVENLABS_VOICE_ID` in `background/config.js`
- [ ] **Re-seed audio_url cache** with Lenny Formula formatted text (currently bypassed — real-time TTS only)
- [ ] **Dynamic push question** — inject page context into Sentence 3 of Lenny Formula (generic version shipped)
- [ ] **Submit to competition** — April 15, 2026

---

## Remaining Timeline (as of Mar 29, 2026)

| Period | Dates | Focus |
|---|---|---|
| Now → Apr 3 | Mar 29–Apr 3 | Platform redesign (element-first detection + badge pill UX) |
| Apr 4–8 | Apr 4–8 | Voice clone + Gamification + Onboarding |
| Apr 9–12 | Apr 9–12 | Chrome notifications + Audio re-seed + Dynamic push question |
| Buffer | Apr 13–15 | Full E2E testing + bug fixes + submit |

---

## Known Issues & Gotchas

> Add new issues here as discovered — never delete old ones

- Supabase MCP needs Claude Code restart after first config — known behaviour
- Web Speech API requires https:// or localhost — won't work on http:// pages
- ElevenLabs agent voice swap: update voice_id field via ElevenLabs dashboard or API
- Chrome Manifest V3 service workers are ephemeral — don't store state in memory, use chrome.storage
- Double-tap Ctrl may conflict on some Mac keyboard layouts — test on Rajat's MacBook Air
- Groq `NOT_PM` gate must be paired with the regex guard — neither alone is sufficient. Regex catches obvious social patterns at zero cost; Groq catches the long tail (travel, jokes, personal). Removing either breaks the system in opposite directions.

---

## Lessons Learned

> Updated automatically whenever a correction is made during development
> Format: [Date] — What went wrong → What the correct approach is

- [2026-03-20] — Pasted file path into Supabase SQL Editor instead of SQL content → Always open the file first with cat or a text editor, copy the content, then paste into SQL Editor
- [2026-03-20] — Supabase MCP needs restart after first config → Run claude mcp add then restart Claude Code before expecting MCP to be active
- [2026-03-21] — Supabase MCP requires a Personal Access Token (PAT), not the project anon key → Get PAT from supabase.com/dashboard/account/tokens and use that in .mcp.json Authorization header
- [2026-03-21] — Google AI `text-embedding-004` no longer exists; replaced by `gemini-embedding-001` with `outputDimensionality: 768` → Always use `gemini-embedding-001` for embeddings
- [2026-03-21] — `gemini-embedding-001` cosine similarities peak ~0.62 for related content (vs OpenAI ~0.85+) → Use `match_threshold: 0.45` when calling `match_transcript_chunks`
- [2026-03-21] — `data:` URI audio blocked by strict CSP on Notion, Linear, and similar sites → Always use `URL.createObjectURL(blob)` for audio playback in content scripts; never use `new Audio('data:audio/mpeg;base64,...')`
- [2026-03-21] — `pull_quote` fields are 300+ word essays, far too long for TTS (timeouts + huge audio files) → Use `insight` field for TTS (1 concise sentence); `pull_quote` is for reading on the postcard
- [2026-03-21] — Conversational speech queries ("can you tell me about X") dilute embedding similarity → Strip filler prefixes in `cleanQuery()` in service-worker.js before embedding
- [2026-03-21] — `ctx.resume()` returns a Promise — unhandled rejection surfaces AudioContext autoplay warning even inside try/catch → Always `.catch(() => {})` on `ctx.resume()`
- [2026-03-22] — `Promise.race([fetch, timeout])` dangling rejection: when the fetch wins, the `setTimeout` inside the timeout promise is never cleared — 8s later it rejects as unhandled → Always extract `setTimeout` to a variable and call `clearTimeout(id)` in `.finally()` on the outer promise chain
- [2026-03-22] — `CREATE OR REPLACE FUNCTION` fails when adding columns to `RETURNS TABLE` — Postgres cannot change return type of existing function → Always `DROP FUNCTION IF EXISTS fn(arg_types)` before recreating with a different return type
- [2026-03-22] — Google AI returns "Your project has exceeded its spending cap" as a spurious/transient error even when no cap is actually hit — check AI Studio before taking action; it may resolve on retry without any billing change
- [2026-03-22] — `curate_progress.json` `complete: true` flag must be manually reset to `false` before relaunching curate.js for a partial resume — otherwise watch-and-finalize.js triggers finalize immediately on start
- [2026-03-22] — curate.js spending-cap errors are not handled by `waitForQuotaReset()` (which only catches `PerDay`/`limit: 0`) — failed episodes are not marked processed, so they will be retried on next run automatically
- [2026-03-22] — URL and page title are useless as context signals in modern SPAs (Notion, Linear, Google Docs) — URLs are opaque hashes, titles are often "Untitled" → use `pageContext` (actual DOM text) instead
- [2026-03-22] — gemini-embedding-001 peaks at ~0.62 similarity for related content — never set fast-path threshold above 0.50 or nearly everything will fall through to the abstraction layer
- [2026-03-22] — `document.body.innerText` is polluted with nav/sidebar/menu text on SPAs → always use `document.activeElement` first, then semantic containers (`article`/`main`/`[role="main"]`)
- [2026-03-22] — Claude API adds 500–1500ms latency — unacceptable for an ambient tool; use Groq `llama3-8b-8192` (<200ms) for any real-time inference in the extension pipeline
- [2026-03-22] — ElevenLabs REST TTS has no system prompt or reasoning — it reads whatever text you pass verbatim; the "Lenny Formula" must be constructed in service-worker.js via `buildSpokenText()`, not in the ElevenLabs dashboard
- [2026-03-22] — Pre-seeded `audio_url` cache becomes stale when spoken text format changes; bypass cache entirely until it's re-seeded with the new format — never mix cached audio (old format) with real-time TTS (new format)
- [2026-03-22] — Non-PM queries ("how are you?") must be rejected before RAG — without an intent guard, the abstraction layer maps social phrases to interpersonal PM topics (e.g. "how are you" → stakeholder management); add regex guard first, Groq `NOT_PM` check second
- [2026-03-22] — Groq `NOT_PM` classification has a narrow correct scope: ONLY pure social/emotional/entertainment phrases with no business noun (e.g. "it's time to disco", "I'm hungry"). ANY query with a business domain noun must be abstracted, never rejected — "insurance claim" is NOT_PM=false even though it sounds non-PM
- [2026-03-22] — Removing `NOT_PM` from Groq entirely is wrong — it causes entertainment phrases ("it's time to disco") to abstract into PM insights. The regex guard handles obvious social patterns; Groq `NOT_PM` handles the long tail (travel questions, jokes, personal statements). Both gates are needed.
- [2026-03-22] — Query-specific empathetic rejection messages require Groq to generate the response text (not just classify) — significant complexity for marginal gain. Use a single warm catchall toast instead: acknowledges the user was heard, pivots to PM territory. Query-specific empathy is V3.
- [2026-03-22] — Groq `llama3-8b-8192` was decommissioned → use `llama-3.1-8b-instant` (same speed, same quality). Check Groq model availability before hardcoding any model name.
- [2026-03-22] — Groq echoes the input when system prompt examples use arrow notation (`"insurance claim" → "conversion funnel..."`) — model imitates the format and prefixes output with the input query → always add explicit "Do NOT repeat the input query. Do NOT use arrow notation." to any Groq prompt that uses examples with arrows.
- [2026-03-22] — Silent API failures (Groq timeout, ElevenLabs 5xx) are invisible to the user — they think the extension is broken → always map every catch block to a `network_error` status push, never just `console.warn`. Push 2 (audio) failures must also push `network_error` since the postcard is already visible and audio silence is confusing.
- [2026-03-25] — Using different `chrome.storage.local` keys for the same setting in popup vs. content-script breaks sync silently — popup wrote `isMuted`, content-script read/wrote `voiceMuted`, so mute toggle did nothing → define all storage key names as comments at the top of the file that uses them; cross-check any key used in both popup.js and content-script.js.
- [2026-03-25] — Scoping features as "good enough for demo" or deferring to "phase 2" is the wrong mental model — this is a full product for real users launching April 15th. If a feature is needed for a good user experience (onboarding, notifications, streak shield), it is V1, not V2. There is no phase 2.
- [2026-03-29] — `triggerEagerFetch` keyword detection was too restrictive: `extractPageContext()` returns only the active Notion block (often one short sentence without PM keywords) → always use two-level detection: cursor block first, fall back to semantic container (`article`/`main`/`[role="main"]`). Symptom: `pageContext: active cursor block` logs but `Write+pause: eager Groq fetch` never appears.
- [2026-03-29] — URL-gating (`manifest.json` hardcoding 4 platforms) is wrong for an ambient tool — it kills demos on unlisted platforms and means every new platform requires a code change + Web Store re-review → rebuild with element-first detection: `focusin`/`focusout` gate on any contenteditable/textarea, `<all_urls>` optional permissions with per-site opt-in onboarding.

---

## References

- **Full PRD:** `LENNY_LIVE_PRD.md`
- **Task tracker:** `tasks/todo.md`
- **Lessons:** `tasks/lessons.md`
- **ChatPRD Transcripts:** `github.com/ChatPRD/lennys-podcast-transcripts`
- **Lenny Official Repo:** `github.com/LennysNewsletter/lennys-newsletterpodcastdata`
- **Supabase pgvector:** `https://supabase.com/docs/guides/ai/vector-columns`
- **Chrome Manifest V3:** `https://developer.chrome.com/docs/extensions/mv3`
- **Web Speech API:** `https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API`
- **ElevenLabs Docs:** `https://elevenlabs.io/docs`
- **Superpowers:** Primary workflow orchestrator (brainstorm → plan → execute). Installed via Claude Code plugin. `github.com/obra/superpowers`

---

*Lenny Live — Built by Rajat Sharma, Mumbai*
*Lenny Rachitsky Data Challenge — April 2026*
