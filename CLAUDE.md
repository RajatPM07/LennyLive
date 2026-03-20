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

- **Competition deadline:** April 15, 2026
- **Full PRD:** See `LENNY_LIVE_PRD.md` in this folder — read it for full product context
- **Built with Lenny Rachitsky's explicit permission** to use his voice and likeness
- **Primary user:** Early-stage PM / APM (0–3 years experience)

---

## Workflow Orchestration

> Superpowers is the primary workflow orchestrator for all plan → build → review cycles.
> When Superpowers commands are invoked, follow that workflow.
> Everything else in this file (conventions, architecture, principles) applies during execution.

### 1. Plan Mode Default
- For ANY non-trivial task, use the Superpowers workflow:
  1. `/superpowers:brainstorm` — refine what you're building
  2. `/superpowers:write-plan` — break it into bite-sized tasks
  3. `/superpowers:execute-plan` — execute with subagents + review
- Always check `LENNY_LIVE_PRD.md` before implementing a feature
- If something goes sideways mid-execution, STOP and re-plan — don't keep pushing

### 2. Subagent Strategy
- Superpowers `/superpowers:execute-plan` manages subagent dispatch automatically
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
├── .env                               # Environment variables — NEVER commit
├── .gitignore                         # Must include .env
├── manifest.json                      # Chrome Extension Manifest V3
├── background/
│   └── service-worker.js              # Background tasks, Supabase RAG queries
├── content/
│   └── content-script.js             # Page reader, keyword detection, double-tap Ctrl
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── sidebar/
│   ├── sidebar.html                   # Postcard + gamification UI
│   ├── sidebar.js
│   └── sidebar.css
├── utils/
│   ├── supabase.js                    # Supabase client + RAG semantic search
│   ├── elevenlabs.js                  # ElevenLabs agent integration
│   ├── speech.js                      # Web Speech API wrapper
│   └── gamification.js               # Score/streak/library logic
├── data/
│   ├── curated_moments.json           # 25-30 curated PM insights (hand-picked)
│   └── pm_buzzwords.js               # PM keyword detection list
├── scripts/
│   └── embed.js                       # Node.js: reads curated_moments.json, embeds via Google AI, upserts to Supabase
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql     # Source of truth for DB schema — always read this, not the schema section below
├── docs/superpowers/
│   ├── plans/                         # Implementation plans (Superpowers output)
│   └── specs/                         # Design specs (Superpowers output)
├── package.json                       # Node.js ESM config for scripts/ toolchain only (not loaded by Chrome)
└── tasks/
    ├── todo.md                        # Current sprint tasks
    └── lessons.md                     # Learnings from corrections
```

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

## Architecture — How It All Connects

```
User double-taps Ctrl anywhere in Chrome
        ↓
content-script.js — detects double-tap (300ms window)
        ↓
Web Speech API — listens for user query
        ↓
Query sent to service-worker.js via chrome.runtime.sendMessage
        ↓
Google AI gemini-embedding-001 — generates query embedding (768 dims)
        ↓
Supabase pgvector — semantic search → top 3 transcript chunks returned
        ↓
Chunks injected as [DOCUMENT CONTEXT: ...] into ElevenLabs agent
        ↓
ElevenLabs agent responds with Lenny's cloned voice
        ↓
Audio plays in browser + Postcard renders in sidebar
        ↓
User saves insight → Supabase user_data table updated
        ↓
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

## What's Next 🔨

- [ ] ElevenLabs Starter ($5) — clone Lenny's voice from podcast audio
- [ ] Update agent with Lenny's real voice ID
- [ ] Curate 25–30 PM moments — start: Retention, GTM, PMF
- [ ] Build curated_moments.json
- [ ] Embed transcripts into Supabase pgvector via Google AI gemini-embedding-001 (see `docs/superpowers/plans/2026-03-20-embedding-pipeline.md`)
- [ ] Chrome extension shell — Manifest V3
- [ ] content-script.js — double tap Ctrl + passive detection
- [ ] service-worker.js — RAG pipeline
- [ ] sidebar UI — postcard component
- [ ] ElevenLabs agent full integration
- [ ] Gamification — streaks, scores, saved library
- [ ] End-to-end testing
- [ ] Demo video (2 minutes)
- [ ] Submit to competition

---

## 26-Day Timeline

| Week | Dates | Focus |
|---|---|---|
| Week 1 | Mar 20–26 | Data + voice clone + transcript curation + embeddings |
| Week 2 | Mar 27–Apr 2 | Extension shell + RAG pipeline + basic UI |
| Week 3 | Apr 3–Apr 9 | Polish + gamification + selection review + testing |
| Week 4 | Apr 10–Apr 15 | Bug fixes + demo video + submit |

---

## Known Issues & Gotchas

> Add new issues here as discovered — never delete old ones

- Supabase MCP needs Claude Code restart after first config — known behaviour
- Web Speech API requires https:// or localhost — won't work on http:// pages
- ElevenLabs agent voice swap: update voice_id field via ElevenLabs dashboard or API
- Chrome Manifest V3 service workers are ephemeral — don't store state in memory, use chrome.storage
- Double-tap Ctrl may conflict on some Mac keyboard layouts — test on Rajat's MacBook Air

---

## Lessons Learned

> Updated automatically whenever a correction is made during development
> Format: [Date] — What went wrong → What the correct approach is

- [2026-03-20] — Pasted file path into Supabase SQL Editor instead of SQL content → Always open the file first with cat or a text editor, copy the content, then paste into SQL Editor
- [2026-03-20] — Supabase MCP needs restart after first config → Run claude mcp add then restart Claude Code before expecting MCP to be active

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
