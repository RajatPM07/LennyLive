# Content Polish + Audio Lazy Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all 40 pull_quotes to 2–3 punchy sentences, then implement lazy audio caching so TTS is pre-generated, stored in Supabase Storage, and served as instant CDN fetches instead of real-time API calls.

**Architecture:** Pull_quotes in `data/curated_moments.json` are rewritten in-place; the DB is cleared and re-embedded so embeddings reflect the cleaner text. A new `audio_url` column is added to `transcript_chunks`; a one-time `scripts/seed-audio.js` script generates TTS for all moments and uploads MP3s to a Supabase Storage bucket. The service worker checks `audio_url` first; if present it fetches and base64-encodes the cached file (fast), otherwise falls back to real-time ElevenLabs TTS (existing behaviour).

**Tech Stack:** Node.js ESM, `@supabase/supabase-js`, `dotenv`, ElevenLabs REST API, Supabase Storage, Supabase pgvector, Chrome MV3 service worker.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `data/curated_moments.json` | Modify | Replace all 40 pull_quotes with 2–3 sentence versions |
| `supabase/migrations/002_audio_url.sql` | Create | Add `audio_url` column + update `match_transcript_chunks` return type |
| `scripts/seed-audio.js` | Create | Generate TTS for all chunks with null audio_url, upload to Supabase Storage, write URL back |
| `background/tts.js` | Modify | Add `fetchAndEncodeUrl(url)` export |
| `background/service-worker.js` | Modify | Check `audio_url` on chunk before falling back to real-time TTS; include `audio_url` in insight shape |
| `.env` | Modify | Add `SUPABASE_SERVICE_ROLE_KEY` (seed script only — never read by extension) |
| `background/config.js.example` | Modify | Document that service role key is NOT for the extension |

---

## Task 1: Rewrite all 40 pull_quotes

**Files:**
- Modify: `data/curated_moments.json`

**Rules for every pull_quote:**
- Exactly 2–3 sentences. No exceptions.
- Preserve the most specific data point (percentages, dollar amounts, time periods).
- First sentence: the counterintuitive finding. Second: the mechanism. Third (if needed): the actionable "so what."
- No setup, backstory, or "X explains that…" framing — cut straight to the insight.

- [ ] **Step 1: Open `data/curated_moments.json` and replace every `pull_quote` field with the text below (find by `guest_name` + `insight` to locate each entry)**

**Complete rewritten pull_quotes (in order, matching current file order):**

**1. Naomi Gleit — "Facebook found 7 friends in 10 days…"**
```
"Facebook's growth team discovered that churn and resurrection were larger levers than new acquisition — and that friending was the single variable most correlated with retention. Seven friends in 10 days mapped precisely to when users became likely to stay, because they had seen the core value. This single metric drove all of Facebook's early product innovation: contact importing, profile pictures, and people you may know."
```

**2. Naomi Gleit — "In Jan 2009, Facebook stopped all roadmap work…"**
```
"In January 2009, Facebook halted their entire roadmap to instrument every step of registration and onboarding, revealing a 20% drop-off at email confirmation that was invisible without measurement. The breakthrough was applying a data-driven product approach to what had historically been a marketing responsibility. One elegant fix: allowing notifications to trigger account confirmation rather than requiring users to find a specific email."
```

**3. Gibson Biddle — "Netflix A/B tested faster DVD delivery…"**
```
"Netflix A/B tested faster DVD delivery among 10,000 members and found retention moved from 4.5% to 4.45% canceled — a negligible difference. The $5M inventory cost far exceeded the $1M retention value, proving that what customers say they want and what actually changes their behavior are fundamentally different. Data-driven testing prevents costly mistakes that focus groups always get wrong."
```

**4. Gibson Biddle — "Netflix personalization became their hard-to-copy moat…"**
```
"Netflix's true competitive moat is personalization built on the movie tastes of a billion people — delightful, hard to copy, and margin-enhancing simultaneously. It allows them to right-size content budgets: $500M for Stranger Things (predicted 100M viewers) versus $100M for BoJack Horseman (20M viewers). More members generate better data, better personalization drives engagement, creating a flywheel increasingly difficult to replicate."
```

