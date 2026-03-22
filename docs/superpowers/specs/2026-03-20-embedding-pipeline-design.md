# Embedding Pipeline Design
> Date: 2026-03-20 | Project: Lenny Live | Author: Rajat Sharma

---

## Overview

Design for the transcript curation and embedding pipeline — Week 1 priority. Takes hand-curated PM insights from Lenny's podcast transcripts, generates Google AI embeddings, and loads them into Supabase pgvector for RAG-grounded responses.

**Scope:** 3 topics only for Week 1 — Retention, GTM Strategy, Product-Market Fit. Expand to remaining 7 topics in Week 2.

**Approach selected:** Manual curation + single-shot embed script (Option A).

**Embedding provider:** Google AI Studio (`text-embedding-004`, 768 dimensions) — free API key, no credit card required. Get key at `aistudio.google.com`.


---

## Part 1: Data Curation

### Source Repositories
- **Primary:** `ChatPRD/lennys-podcast-transcripts` — 269 episodes in markdown format
- **Secondary:** `LennysNewsletter/lennys-newsletterpodcastdata` — cross-reference for YouTube URLs and additional metadata

### Curation Target
25 moments total across 3 topics:
- Retention: 10 moments
- GTM Strategy: 8 moments
- Product-Market Fit: 7 moments

### Curation Criteria (all 3 must pass)
1. **Specific** — a real guest gives a concrete tactic, number, or company example
2. **Quotable** — one sentence that could stand alone as a postcard pull quote
3. **Story-driven** — has context: what was tried, what failed or worked

### Output File
`data/curated_moments.json` — array of 25 objects:

```json
[
  {
    "topic": "Retention",
    "guest_name": "Brian Balfour",
    "episode_title": "How to build a growth machine",
    "insight": "Retention is a habit problem, not a feature problem",
    "pull_quote": "The biggest mistake PMs make is shipping features to fix retention. Retention is a habit problem, not a feature problem. When we worked on Reforge, we saw that every company chasing retention with a new feature was actually solving the wrong problem — they hadn't found the habit yet...",
    "youtube_url": "https://youtube.com/watch?v=...",
    "timestamp_secs": 842
  }
]
```

### Field Definitions

| JSON field | DB column | Type | Notes |
|---|---|---|---|
| `topic` | `topic` | text | **Must match CHECK constraint exactly** — see valid values below |
| `guest_name` | `guest_name` | text | Real name from transcript, required |
| `episode_title` | `episode_title` | text | Exact episode title, required |
| `insight` | `insight` | text | One-line headline, ≤ 120 chars, required |
| `pull_quote` | `pull_quote` | text | Full transcript excerpt, 200–400 words — **this is what gets embedded** |
| `youtube_url` | `youtube_url` | text | Required — use empty string `""` if not found. Downstream consumers must treat `""` as "no link available" and suppress the YouTube link UI element. |
| `timestamp_secs` | `timestamp_secs` | integer | Seconds into episode, required — use `0` if unknown |

### Valid Topic Values (must match CHECK constraint exactly)
```
'Retention'
'GTM Strategy'
'Product-Market Fit'
'Roadmap Prioritisation'
'Growth Loops'
'Stakeholder Management'
'Hiring'
'Metrics & North Star'
'User Research'
'0-to-1 Building'
```

Week 1 uses only the first three.

---

## Part 2: Embedding Script

### File
`scripts/embed.js` — standalone Node.js script, ES6 modules

### Embedding API
**Google AI Studio** — `text-embedding-004` model
- Free tier, no credit card required
- Get API key: `aistudio.google.com` → API Keys
- Output: 768 dimensions
- REST endpoint: `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`
- SDK: `@google/generative-ai` npm package

### Dependencies (`package.json`)
```json
{
  "name": "lenny-live-scripts",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@google/generative-ai": "^0.x",
    "@supabase/supabase-js": "^2.x",
    "dotenv": "^16.x"
  }
}
```

> **Note:** `package.json` lives at the repo root. It only affects the `scripts/` Node toolchain — Chrome loads extension files directly and ignores `package.json`. The `"type": "module"` flag does not impact extension loading.

### Environment Variable
Add to `.env`:
```bash
GOOGLE_AI_API_KEY=   # From aistudio.google.com → API Keys
```

