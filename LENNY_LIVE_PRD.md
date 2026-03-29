# 🎙️ Lenny Live — Product Requirements Document
> Version 2.2 | March 29, 2026 | Rajat Sharma

---

## Overview

**Lenny Live** is a Chrome extension that surfaces the compounded experience of 300+ product leaders as borrowed intuition — arriving while you write, on any platform, exactly when your brain is still inside the problem.

**Compounded experience. Borrowed intuition.**

**Not a chatbot. Not a mentor. Not generated advice.** 100% real stories, real people, real episodes — surfaced by AI at the moment you need them.

**Competition deadline:** April 15, 2026
**Built with Lenny Rachitsky's explicit permission** to use his voice and likeness.

---

## Problem Statement

Early-stage PMs and APMs know Lenny's content exists. They feel overwhelmed by 300+ episodes. They don't know where to start. They feel perpetually behind. When they're heads down writing a PRD or Jira story — the knowledge they need is one tab switch away but they never make that switch.

**Core insight:** Everyone pulls Lenny's content to them. Nobody pushes it into the workflow.

---

## Primary User

**Early-stage PM / APM**
- 0–3 years in product
- Knows Lenny exists, overwhelmed by archive
- Spends significant time in Google Docs, Notion, Jira, Linear
- Needs contextual guidance, not another search interface
- Feels behind, wants a mentor not a chatbot

---

## Core Features — V1 (Competition Scope)

### 1. Activation Modes

#### Mode 1: Active — Double tap `Ctrl`
- Primary interaction
- Double tap Ctrl anywhere in Chrome → Lenny activates with a ping sound
- Speak naturally → Lenny listens and transcribes via Web Speech API
- Single tap Ctrl → stops listening, Lenny processes and responds
- `Esc` → cancel anytime
- Detection window: 300ms between taps

```javascript
// Double tap detection logic
let lastCtrlPress = 0;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') {
    const now = Date.now();
    if (now - lastCtrlPress < 300) {
      activateLennyLive();
    }
    lastCtrlPress = now;
  }
});
```

#### Mode 2: Passive — Auto-detect PM buzzwords
- Extension silently reads active page text
- Detects PM keywords: retention, GTM, PMF, roadmap, churn, activation, north star, growth loops, DAU, MAU, funnel, cohort, ARR, ARPU, NPS, onboarding, conversion, etc.
- Shows subtle floating notification: "Lenny has something to say about [topic] →"
- User clicks notification to hear the insight
- Non-intrusive — fades if ignored after 10 seconds

#### Mode 3: Selection Review
- User highlights any text in document
- Double tap Ctrl → say "What do you think?" or "Review this"
- Extension reads selected text, injects as [DOCUMENT CONTEXT: ...] into agent
- Lenny gives a specific, grounded review of that exact section
- Max selection: 500 words for optimal response quality

---

### 2. Dual-Channel Response

Every Lenny response produces two outputs simultaneously:

#### Audio Layer
- Lenny's cloned voice (ElevenLabs) delivers the insight
- 20–40 seconds max per response
- Intimate, mentor-like, conversational
- Plays through browser audio

#### Visual Layer — The Postcard
Appears alongside the extension after voice response:

```
┌─────────────────────────────────────────┐
│ 💡 Lenny just said:                     │
│                                         │
│ "Distribution beats product in          │
│  early GTM"                             │
│                                         │
│ "When I spoke to Todd Jackson about     │
│  this, the biggest mistake first-time   │
│  PMs make is building before they've    │
│  validated the channel..."              │
│                                         │
│ 📎 Todd Jackson — Episode 201           │
│ [🔁 Replay]  [🔖 Save]  [✕ Dismiss]    │
└─────────────────────────────────────────┘
```

**Postcard specs:**
- Headline: core insight in max 8 words
- Pull quote: sharpest line from the response
- Source: guest name + episode reference
- Replay button: listen again without re-triggering
- Save button: adds to personal library
- Auto-fades after 30 seconds unless saved
- Position: bottom-right of browser, non-overlapping with content

---

### 3. Contextual Fallback Architecture (V2)

All Lenny responses are grounded in actual transcript content — not hallucinated. V2 introduces a 3-signal injection model and a Groq-powered abstraction fallback for niche domains.

#### 3-Signal Context Capture
At Ctrl double-tap, the extension captures three signals:

| Signal | Source | Purpose |
|--------|--------|---------|
| `transcript` | Web Speech API | Explicit user intent |
| `selection` | `window.getSelection()` | What the user is focused on (up to 500 chars) |
| `pageContext` | DOM extraction (see cascade below) | Ambient page content — what they're reading/writing |