**5. Bangaly Kaba — "Instagram doubled retention by prioritizing friend connections…"**
```
"Instagram users were following celebrities but posting into echo chambers with no friend engagement, causing them to abandon the app after 7–9 months. Rebalancing the algorithm to prioritize friend-to-friend connections for new users doubled Instagram's retention and drove 40–50% year-over-year growth. Perceived growth drivers like celebrity content can actively harm the core engagement loop for new cohorts."
```

**6. Bangaly Kaba — "Instagram lost 10-12M users yearly to login failures…"**
```
"Instagram lost 10–12 million users yearly because people couldn't remember which email or handle they used — consolidating fields and adding SMS verification halved the problem immediately. Investigating why the fix worked revealed users were creating multiple accounts at scale, directly spawning the multi-account navigation feature. Simple problems, when addressed thoughtfully, expose entirely new product directions."
```

**7. Sean Ellis — "LogMeIn improved activation from 5% to 50%…"**
```
"At LogMeIn, 95% of signups never completed even one remote control session. Halting the roadmap to fix activation improved it from 5% to 50% in three months — turning previously capped $10K/month paid search channels into $1M/month channels overnight. Acquiring customers to a broken activation experience is the startup equivalent of pouring water into a leaking bucket."
```

**8. Lauryn Isford — "Airtable chose 5-10% activation rate…"**
```
"Airtable chose a week-4 multi-user active metric that only 5–10% of signups hit, because it correlated strongly with 12-month retention — a lower rate that predicts loyalty is worth more than a higher rate that doesn't. Each percentage point gain was far more valuable than moving a 40% metric by 2%. An immersive onboarding wizard that helped users build their first real workflow drove a 20% lift on its own."
```

**9. Adam Fishman — "Patreon found that human onboarding support boosted creator revenue 25%…"**
```
"At Patreon, connecting high-potential creators with human support during onboarding improved their first and second month revenue by 25%, directly increasing lifetime value by an equivalent amount. Onboarding is the only part of your product a hundred percent of users will ever touch — it's the first and only moment to deliver on your brand promise. The critical skill is converting qualitative insights from human intervention into scalable product mechanics."
```

**10. Nilan Peiris — "Wise tripled referral rates…"**
```
"Wise tripled referral rates by adding a comparison graph showing hidden bank fees at the transfer completion screen — simply making the value visible transformed passive customers into active advocates. Closing the gap between what you've done and what users perceive is product marketing within the product itself. When users understand the value, they share it naturally; you don't need an external campaign."
```

**11. Elena Verna — "Rebrands feel like growth levers…"**
```
"Elena has never seen a rebrand or homepage redesign actually produce meaningful acquisition results, despite consistent promises that they will. Expect a performance dip post-launch and plan 3–6 months of optimization before potentially outperforming the original. Redesigns are stepping stones backward, not growth tactics — they exist for strategic reasons, not demand generation."
```

**12. Elena Verna — "75% of freemium users don't even know what features cost money…"**
```
"75% of freemium users don't know what features cost money — monetization awareness dwarfs checkout optimization and pricing model design combined. Simply designing every feature from all user states (free, trial, paid) and ensuring visual exposure dramatically increases conversion without changing pricing. This requires zero product insight, just design discipline, yet most teams skip it entirely."
```

**13. Elena Verna — "Product-led sales takes 12+ months…"**
```
"Product-led sales consistently takes 12+ months of usage before sustainable contracts emerge — across Netlify, Miro, and Amplitude, this benchmark held without exception. You cannot generate sign-ups and close pipeline in the same quarter; you're building from sign-ups that happened last year. Product leadership must own revenue targets, or PLG becomes a marketing experiment that fails within six months."
```

**14. Carilu Dietrich — "Atlassian spent 2-3x more on R&D than peers…"**
```
"Atlassian spent 2–3x more on R&D than peers and almost nothing on net-new sales, proving that reinvesting sales budget into product excellence creates a self-perpetuating growth engine. Each additional product in a bundle increased evaluation friction and extended sales cycles — directly contradicting PLG principles. People loved the product so much they spread it organically, with no prospecting required."
```

**15. Nilan Peiris — "Wise learned that only 8-10x better pricing triggered word-of-mouth…"**
```
"Wise found that incremental pricing improvements (5.9% vs. 6%) didn't trigger word-of-mouth — only being 8–10x better created advocacy. To get to recommendation, you have to give users an experience they didn't know was previously possible. With 70% organic growth, Wise proved that when you build something dramatically better, customers do the marketing for you."
```

