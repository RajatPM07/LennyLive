# Embedding Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Curate 25 PM insights from Lenny's podcast transcripts, embed them with Google AI, and load them into Supabase pgvector — making the RAG pipeline ready for the Chrome extension.

**Architecture:** A Node.js script reads `data/curated_moments.json`, calls Google AI `text-embedding-004` per `pull_quote`, and upserts rows into Supabase `transcript_chunks`. The migration is updated from `vector(1536)` to `vector(768)` to match the Google model output.

**Tech Stack:** Node.js (ESM), `@google/generative-ai`, `@supabase/supabase-js`, `dotenv`, Supabase pgvector

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/001_initial_schema.sql` | Already updated | Source of truth for schema — vector(768) |
| `package.json` | Create | Node.js ESM project config + dependencies |
| `data/curated_moments.json` | Create | 25 hand-curated PM moments (Retention×10, GTM×8, PMF×7) |
| `scripts/embed.js` | Create | Reads JSON, embeds via Google AI, upserts to Supabase |
| `.env` | Modify | Add `GOOGLE_AI_API_KEY` |

---

## Task 1: Re-apply Migration to Supabase

The migration was updated to use `vector(768)`. Since no data has been loaded, drop and recreate the tables.

**Files:**
- Reference: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Open the Supabase SQL editor**

Go to `https://supabase.com/dashboard/project/kjbeubcbhbjrnbnztwap/sql/new`

- [ ] **Step 2: Drop existing tables (safe — no data)**

```sql
drop table if exists saved_insights cascade;
drop table if exists user_data cascade;
drop table if exists transcript_chunks cascade;
drop function if exists match_transcript_chunks cascade;
drop function if exists update_updated_at cascade;
```

Run and confirm: "Success. No rows returned."

- [ ] **Step 3: Re-apply the full migration**

Open `supabase/migrations/001_initial_schema.sql`, copy the entire contents, paste into the SQL editor, and run.

Confirm: "Success. No rows returned."

- [ ] **Step 4: Verify the schema**

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'transcript_chunks'
order by ordinal_position;
```

Expected columns (in order): `id`, `topic`, `guest_name`, `insight`, `pull_quote`, `episode_title`, `youtube_url`, `timestamp_secs`, `embedding`, `created_at`

Confirm `embedding` shows `USER-DEFINED` type (that's pgvector).

- [ ] **Step 5: Verify the RAG function exists**

```sql
select routine_name, routine_type
from information_schema.routines
where routine_name = 'match_transcript_chunks';
```

Expected: one row, `routine_type = 'FUNCTION'`

---

## Task 2: Set Up Node.js Toolchain

**Files:**
- Create: `package.json` (repo root)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "lenny-live-scripts",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "@supabase/supabase-js": "^2.49.1",
    "dotenv": "^16.4.7"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/rajat/AntiGravity/LennyLive
npm install
```

Expected: `node_modules/` created, `package-lock.json` created. No errors.

- [ ] **Step 3: Verify Google AI package installs correctly**

```bash
node -e "import('@google/generative-ai').then(m => console.log('OK:', Object.keys(m)))"
```

Expected: `OK: [ 'GoogleGenerativeAI', ... ]`

- [ ] **Step 4: Add `node_modules` to `.gitignore`**

Check if `.gitignore` exists. If not, create it. Add these lines if not already present:

```
node_modules/
package-lock.json
.env
```

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: add Node.js toolchain for embedding scripts"
```

---

## Task 3: Curate 25 PM Moments

**Files:**
- Create: `data/curated_moments.json`

**Sources to fetch:**
- `https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/` — browse via GitHub API: `https://api.github.com/repos/ChatPRD/lennys-podcast-transcripts/contents/`
- `https://api.github.com/repos/LennysNewsletter/lennys-newsletterpodcastdata/contents/`

**Curation criteria (all 3 must pass for each moment):**
1. Specific — guest gives a concrete tactic, number, or company example
2. Quotable — one sentence that stands alone as a postcard pull quote
3. Story-driven — has context: what was tried, what failed or worked

**Distribution:** Retention×10, GTM Strategy×8, Product-Market Fit×7

- [ ] **Step 1: Browse the ChatPRD transcript repo**

Fetch the repo contents listing:
```
GET https://api.github.com/repos/ChatPRD/lennys-podcast-transcripts/contents/
```