**pageContext extraction cascade** (in priority order):
1. **Active cursor block** — `document.activeElement` if `contenteditable`/`textarea`/`input`. Catches Notion blocks, Google Docs paragraphs, Linear fields.
2. **Semantic container** — `document.querySelector('article, main, [role="main"]')`. Catches blog posts, PRDs, docs.
3. **Title fallback** — `document.title` only as last resort.

> Never uses `document.body.innerText` — polluted with nav bars, sidebars, menus.

#### Fast Path (similarity ≥ 0.45)
```
3 signals captured
        ↓
Embed: cleanQuery(transcript) + selection + pageContext
        ↓
Supabase pgvector search (threshold: 0.45)
        ↓ match found
Push 1: RESPONSE → Postcard renders (~400–700ms)
Push 2: AUDIO → ElevenLabs TTS / CDN cache plays
```

#### Three-Tier Confidence Band

`gemini-embedding-001` cosine similarity peaks at ~0.62 for strongly related content (not ~0.90 like OpenAI). The thresholds are calibrated to this:

| Similarity | Path | Action |
|---|---|---|
| > 0.55 | Fast path — high confidence | Ship directly. No Groq call. |
| 0.45–0.55 | Low confidence | Fall through to Groq abstraction with pageContext |
| < 0.45 (no results) | No match | Fall through to Groq abstraction with pageContext |

> Never raise the fast-path threshold above 0.55 — gemini-embedding-001 peaks at ~0.62, so 0.60+ would drop nearly all valid queries.

#### Abstraction Fallback (similarity < 0.55 or no results)
For niche domains not directly in Lenny's corpus (e.g. insurance, fintech, logistics, healthcare):

```
No high-confidence match
        ↓
Groq API — llama-3.1-8b-instant (<200ms)
Maps: "insurance" → "pricing strategy, customer experience, user adoption"
Maps: "claim settlement" → "dispute resolution, claims processing, customer satisfaction"
        ↓
Re-embed abstracted PM concepts
        ↓
Re-search Supabase (threshold: 0.35)
        ↓ match found
Push 1: RESPONSE (abstracted: true) → Postcard renders
Push 2: AUDIO plays
```

The `abstracted: true` flag on the insight object is available for honest mentor framing in future UI iterations (e.g. "Lenny hasn't covered insurance directly, but here's the underlying framework...").

**Why Groq, not Claude:** `llama-3.1-8b-instant` on Groq runs in <200ms. Claude API adds 500–1500ms — unacceptable for an ambient tool.

#### Error Handling
All API failures (Groq, ElevenLabs, Supabase) push `network_error` status to the content script, which surfaces a toast: *"Network error. Lenny needs a second to reconnect."* The extension never fails silently.

> Full query pipeline walkthrough with 15 worked examples: `docs/query-pipeline-explained.md`

---

### 4. Gamification Layer

Stored in Supabase with anonymous user ID (no login required).

**Components:**
- **PM Knowledge Score** — points per insight engaged with (+10 per listen, +20 per save)
- **Weekly streak tracker** — days active this week (Mon–Sun)
- **Saved insight library** — personal Lenny notebook, searchable by topic
- **Shareable weekly card** — "I caught 12 Lenny insights this week" (PNG export)

**Anonymous user ID generation:**
```javascript
// Generate on first install, store in chrome.storage.local
const userId = 'user_' + Math.random().toString(36).substr(2, 9);
chrome.storage.local.set({ userId });
```

---

## Tech Stack

| Component | Tool | Details |
|---|---|---|
| Chrome Extension | Manifest V3 | Content scripts, service worker, popup |
| Voice Agent | ElevenLabs | Agent ID: `agent_7901km588s7mekpthtfw3y9zcykw` |
| Placeholder Voice | Eric | Voice ID: `cjVigY5qzO86Huf0OWal` |
| Lenny Voice Clone | ElevenLabs Starter | TBD — swap voice ID when cloned |
| RAG + Vector DB | Supabase pgvector | Project: kjbeubcbhbjrnbnztwap |
| Semantic Search | Google AI gemini-embedding-001 | 768 dimensions, free via AI Studio |
| Abstraction Fallback | Groq API (llama-3.1-8b-instant) | <200ms niche domain → PM concepts mapping |
| Transcript Data | ChatPRD repo | 303 episodes, 280 curated moments embedded |
| Speech-to-Text | Web Speech API | Chrome built-in, no API key needed |
| Gamification | Supabase + chrome.storage | Anonymous user ID |

---

## Database Schema

### Supabase — transcript_chunks table
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

### Supabase — user_data table
```sql
create table user_data (
  user_id text primary key,
  streak_count int default 0,
  last_active date,
  pm_score int default 0,
  saved_insights jsonb default '[]',
  total_listens int default 0,
  created_at timestamp default now()
);
```