**16. Madhavan Ramanujam — "20% of what you build drives 80% of willingness to pay…"**
```
"20% of what you build drives 80% of willingness to pay — and that 20% is often the easiest thing to build. Founders identify their most valuable differentiator, build it quickly, then release it cheaply to gain traction, permanently anchoring customer price expectations too low. Reframe MVP as Most Valuable Product: be intentional about what you give away at launch."
```

**17. Casey Winters — "Casey calls early non-scalable tactics 'kindle strategies'…"**
```
"Early non-scalable tactics exist only to unlock scalable growth loops — the kindle's only job is to start the fire, not be the fire. Hire a dedicated growth person only after you've identified a repeatable channel that actually works; premature growth hiring optimizes a broken system. Data network effects — products that improve targeting from their own usage data — are underrated moats in a post-iOS privacy world."
```

**18. Gustaf Alströmer — "YC found you must contact 10 people to get 1 real conversation…"**
```
"You must contact roughly 10 people to have one genuine user conversation — 90% of any market are not early adopters willing to take risks on unknown products. Those early conversations are not a preliminary phase before sales; they are the sales process — the people you interview become your first customers. Founders who confuse investor interest with customer demand never find product-market fit."
```

**19. Sean Ellis — "Lookout went from 7% to 40% on the PMF survey in two weeks…"**
```
"Lookout scored 7% on Sean Ellis's PMF survey, then repositioned solely around antivirus — the one thing passionate users cared about — and hit 40% in two weeks without building a single new feature. Product-market fit is not about building more; it's about ruthlessly focusing on what your passionate users actually value and removing friction to that experience. Six months later Lookout scored 60% and eventually valued at over $1 billion."
```

**20. Bob Moesta — "Adding moving services to condos increased sales 30%…"**
```
"Bob's four forces: the push from the current situation, the pull of the desired outcome, anxiety about something new, and habit of the present — customers only switch when push + pull exceed anxiety + habit. Adding moving services and storage to condos reduced switching anxiety and increased sales 30% despite raising the price. Most companies add features to increase pull, but customers often need friction reduction far more than additional benefits."
```

**21. Bob Moesta — "SNHU interviewed switchers and found students weren't buying education…"**
```
"Southern New Hampshire University found a 200,000+ person market hidden in plain sight by interviewing 50 online students — older, responsibility-laden people needing flexibility, not traditional education. Struggling moments and market opportunities exist before any product does; study people mid-struggle, not those contemplating change. Supply and demand are not as connected as everybody thinks — roadmaps should target recurring struggling moments, not feature lists."
```

**22. Dalton Caldwell — "Tarpit ideas get positive feedback from friends yet have failed since the 1990s…"**
```
"Tarpit ideas seem unsolved, get positive feedback from friends, yet have failed since the 1990s — strong initial validation from your network may signal a tarpit rather than a genuine opportunity. Examine whether similar solutions have been attempted repeatedly throughout tech history and why those attempts failed. Analytics and A/B testing are a waste of time for early startups; one customer who uses your product repeatedly provides better signal than complex dashboards."
```

**23. Dalton Caldwell — "A good pivot is like going home…"**
```
"A good pivot is like going home — warmer, closer to something you're already expert at. Segment started as university classroom software, pivoted to analytics, then discovered their event-routing infrastructure was what customers actually wanted. Every successful pivot builds on accumulated domain knowledge; pivoting toward entirely new domains throws away your unfair advantage."
```

**24. Gaurav Misra — "Captions discovered $500K in revenue growing on its own…"**
```
"Gaurav built Captions in two days, left it unattended for 18 months, and returned to find $500K in revenue growing on its own — zero employees, no releases, no bug fixes, and great reviews. Product-market fit can exist silently while you're chasing other ideas. Apathy in user feedback is the red flag for missing PMF; complaints prove engagement."
```

**25. Casey Winters — "DoorDash ate Grubhub's lunch…"**
```
"Grubhub had high margins, established restaurant relationships, and an asset-light model — yet DoorDash disrupted them in five years by dramatically expanding selection and building delivery infrastructure. When a disruptor expands selection in a cross-sided marketplace, network effects crumble faster than anyone expects. Watching a competitor funded to lose money is not a reason to wait; it's a reason to move faster."
```