### Step-by-Step Flow
1. Load `.env` — `GOOGLE_AI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
2. Read `data/curated_moments.json`
3. For each moment:
   a. Check Supabase: SELECT existing rows matching `episode_title + pull_quote` — skip if found
   b. Call Google AI `text-embedding-004` on the `pull_quote` field (768 dimensions)
   c. Wait 100ms (conservative delay between API calls)
   d. INSERT row into Supabase `transcript_chunks` with all fields + embedding
   e. Log: `[LennyLive] Embedded 1/25: Brian Balfour — Retention`
4. Report summary on completion: `[LennyLive] Done. 25 embedded, 0 skipped.`

### What Gets Embedded
The `pull_quote` field — the full transcript excerpt (200–400 words). This is the richest text and provides the best semantic search signal. The `insight` field (≤ 120 chars) is too short for quality embeddings.

### Idempotency
Before each INSERT, the script normalizes both `episode_title` and `pull_quote` (trim + collapse whitespace), then checks:
```sql
SELECT id FROM transcript_chunks
WHERE episode_title = $1 AND pull_quote = $2
LIMIT 1;
```
If a row is found, skip it. Normalizing before comparison prevents false misses if the JSON file is edited between runs (e.g., extra whitespace added). This approach is intentionally simple for the 25-row Week 1 scope — no unique constraint needed.

> **Note:** The `saved_insights` table references `transcript_chunks.id` as a FK (`chunk_id`). The UUIDs assigned during this embed run are the stable identifiers used by the gamification layer. Do not delete and re-insert rows — update embeddings in place if re-embedding is needed.

### Supabase Target Table (actual schema — updated for 768 dims)
```sql
create table if not exists transcript_chunks (
  id              uuid primary key default gen_random_uuid(),
  topic           text not null,          -- CHECK constraint: exact topic strings only
  guest_name      text not null,
  insight         text not null,          -- one-line insight, ≤ 120 chars
  pull_quote      text not null,          -- full transcript excerpt — embedded
  episode_title   text not null,
  youtube_url     text not null,
  timestamp_secs  integer not null,
  embedding       vector(768),            -- Google text-embedding-004 output
  created_at      timestamptz not null default now()
);
```

> **Schema change required:** The migration `001_initial_schema.sql` currently has `embedding vector(1536)`. This must be updated to `vector(768)` before running the embed script. Since no data has been loaded yet, the migration file can be edited directly and re-applied.

### Run Command
```bash
npm install
node scripts/embed.js
```

---

## Part 3: Verification

After running the script:

**Step 1 — Row count check (Supabase SQL editor):**
```sql
select count(*) from transcript_chunks where embedding is not null;
-- Expected: 25
```

**Step 2 — Topic distribution check:**
```sql
select topic, count(*) from transcript_chunks group by topic;
-- Expected: Retention=10, GTM Strategy=8, Product-Market Fit=7
```

> **Schema warning:** `CLAUDE.md` contains a stale schema showing `search_transcripts` as the RAG function name. The actual deployed function is `match_transcript_chunks`. Use `match_transcript_chunks` everywhere — in this verification and in `service-worker.js`.

**Step 3 — RAG smoke test (requires a test embedding vector):**

To get a test vector, run this once in Node:
```javascript
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
const res = await model.embedContent('how do I improve retention?');
console.log(JSON.stringify(res.embedding.values));
```

Then paste the output vector into Supabase SQL editor:
```sql
select guest_name, topic, similarity
from match_transcript_chunks(
  '[...paste 768-dim vector here...]'::vector(768),
  0.75,
  3
);
-- Expected: top results should be Retention topic rows
```

> **Note:** The `match_transcript_chunks` function signature in the migration uses `vector(1536)`. The function must also be updated to `vector(768)` alongside the table column change.

---

## Schema Migration Update Required

Before running the embed script, update `supabase/migrations/001_initial_schema.sql`:

1. Change `embedding vector(1536)` → `embedding vector(768)` in `transcript_chunks`
2. Change `query_embedding vector(1536)` → `query_embedding vector(768)` in `match_transcript_chunks` function
3. Change `'[embedding]'::vector(1536)` → `'[embedding]'::vector(768)` in the similarity search
4. Re-apply the migration in Supabase (drop and recreate tables — safe since no data loaded yet)

---

## Out of Scope
- Topics beyond Retention, GTM Strategy, Product-Market Fit (Week 2)
- Automated curation via Claude API (deferred)
- Full 269-episode embedding (V2)
- Re-chunking logic for long transcripts

---

## Files Created / Modified by This Pipeline

```
LennyLive/
├── data/
│   └── curated_moments.json              # 25 hand-curated moments
├── scripts/
│   └── embed.js                          # Embedding + Supabase upsert script
├── supabase/migrations/
│   └── 001_initial_schema.sql            # Updated: vector(1536) → vector(768)
├── package.json                          # Node dependencies (type: module)
└── .env                                  # Add GOOGLE_AI_API_KEY
```

> Note: `scripts/` directory should be added to CLAUDE.md project structure. CLAUDE.md schema section is stale — `001_initial_schema.sql` is the source of truth.