### RAG Query Function
```sql
create or replace function match_transcript_chunks(
  query_embedding vector(768),
  match_threshold float default 0.75,
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

## Curated Transcript Database

### Corpus (V2)
**280 curated moments** across all 303 Lenny podcast episodes, processed by `scripts/curate.js` (gemini-2.5-flash).

Topics are **free-form** — the hard 10-topic CHECK constraint has been removed (migration `002_drop_topic_constraint.sql`). `topic` is now a display label only, used for the postcard pill. RAG matching is 100% semantic via embeddings.

### JSON Schema for Each Curated Moment
```json
{
  "topic": "free-form label (display only)",
  "guest_name": "Brian Balfour",
  "episode_title": "How to build a growth machine",
  "insight": "1 concise sentence — used for TTS voice",
  "pull_quote": "2-3 sentences (≤550 chars) — shown on postcard",
  "youtube_url": "https://youtube.com/watch?v=...",
  "timestamp_secs": 842
}
```

---

## Chrome Extension Architecture

### File Structure
```
lenny-live/
├── manifest.json           # Extension config — Manifest V3
├── background/
│   └── service-worker.js   # Background tasks, Supabase queries
├── content/
│   └── content-script.js   # Page reader, keyword detection, double-tap Ctrl
├── popup/
│   ├── popup.html          # Extension icon popup
│   ├── popup.js
│   └── popup.css
├── sidebar/
│   ├── sidebar.html        # Postcard + gamification UI
│   ├── sidebar.js
│   └── sidebar.css
├── assets/
│   └── icons/              # Extension icons 16/32/48/128px
└── utils/
    ├── supabase.js         # Supabase client + RAG queries
    ├── elevenlabs.js       # ElevenLabs agent integration
    ├── speech.js           # Web Speech API wrapper
    └── gamification.js     # Score/streak/library logic