**26. Shishir Mehrotra — "YouTube's north star failed because watch time rewarded outrage…"**
```
"YouTube's watch time north star became dangerous without a counterbalancing satisfaction signal — it rewarded outrage content and rabbit holes that users regretted. A north star must pass the regret test: if a user spent three hours on your product and woke up regretting it, your metric is pointing you toward a cliff. Pair every north star with a health counterweight that penalizes hollow engagement alongside depth."
```

**27. Shreyas Doshi — "Output metrics like revenue are lagging indicators…"**
```
"Revenue and retention are output metrics — downstream consequences of value creation that teams cannot directly design toward. The north star should sit one step upstream: the specific user behavior that reliably predicts the output, which a PM can actually influence with a product change this quarter. Rigor without agency is demoralizing; teams need a north star they can steer toward, not just report against."
```

**28. Casey Winters — "A single national north star can mask dying markets underneath…"**
```
"Grubhub's daily orders looked healthy nationally while individual markets died underneath — new market launches inflated the top-line metric as mature markets plateaued. Every north star needs disaggregation by cohort, market, and acquisition channel; macro growth can be new markets papering over a decaying core. If removing new market launches would make your north star stagnate, you're not growing — you're migrating."
```

**29. Shreyas Doshi — "The LNO framework: most PM work is Overhead…"**
```
"Most PM time gets consumed by Overhead (obligations with no upside regardless of quality) and Neutral tasks, while Leverage work — the rare 10x-outcome opportunities — gets displaced because it has no deadline. Protecting time for Leverage work before the week fills is the highest-leverage PM skill. A one-hour investment in finding the right problem prevents a month of building the wrong solution."
```

**30. Gokul Rajaram — "SPADE turns gut-feel decisions into structured ones…"**
```
"SPADE (Setting, People, Alternatives, Decide, Explain) structures irreversible, cross-functional decisions so no one is surprised and the reasoning is documented. Not every decision needs SPADE — it's reserved for calls that are hard to reverse and have broad impact; the skill is knowing which decisions deserve the rigor. Skipping it for genuinely consequential calls creates organizational scar tissue that lasts years."
```

**31. Marty Cagan — "Roadmap prioritization is the wrong conversation…"**
```
"Feature roadmaps mean leadership has already made the most important decisions — PMs become project managers shipping someone else's thinking instead of discovering what's worth building. Empowered product teams receive outcomes to achieve, not features to ship, forcing genuine discovery before committing to a solution. Roadmap prioritization chooses between solutions that may all be wrong; outcome prioritization chooses which problems are worth solving."
```

**32. Teresa Torres — "One customer interview per week compounds faster than quarterly research sprints…"**
```
"Teams that interview one customer per week accumulate 50 calibrated conversations per year; teams that run quarterly sprints accumulate four intense but context-free sessions that interrupt normal work. Research intensity doesn't compensate for research recency — when your last user conversation was three months ago, every product decision is made from stale signal. Continuous contact creates the mental model; the mental model creates better instincts."
```

**33. Teresa Torres — "Opportunity solution trees prevent falling in love with one solution…"**
```
"The opportunity solution tree forces teams to map user needs and pain points broadly before branching into solutions — inverting the common failure mode of starting with a solution and hunting for the problem it solves. Teams routinely discover that the opportunity they assumed was most important is a symptom of a deeper one two levels up the tree. The tree creates explicit, auditable bets on which opportunities to pursue rather than letting the loudest stakeholder set the agenda."
```

**34. Marty Cagan — "Most product failures aren't execution failures — they're discovery failures…"**
```
"The four risks every product team must address before building: value risk (will customers actually use this?), usability risk (can they figure it out?), feasibility risk (can we build it?), and business viability risk (does it work for the business?). Most teams are disciplined about feasibility and viability but skip value and usability discovery entirely. A week of prototyping and five user sessions can eliminate months of engineering work on a bad solution."
```