Note the folder/file structure. Transcripts are in markdown files, one per episode.

- [ ] **Step 2: Browse the LennysNewsletter repo for additional metadata**

```
GET https://api.github.com/repos/LennysNewsletter/lennys-newsletterpodcastdata/contents/
```

Note any structured data files (JSON, CSV) useful for YouTube URLs.

- [ ] **Step 3: Identify high-value episodes per topic**

For each of the 3 topics, find episodes known to contain strong PM insights:
- **Retention:** Look for episodes with Brian Balfour, Casey Winters, Andrew Chen, Lenny's own retention frameworks
- **GTM Strategy:** Look for Todd Jackson, Elena Verna, Adam Fishman, go-to-market focused episodes
- **PMF:** Look for Bob Moesta, Sachin Rekhi, Lenny's PMF frameworks, 0-to-1 focused episodes

- [ ] **Step 4: Read transcripts and select moments**

For each candidate episode, read the transcript markdown file. Identify 1–3 moments per episode that pass all 3 criteria. Prefer moments where:
- A specific company, number, or timeframe is mentioned
- The guest tells a story of failure or discovery, not just advice
- The pull quote could appear on a postcard and feel sharp and credible

- [ ] **Step 5: Write `data/curated_moments.json`**

Create `data/` directory if it doesn't exist.

```json
[
  {
    "topic": "Retention",
    "guest_name": "<exact name from transcript>",
    "episode_title": "<exact episode title>",
    "insight": "<one-line headline, ≤ 120 chars>",
    "pull_quote": "<full transcript excerpt, 200–400 words>",
    "youtube_url": "<YouTube URL if found, else empty string \"\">",
    "timestamp_secs": <integer seconds, or 0 if unknown>
  }
]
```

**Valid topic values (must match exactly — enforced by DB CHECK constraint):**
- `"Retention"` — 10 entries
- `"GTM Strategy"` — 8 entries
- `"Product-Market Fit"` — 7 entries

**Total: 25 entries**

- [ ] **Step 6: Validate the JSON manually**

Open `data/curated_moments.json` and verify:
- Array length is exactly 25
- Every entry has all 7 fields
- `topic` values match the exact strings above
- `insight` is ≤ 120 characters for each entry
- `pull_quote` is 200–400 words for each entry (estimate — no need to count exactly)
- No entry has `null` values

- [ ] **Step 7: Commit**

```bash
git add data/curated_moments.json
git commit -m "data: add 25 curated PM moments for Retention, GTM, PMF"
```

---

## Task 4: Write and Run `scripts/embed.js`

**Files:**
- Create: `scripts/embed.js`

- [ ] **Step 1: Create the `scripts/` directory**

```bash
mkdir -p scripts
```

- [ ] **Step 2: Write `scripts/embed.js`**

```javascript
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

// Normalize whitespace before DB comparisons and inserts
function normalize(str) {
  return str.trim().replace(/\s+/g, ' ');
}

async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values; // float[] of length 768
}

async function rowExists(episodeTitle, pullQuote) {
  const { data, error } = await supabase
    .from('transcript_chunks')
    .select('id')
    .eq('episode_title', normalize(episodeTitle))
    .eq('pull_quote', normalize(pullQuote))
    .limit(1);
  if (error) throw new Error(`Existence check failed: ${error.message}`);
  return data.length > 0;
}

async function main() {
  const moments = JSON.parse(readFileSync('data/curated_moments.json', 'utf8'));
  console.log(`[LennyLive] ${DRY_RUN ? 'DRY RUN — ' : ''}Processing ${moments.length} moments...`);

  let embedded = 0, skipped = 0;

  for (let i = 0; i < moments.length; i++) {
    const m = moments[i];
    const label = `${i + 1}/${moments.length}: ${m.guest_name} — ${m.topic}`;

    if (await rowExists(m.episode_title, m.pull_quote)) {
      console.log(`[LennyLive] Skipped (exists) ${label}`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[LennyLive] Would embed ${label}`);
      embedded++;
      continue;
    }

    const embedding = await getEmbedding(normalize(m.pull_quote));

    const { error } = await supabase.from('transcript_chunks').insert({
      topic: m.topic,
      guest_name: m.guest_name,
      insight: m.insight,
      pull_quote: normalize(m.pull_quote),
      episode_title: normalize(m.episode_title),
      youtube_url: m.youtube_url,
      timestamp_secs: m.timestamp_secs,
      embedding,
    });

    if (error) throw new Error(`Insert failed for "${m.guest_name}": ${error.message}`);

    console.log(`[LennyLive] Embedded ${label}`);
    embedded++;

    await new Promise(r => setTimeout(r, 100)); // conservative delay
  }

  console.log(`[LennyLive] Done. ${embedded} embedded, ${skipped} skipped.`);
}