```

### manifest.json
```json
{
  "manifest_version": 3,
  "name": "Lenny Live",
  "version": "1.0.0",
  "description": "Your ambient PM mentor — Lenny Rachitsky's voice in your workflow",
  "permissions": [
    "activeTab",
    "storage",
    "scripting",
    "microphone"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content-script.js"]
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "32": "assets/icons/icon32.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "sidebar/sidebar.html"
  }
}
```

---

## PM Buzzword Detection List

```javascript
const PM_BUZZWORDS = [
  // Metrics
  'retention', 'churn', 'DAU', 'MAU', 'WAU', 'activation',
  'conversion', 'funnel', 'cohort', 'ARR', 'MRR', 'ARPU', 'LTV',
  'CAC', 'NPS', 'CSAT', 'north star', 'KPI', 'OKR',
  
  // Strategy
  'PMF', 'product market fit', 'GTM', 'go-to-market', 'roadmap',
  'prioritization', 'prioritisation', 'discovery', 'strategy',
  'positioning', 'competitive', 'moat', 'differentiation',
  
  // Growth
  'growth loop', 'viral', 'acquisition', 'referral', 'PLG',
  'product-led', 'paid acquisition', 'SEO', 'content marketing',
  
  // Process
  'user research', 'user interview', 'jobs to be done', 'JTBD',
  'hypothesis', 'A/B test', 'experiment', 'sprint', 'backlog',
  'stakeholder', 'engineering', 'design', 'cross-functional',
  
  // 0-to-1
  'MVP', 'launch', 'go live', 'zero to one', '0 to 1',
  'founding', 'founder', 'early stage', 'pre-PMF'
];
```

---

## ElevenLabs Agent Configuration

**Agent ID:** `agent_7901km588s7mekpthtfw3y9zcykw`

**Key prompt behaviours:**
- Responds in 3–5 sentences max (unless document review)
- Always references a specific guest or episode
- Gives ONE insight — never a list
- Ends with a question that pushes the PM to think harder
- Document review mode: identifies 1 strength + 1 improvement + 1 question
- Context injection: reads `[DOCUMENT CONTEXT: ...]` naturally without mentioning it

**Voice settings:**
- Stability: 0.6 (natural variation)
- Similarity boost: 0.8
- Temperature: 0.7

**To swap in Lenny's real voice:**
```javascript
// Update agent voice ID once Lenny clone is created
const LENNY_VOICE_ID = 'TBD'; // Replace with ElevenLabs clone ID
```

---

## Environment Variables

```bash
# .env — DO NOT COMMIT TO GITHUB
SUPABASE_URL=https://kjbeubcbhbjrnbnztwap.supabase.co
SUPABASE_ANON_KEY=sb_publishable_... # Full key from dashboard
ELEVENLABS_AGENT_ID=agent_7901km588s7mekpthtfw3y9zcykw
ELEVENLABS_VOICE_ID=cjVigY5qzO86Huf0OWal
GOOGLE_AI_API_KEY= # For gemini-embedding-001 (768 dims) — free via aistudio.google.com
GROQ_API_KEY=     # For llama-3.1-8b-instant abstraction fallback — groq.com
```

---

## 26-Day Build Timeline

### Week 1 — Mar 20–26: Foundation
- [ ] Fork ChatPRD transcript repo ✅
- [ ] Set up Supabase — pgvector + tables ✅
- [ ] Sign up ElevenLabs Starter ($5) — clone Lenny's voice
- [ ] Curate 25–30 PM moments — build JSON database
- [ ] Embed transcripts into Supabase pgvector
- [ ] Update ElevenLabs agent with Lenny's real voice ID

### Week 2 — Mar 27–Apr 2: Core Build
- [ ] Chrome extension shell — Manifest V3
- [ ] Double tap Ctrl detection — content script
- [ ] Speech-to-text — Web Speech API
- [ ] PM buzzword passive detection
- [ ] RAG query pipeline: Supabase → Claude → ElevenLabs
- [ ] Basic postcard UI

### Week 3 — Apr 3–Apr 9: Polish
- [ ] ElevenLabs agent full integration
- [ ] Selection review mode (highlight + double tap Ctrl)
- [ ] Postcard design — premium, beautiful
- [ ] Gamification — streaks, scores, saved library
- [ ] Supabase anonymous user ID
- [ ] End-to-end flow testing

### Week 4 — Apr 10–Apr 15: Ship
- [ ] Bug fixes and edge cases
- [ ] 2-minute demo video
- [ ] GitHub README + landing page
- [ ] Submit to Lenny's competition LinkedIn post

---

## Demo Video Script (2 minutes)

1. **[0:00–0:10]** — Open Google Docs, writing a GTM section. Show normal workflow.
2. **[0:10–0:20]** — Double tap Ctrl. Ping sound. "Lenny Live activated" indicator appears.
3. **[0:20–0:30]** — Say "What should I think about for early GTM?"
4. **[0:30–0:55]** — Lenny's voice responds. Grounded, specific, references a real guest.
5. **[0:55–1:05]** — Postcard appears. Pull quote, guest name, episode. Save it.
6. **[1:05–1:20]** — Highlight a paragraph. Double tap Ctrl. "What do you think?"
7. **[1:20–1:40]** — Lenny reviews the specific selection. Identifies one strength, one gap.
8. **[1:40–1:50]** — Open saved library. Show 8 accumulated insights across topics.
9. **[1:50–2:00]** — Show streak counter (5-day streak). PM Knowledge Score: 240.
10. **[2:00]** — End card: "Lenny Live. Your mentor, in your workflow."

---

## Competition Submission

**Project name:** Lenny Live

**One-liner:** The compounded experience of 300 product leaders, borrowed as your intuition while you write — on any platform, exactly when you need it.

**Submission text:**
> "I built Lenny Live — a Chrome extension that surfaces the compounded experience of 300+ product leaders as borrowed intuition, exactly when an early PM is forming a thought. Write anywhere — Notion, Linear, Slack, Gmail — pause for a second, and Lenny surfaces who's already solved what you're wrestling with. Built with your blessing, grounded in your real transcripts via RAG. Not a chatbot. Not generated advice. The right story, from someone who's been there, arriving while your brain is still inside the problem."

---

## Out of Scope — V3+

- "Hey Lenny" wake word activation
- Lenny video avatar (LoRA / Tavus)
- User accounts with authentication
- Mobile extension
- Team mode — share insights with PM team
- Lenny-powered full PRD reviewer
- Postcard teaser + "Read more" CTA (~800 char expanded view)
- Honest mentor framing UI for abstracted results (`abstracted: true` flag ready)

---

## Key References

- **ChatPRD Transcript Repo:** `github.com/ChatPRD/lennys-podcast-transcripts`
- **Lenny Official Repo:** `github.com/LennysNewsletter/lennys-newsletterpodcastdata`
- **Supabase Project:** `https://kjbeubcbhbjrnbnztwap.supabase.co`
- **ElevenLabs Agent ID:** `agent_7901km588s7mekpthtfw3y9zcykw`
- **ElevenLabs Docs:** `https://elevenlabs.io/docs`
- **Supabase pgvector Docs:** `https://supabase.com/docs/guides/ai/vector-columns`
- **Chrome Extension Manifest V3:** `https://developer.chrome.com/docs/extensions/mv3`
- **Web Speech API:** `https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API`
- **Superpowers (build methodology):** `github.com/obra/superpowers`

---

*Built by Rajat Sharma — Senior PM, Mumbai*
*For Lenny Rachitsky's Data Challenge — April 2026*