**35. Hila Qu — "Activation is the biggest multiplier on all other growth metrics…"**
```
"Improving activation from 20% to 40% doubles the productive output of every acquisition channel simultaneously — without changing your ads, SEO, or referral program. You activate users not by showing them all your features, but by removing every obstacle between signup and the first moment the product earns its keep. Everything before that moment is overhead; everything after it compounds."
```

**36. Elena Verna — "Vanity metrics let teams feel busy while hiding whether value is being created…"**
```
"Page views, app downloads, and total registered users can all grow while the product's actual health declines — they measure activity, not value creation. Replace monthly active users with qualified monthly active users defined by behaviors that predict retention; replace signups with activated users; replace downloads with seven-day retained users. Vanity metrics are a delayed failure: the product looks healthy in Q1 and disappoints in Q3."
```

**37. Shishir Mehrotra — "OKRs fail when they become a reporting ritual…"**
```
"OKRs fail when teams reverse-engineer key results from the roadmap they were already going to build, producing activity measurements disguised as outcomes. Real OKRs should make your current roadmap feel slightly uncomfortable — forcing you to reconsider at least one thing you were planning. The absence of that discomfort is the signal that you've written a plan, not a goal."
```

**38. Shreyas Doshi — "There are only three root causes of poor product outcomes…"**
```
"Every poor product outcome has one of three root causes: wrong problem, wrong solution to the right problem, or wrong execution of the right solution. Most teams skip to execution quality because shipping on time is measurable, while having found the right problem is not — creating organizations that are operationally excellent at building things the market doesn't care about. Ask before writing any spec: are we certain this is the right problem?"
```

**39. Marty Cagan — "The most important skill in product strategy is knowing which problems are worth solving…"**
```
"Choosing which problem to solve is the single most consequential decision in product development — and it happens before any engineering begins. An executive who says 'users need feature X' has given you a solution, not a problem; a PM's job is to unwrap the request, find the underlying pain, and evaluate whether it's real, frequent, and shared by enough users to justify investment. This problem-selection skill is the rarest in product management and the hardest to teach."
```

**40. Gibson Biddle — "Gibson's DHM model: great product strategy delights customers in hard-to-copy, margin-enhancing ways…"**
```
"Gibson's DHM model: great strategy must simultaneously delight customers, be hard to copy, and be margin-enhancing — all three must be true or the advantage isn't durable. Netflix personalization passed all three: delightful, requiring a billion-person data moat to replicate, and directly improving content investment efficiency through viewership prediction. If a proposed feature can't articulate how it's delightful, defensible, and economically sound, it doesn't belong on the roadmap."
```

- [ ] **Step 2: Verify the file is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('data/curated_moments.json','utf8')); console.log('✓ Valid JSON')"
```
Expected: `✓ Valid JSON`

- [ ] **Step 3: Verify all 40 entries exist and no pull_quote exceeds 550 characters**

```bash
node -e "
const m = JSON.parse(require('fs').readFileSync('data/curated_moments.json','utf8'));
console.log('Total moments:', m.length);
const long = m.filter(x => x.pull_quote.length > 550);
if (long.length) { console.error('Too long:', long.map(x => x.guest_name + ': ' + x.pull_quote.length)); process.exit(1); }
console.log('✓ All pull_quotes ≤ 550 chars');
"
```
Expected: `Total moments: 40` and `✓ All pull_quotes ≤ 550 chars`

- [ ] **Step 4: Commit**

```bash
git add data/curated_moments.json
git commit -m "content: rewrite all 40 pull_quotes to 2-3 sentences for postcard readability"
```

---

## Task 2: Clear DB and re-embed with clean text

The existing 40 rows have embeddings from the old verbose pull_quotes. Deleting and re-embedding gives cleaner embeddings from the new focused text. The embed script uses `episode_title + pull_quote` as its existence key — since pull_quotes have changed, old rows would cause duplicates, so a clean slate is required.

**Files:**
- No file changes — DB operation only.

- [ ] **Step 1: Delete all existing transcript_chunks rows via Supabase SQL Editor**

Go to Supabase dashboard → SQL Editor and run:
```sql
DELETE FROM transcript_chunks;
```
Expected: "Success. 40 rows affected."

- [ ] **Step 2: Verify table is empty**

```sql
SELECT COUNT(*) FROM transcript_chunks;
```
Expected: `count = 0`

- [ ] **Step 3: Re-embed all 40 moments with fresh embeddings**

```bash
node scripts/embed.js
```
Expected: 40 lines of `[LennyLive] Embedded N/40: ...` with no errors.

- [ ] **Step 4: Verify 40 rows in DB**

```sql
SELECT COUNT(*) FROM transcript_chunks;
```
Expected: `count = 40`

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "data: clear and re-embed all 40 moments with cleaned pull_quotes"
```