main().catch(err => {
  console.error('[LennyLive] Fatal error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Confirm `.env` has `GOOGLE_AI_API_KEY` set**

```bash
grep GOOGLE_AI_API_KEY .env
```

Expected: `GOOGLE_AI_API_KEY=<your key>` (non-empty value).

If missing, get a free key at `aistudio.google.com` → API Keys, then add to `.env`.

- [ ] **Step 4: Run in dry-run mode to validate without API calls**

```bash
node scripts/embed.js --dry-run
```

Expected output:
```
[LennyLive] DRY RUN — Processing 25 moments...
[LennyLive] Would embed 1/25: <guest> — Retention
[LennyLive] Would embed 2/25: ...
...
[LennyLive] Done. 25 embedded, 0 skipped.
```

If you see `Fatal error: Cannot read...` — the JSON file path is wrong. Check you're running from the repo root.

- [ ] **Step 5: Run the real embed**

```bash
node scripts/embed.js
```

Expected: 25 lines of `[LennyLive] Embedded N/25: ...` followed by `Done. 25 embedded, 0 skipped.`

If you see a `violates check constraint` error — a `topic` value in the JSON doesn't match the exact constraint strings. Fix the JSON entry.

If you see a Google API error — verify `GOOGLE_AI_API_KEY` is correct and the key has the Generative Language API enabled in Google Cloud console.

- [ ] **Step 6: Commit**

```bash
git add scripts/embed.js
git commit -m "feat: add Google AI embedding script for transcript_chunks"
```

---

## Task 5: Verify End-to-End

- [ ] **Step 1: Row count check**

In Supabase SQL editor (`https://supabase.com/dashboard/project/kjbeubcbhbjrnbnztwap/sql/new`):

```sql
select count(*) from transcript_chunks where embedding is not null;
```

Expected: `25`

- [ ] **Step 2: Topic distribution check**

```sql
select topic, count(*) as count
from transcript_chunks
group by topic
order by count desc;
```

Expected:
```
Retention          | 10
GTM Strategy       | 8
Product-Market Fit | 7
```

- [ ] **Step 3: Generate a test embedding for the smoke test**

```bash
node -e "
import('dotenv/config').then(async () => {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const res = await model.embedContent('how do I improve retention?');
  console.log(JSON.stringify(res.embedding.values));
});
"
```

Copy the output (a JSON array of 768 floats).

- [ ] **Step 4: RAG smoke test**

Paste the vector into Supabase SQL editor:

```sql
select guest_name, topic, similarity
from match_transcript_chunks(
  '[...paste 768-dim vector here...]'::vector(768),
  0.75,
  3
);
```

Expected: 3 rows returned, `topic` values should be `Retention`. Similarity scores should be > 0.75.

If 0 rows returned with threshold 0.75, try lowering to 0.5 to confirm the data loaded — then investigate embedding quality.

- [ ] **Step 5: Final commit**

```bash
git add data/curated_moments.json scripts/embed.js package.json
git commit -m "feat: complete embedding pipeline — 25 moments in Supabase"
```

---

## Environment Reference

```bash
# .env — required keys for this pipeline
SUPABASE_URL=https://kjbeubcbhbjrnbnztwap.supabase.co
SUPABASE_ANON_KEY=<from Supabase dashboard>
GOOGLE_AI_API_KEY=<from aistudio.google.com>
```

## Done Criteria

- [ ] Supabase `transcript_chunks` has 25 rows with non-null embeddings
- [ ] Topic distribution: Retention=10, GTM Strategy=8, Product-Market Fit=7
- [ ] `match_transcript_chunks` returns relevant results for a retention query
- [ ] `embed.js` is idempotent — re-running produces `0 embedded, 25 skipped`