---

## Task 3: DB migration — add audio_url + update match function

**Files:**
- Create: `supabase/migrations/002_audio_url.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/002_audio_url.sql
-- Adds audio_url column for lazy-cached TTS audio.
-- Pre-generated MP3s are stored in Supabase Storage bucket 'tts-audio'.
-- NULL means not yet generated — service worker falls back to real-time TTS.

ALTER TABLE transcript_chunks
  ADD COLUMN IF NOT EXISTS audio_url text;

-- Update match_transcript_chunks to return audio_url so the
-- service worker can serve cached audio without a second DB round-trip.
CREATE OR REPLACE FUNCTION match_transcript_chunks(
  query_embedding  vector(768),
  match_threshold  float   DEFAULT 0.5,   -- caller always overrides; keep consistent with 001_initial_schema.sql
  match_count      int     DEFAULT 3
)
RETURNS TABLE (
  id              uuid,
  topic           text,
  guest_name      text,
  insight         text,
  pull_quote      text,
  episode_title   text,
  youtube_url     text,
  timestamp_secs  integer,
  audio_url       text,
  similarity      float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, topic, guest_name, insight, pull_quote,
    episode_title, youtube_url, timestamp_secs,
    audio_url,
    1 - (embedding <=> query_embedding) AS similarity
  FROM transcript_chunks
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Open Supabase dashboard → SQL Editor → paste the full file content → Run.
Expected: "Success."

- [ ] **Step 3: Verify column was added**

```sql
SELECT id, audio_url FROM transcript_chunks LIMIT 1;
```
Expected: row with `audio_url = null`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_audio_url.sql
git commit -m "feat: add audio_url column and update match_transcript_chunks return type"
```

---

## Task 4: Create Supabase Storage bucket

**Files:**
- No file changes — Supabase dashboard operation.

The bucket must exist before `seed-audio.js` can upload to it.

- [ ] **Step 1: Create bucket via Supabase dashboard**

Go to Supabase dashboard → Storage → New bucket:
- Name: `tts-audio`
- Public: ✅ (checked — allows unauthenticated reads for the service worker)
- File size limit: 10 MB
- Allowed MIME types: `audio/mpeg`

- [ ] **Step 2: Verify bucket public URL pattern**

After creation, the public URL format is:
```
https://<project-ref>.supabase.co/storage/v1/object/public/tts-audio/<filename>
```
Note your `<project-ref>` from the Supabase dashboard URL. It should match `SUPABASE_URL` in `.env` (e.g. `https://kjbeubcbhbjrnbnztwap.supabase.co`).

- [ ] **Step 3: Add `SUPABASE_SERVICE_ROLE_KEY` to `.env`**

Get the service role key from Supabase dashboard → Project Settings → API → service_role key (NOT the anon key).

Add to `.env`:
```
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # your service role key
```

⚠️ This key is for `scripts/` only. It MUST NOT be added to `background/config.js` or any extension file.

---

## Task 5: Write `scripts/seed-audio.js`

Generates TTS audio for every chunk with `audio_url IS NULL`, uploads the MP3 to Supabase Storage, then patches `audio_url` in the DB. Idempotent — safe to re-run.

**Files:**
- Create: `scripts/seed-audio.js`

- [ ] **Step 1: Write the script**

```javascript
// scripts/seed-audio.js
// Pre-generates ElevenLabs TTS audio for all transcript_chunks where audio_url IS NULL.
// Uploads each MP3 to Supabase Storage bucket 'tts-audio' and writes the public URL
// back to transcript_chunks.audio_url.
// Idempotent: skips rows that already have audio_url set.
// Run: node scripts/seed-audio.js
// Dry run: node scripts/seed-audio.js --dry-run

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');

const REQUIRED_ENV = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID',
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

// Use service role key — needed for Storage uploads (anon key cannot write)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function generateTTS(text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs failed: ${res.status} — ${err.slice(0, 200)}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('audio')) {
    const body = await res.text();
    throw new Error(`Expected audio, got ${contentType}: ${body.slice(0, 200)}`);
  }
  return await res.arrayBuffer(); // raw MP3 bytes
}

async function uploadAudio(chunkId, audioBuffer) {
  const path = `${chunkId}.mp3`;
  const { error } = await supabase.storage
    .from('tts-audio')
    .upload(path, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw new Error(`Storage upload failed for ${chunkId}: ${error.message}`);

  const { data } = supabase.storage.from('tts-audio').getPublicUrl(path);
  return data.publicUrl;
}

async function patchAudioUrl(chunkId, audioUrl) {
  const { error } = await supabase
    .from('transcript_chunks')
    .update({ audio_url: audioUrl })
    .eq('id', chunkId);
  if (error) throw new Error(`DB patch failed for ${chunkId}: ${error.message}`);
}

async function main() {
  // Fetch all chunks where audio_url is null
  const { data: chunks, error } = await supabase
    .from('transcript_chunks')
    .select('id, guest_name, topic, insight')
    .is('audio_url', null)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Fetch failed: ${error.message}`);
  console.log(`[seed-audio] ${DRY_RUN ? 'DRY RUN — ' : ''}Processing ${chunks.length} chunks with null audio_url...`);

  let done = 0, failed = 0;

  for (const chunk of chunks) {
    const label = `${chunk.guest_name} — ${chunk.topic}`;
    try {
      if (DRY_RUN) {
        console.log(`[seed-audio] Would generate: ${label}`);
        done++;
        continue;
      }

      const audioBuffer = await generateTTS(chunk.insight);
      const publicUrl = await uploadAudio(chunk.id, audioBuffer);
      await patchAudioUrl(chunk.id, publicUrl);

      console.log(`[seed-audio] ✓ ${label} → ${publicUrl}`);
      done++;

      // 200ms delay — ElevenLabs free tier rate limit
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`[seed-audio] ✗ ${label}: ${err.message}`);
      failed++;
    }
  }

  console.log(`[seed-audio] Done. ${done} seeded, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('[seed-audio] Fatal:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Verify dry run works**

```bash
node scripts/seed-audio.js --dry-run
```
Expected: 40 lines of `[seed-audio] Would generate: ...` with `Done. 40 seeded, 0 failed.`

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-audio.js
git commit -m "feat: add seed-audio.js — pre-generate TTS for all chunks and cache in Supabase Storage"
```

---

## Task 6: Update service-worker + tts.js for lazy cache

**Files:**
- Modify: `background/tts.js`
- Modify: `background/service-worker.js`

- [ ] **Step 1: Add `fetchAndEncodeUrl` to `background/tts.js`**

Add this export at the bottom of the file (after the existing `fetchTTS` export):

```javascript
// Fetch a pre-cached MP3 from a URL and return base64-encoded string.
// Used by service worker to serve audio from Supabase Storage instead of
// calling ElevenLabs real-time. Same chunked btoa approach as fetchTTS.
export async function fetchAndEncodeUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cached audio fetch failed: ${res.status} — ${url}`);
  // Validate content-type — Storage should return audio/mpeg; guard against HTML error pages
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('audio')) {
    const body = await res.text();
    throw new Error(`Cached audio fetch: expected audio, got ${contentType} — ${body.slice(0, 200)}`);
  }
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) throw new Error(`Cached audio fetch: empty buffer — ${url}`);
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
```

- [ ] **Step 2: Update the import in `background/service-worker.js`**

Change:
```javascript
import { fetchTTS } from './tts.js';
```
To:
```javascript
import { fetchTTS, fetchAndEncodeUrl } from './tts.js';
```

- [ ] **Step 3: Add `audio_url` to the insight shape in `handleQuery`**

In `background/service-worker.js`, the `insight` object (around line 74) currently has 8 fields. Add `audio_url`:

```javascript
const insight = {
  guest_name:     top.guest_name,
  topic:          top.topic,
  insight:        top.insight,
  pull_quote:     top.pull_quote,
  episode_title:  top.episode_title,
  youtube_url:    top.youtube_url,
  timestamp_secs: top.timestamp_secs,
  similarity:     top.similarity,
  audio_url:      top.audio_url ?? null,  // null if not yet seeded
};
```

- [ ] **Step 4: Replace the TTS fire-and-forget block in `handleQuery`**

Find the block starting `// Push 2 — fire-and-forget TTS race` and replace it entirely with:

```javascript
// Push 2 — fire-and-forget audio (never blocks Push 1)
// Prefer pre-cached URL from Supabase Storage (instant CDN fetch).
// If CDN fetch fails, falls back to real-time TTS so audio is never silently lost.
// Falls back to real-time TTS also when audio_url is null (unseeded moments).
const ttsTimeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('TTS timeout (8s)')), 8000)
);
const audioPromise = insight.audio_url
  ? fetchAndEncodeUrl(insight.audio_url).catch(err => {
      console.warn('[LennyLive] Cached audio failed, falling back to TTS:', err.message);
      return Promise.race([fetchTTS(insight.insight), ttsTimeout]);
    })
  : Promise.race([fetchTTS(insight.insight), ttsTimeout]);

audioPromise
  .then(audio => {
    console.log('[LennyLive] Audio ready:', insight.audio_url ? 'cached' : 'real-time', insight.guest_name);
    pushResponse(tabId, { type: 'AUDIO', audio });
  })
  .catch(err => console.warn('[LennyLive] Audio skipped:', err.message));
```

- [ ] **Step 5: Verify the service worker file is syntactically correct**

```bash
node -e "import('./background/service-worker.js')" 2>&1 | grep -v "chrome is not defined" | head -5
```
Expected: no syntax errors (any `chrome is not defined` errors are expected — Chrome APIs aren't available in Node).

- [ ] **Step 6: Commit**

```bash
git add background/tts.js background/service-worker.js
git commit -m "feat: lazy audio cache — serve pre-cached MP3 from Supabase Storage, fall back to real-time TTS"
```

---

## Task 7: Run seed script + end-to-end verification

**Files:**
- No code changes — operational verification.

- [ ] **Step 1: Run the seed script (live, not dry-run)**

```bash
node scripts/seed-audio.js
```
Expected: 40 lines of `[seed-audio] ✓ Guest Name — Topic → https://...supabase.co/storage/v1/object/public/tts-audio/...`
Final line: `[seed-audio] Done. 40 seeded, 0 failed.`

If any chunks fail, re-run — the script is idempotent and will only retry the failed ones.

- [ ] **Step 2: Verify audio_url is populated for all 40 rows**

```sql
SELECT COUNT(*) FROM transcript_chunks WHERE audio_url IS NOT NULL;
```
Expected: `count = 40`

```sql
SELECT COUNT(*) FROM transcript_chunks WHERE audio_url IS NULL;
```
Expected: `count = 0`

- [ ] **Step 3: Verify one URL is publicly reachable**

```sql
SELECT audio_url FROM transcript_chunks LIMIT 1;
```
Copy the URL and open it in a browser tab — it should download or play an MP3 directly.

- [ ] **Step 4: Reload extension and test**

1. Go to `chrome://extensions` → click reload (↺) on Lenny Live
2. Open a Notion page and hard-refresh (`Cmd+Shift+R`)
3. Double-tap Ctrl → say "retention"
4. Observe service worker log: should see `[LennyLive] Audio ready: cached <guest name>` (not TTS race)
5. Audio should play within ~1–2 seconds of the postcard appearing (CDN fetch vs. 3–5s real-time generation)
6. Postcard pull_quote should now be 2–3 sentences, not a wall of text

- [ ] **Step 5: Commit**

```bash
git add .env.example  # only if you added documentation there
git commit -m "docs: document SUPABASE_SERVICE_ROLE_KEY in .env.example (seed script only)"
```

---

## Definition of Done

- [ ] All 40 pull_quotes are ≤ 550 chars and 2–3 sentences
- [ ] All 40 rows re-embedded in Supabase
- [ ] `audio_url` column exists and is populated for all 40 rows
- [ ] Service worker log shows `Audio ready: cached` (not TTS race) for any query
- [ ] Audio plays within ~2 seconds of postcard appearing
- [ ] Postcard is readable at a glance — no scrolling required for any moment
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is in `.env` but NOT in `background/config.js`
