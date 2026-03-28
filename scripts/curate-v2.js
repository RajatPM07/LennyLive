// scripts/curate-v2.js
// Extracts 3-5 high-quality PM insights per episode from Lenny's Podcast transcripts.
// Uses Gemini 2.5 Flash with an improved prompt for diverse, personality-driven output.
// Outputs to data/curated_moments_v2.json.
// Run:      node scripts/curate-v2.js
// Dry run:  node scripts/curate-v2.js --dry-run

import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const DRY_RUN       = process.argv.includes('--dry-run');
const EPISODES_DIR  = process.env.EPISODES_DIR || '/Users/rajat/Downloads/lennys-newsletterpodcastdata-all/03-podcasts';
const OUTPUT_PATH   = path.join(process.cwd(), 'data', 'curated_moments_v2.json');
const PROGRESS_PATH = path.join(process.cwd(), 'data', 'curate_v2_progress.json');

// Gemini 2.5 Flash has 1M token context — 200K chars is ~50K tokens, very safe.
// This preserves late-episode insights that were previously lost at 60K.
const TRANSCRIPT_MAX_CHARS = 200_000;

// 1s between requests — conservative for paid tier
const DELAY_MS = 1_000;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Poll until the daily quota resets (Google resets at midnight PT).
async function waitForQuotaReset() {
  console.warn('[curate-v2] Daily quota exhausted — polling every 15 min until it resets...');
  while (true) {
    await sleep(15 * 60 * 1000);
    try {
      await model.generateContent('ping');
      console.log('[curate-v2] Quota reset detected — resuming...');
      return;
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('429')) {
        console.log('[curate-v2] Quota still exhausted — waiting 15 more min...');
      } else {
        console.warn('[curate-v2] Unexpected error during quota poll:', msg.slice(0, 80));
      }
    }
  }
}

async function generateWithRetry(prompt, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const msg = err.message || '';
      const isDailyLimit = msg.includes('429') && (msg.includes('PerDay') || (msg.includes('limit: 0') && msg.includes('quota')));
      const isPerMinuteLimit = msg.includes('429') && msg.includes('PerMinute');
      if (isDailyLimit) {
        await waitForQuotaReset();
        attempt = 0;
        continue;
      }
      if (isPerMinuteLimit && attempt < maxRetries) {
        const backoff = 20_000 * attempt;
        console.warn(`[curate-v2] Per-minute rate limit — waiting ${backoff / 1000}s (attempt ${attempt}/${maxRetries})...`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
}

// Parse YAML frontmatter from markdown file
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w[\w_]*)\s*:\s*"?(.*?)"?\s*$/);
    if (kv) meta[kv[1]] = kv[2];
  }
  return { meta, body: match[2] };
}

// Convert "(HH:MM:SS)" timestamp to seconds
function timestampToSecs(ts) {
  const match = ts.match(/(\d+):(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
}

async function processEpisode(filename) {
  const filePath = path.join(EPISODES_DIR, filename);
  const raw = await fs.readFile(filePath, 'utf8');
  const { meta, body } = parseFrontmatter(raw);

  const content = body.length > TRANSCRIPT_MAX_CHARS
    ? body.slice(0, TRANSCRIPT_MAX_CHARS) + '\n[TRANSCRIPT TRUNCATED]'
    : body;

  const guestName = meta.guest || 'Unknown';
  const episodeTitle = meta.title || filename.replace('.md', '');
  const youtubeUrl = meta.youtube_url || '';

  const prompt = `You are curating Lenny Rachitsky's podcast for an AI mentor tool used by early-stage PMs.

Your job: find the 3 to 5 BEST, most DISTINCT product insights from this episode.

Each insight must be from a DIFFERENT angle or topic — no repeats of the same idea.

=== OUTPUT RULES (violating any = rejected) ===

1. "topic": A free-form label, 2-4 words, describing the PM concept.
   Examples: "retention hooks", "founder mode", "pricing psychology", "hiring bar", "growth loops", "user onboarding", "product sense", "metric selection", "stakeholder buy-in"
   Do NOT use generic labels like "Product Management" or "Business Strategy".

2. "insight": ONE punchy sentence, ≤ 150 characters.
   Write this as if you're paraphrasing what the guest actually said, in their voice.
   Lead with what's SURPRISING or COUNTERINTUITIVE — the thing that makes a PM stop and think.
   No jargon hype. No "leveraging" or "optimizing". Write like a smart friend giving advice.
   BAD: "Optimized onboarding can shift cohort retention curves outward by 10-20 percentage points."
   GOOD: "Most PMs obsess over new features when the real unlock is just fixing onboarding — that alone moved retention 15 points."

3. "pull_quote": The postcard text that hooks the reader. 2-3 sentences, MAXIMUM 350 characters.
   Start with the most SURPRISING claim, specific data point, or counterintuitive finding.
   NO setup framing. NO "According to X…". NO "The key insight is…".
   Write it like you're telling a friend something wild you heard on a podcast.
   It should make someone stop scrolling and say "wait, really?"

4. "guest_name": "${guestName}"

5. "episode_title": "${episodeTitle}"

6. "youtube_url": "${youtubeUrl}"

7. "timestamp_secs": Integer seconds into the episode where this insight appears.
   The transcript has timestamps like (00:04:08) — convert to seconds (= 248).
   Use the timestamp of the speaker turn where the insight appears.

=== QUALITY BAR ===
- Would a senior PM share this in a Slack channel? If not, cut it.
- Does it sound like something the GUEST said, or like an AI wrote a summary? If the latter, rewrite it.
- Is the pull_quote hook-worthy? Would someone tap "read more"? If not, sharpen it.

If fewer than 3 insights meet this bar, return only what's genuinely good. Quality > quantity.
If no strong PM insight exists in this episode, return an empty array: []

Return ONLY a raw JSON array (no markdown, no backticks, no commentary):
[{
  "topic": "...",
  "guest_name": "...",
  "episode_title": "...",
  "insight": "...",
  "pull_quote": "...",
  "youtube_url": "...",
  "timestamp_secs": 0
}]

Transcript:
${content}`;

  const responseText = await generateWithRetry(prompt);

  // Strip any accidental markdown fences
  const cleaned = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let moments;
  try {
    moments = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message} | raw: ${cleaned.slice(0, 300)}`);
  }

  if (!Array.isArray(moments) || moments.length === 0) return [];

  // Validate and clean each moment
  const valid = [];
  for (const m of moments) {
    if (!m.topic || !m.insight || !m.pull_quote) continue;

    // Normalise
    m.guest_name = guestName;
    m.episode_title = episodeTitle;
    m.youtube_url = youtubeUrl;
    m.timestamp_secs = parseInt(m.timestamp_secs, 10) || 0;

    // Warn if pull_quote is long but still include it
    if (m.pull_quote.length > 350) {
      console.warn(`[curate-v2]   ⚠ pull_quote ${m.pull_quote.length} chars (>350) — included with warning`);
    }

    valid.push(m);
  }

  return valid;
}

async function main() {
  if (!process.env.GOOGLE_AI_API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY');

  // List all .md files in the podcasts directory
  const allFiles = (await fs.readdir(EPISODES_DIR))
    .filter(f => f.endsWith('.md'))
    .sort();

  // Resume support
  let processed = new Set();
  let allMoments = [];
  try {
    const prog = JSON.parse(await fs.readFile(PROGRESS_PATH, 'utf8'));
    processed = new Set(prog.processed || []);
    console.log(`[curate-v2] Resuming — ${processed.size} episodes already done`);
  } catch { /* fresh start */ }
  try {
    const existing = JSON.parse(await fs.readFile(OUTPUT_PATH, 'utf8'));
    if (Array.isArray(existing) && existing.length > 0) {
      allMoments = existing;
      console.log(`[curate-v2] Loaded ${allMoments.length} existing moments from output file`);
    }
  } catch { /* fresh start */ }

  const remaining = allFiles.filter(f => !processed.has(f));
  console.log(`[curate-v2] ${DRY_RUN ? 'DRY RUN — ' : ''}${remaining.length} episodes remaining (${allFiles.length} total)...`);

  let totalInsights = 0, noInsight = 0, failed = 0;

  for (let i = 0; i < remaining.length; i++) {
    const file = remaining[i];
    const n = `${processed.size + i + 1}/${allFiles.length}`;

    try {
      const moments = await processEpisode(file);
      if (moments.length > 0) {
        allMoments.push(...moments);
        totalInsights += moments.length;
        console.log(`[curate-v2] ✓ ${n} ${file} — ${moments.length} insights (${moments[0].guest_name})`);
      } else {
        noInsight++;
        if (!DRY_RUN) console.log(`[curate-v2] − ${n} ${file} — no strong PM insight`);
      }
      processed.add(file);
    } catch (err) {
      failed++;
      console.error(`[curate-v2] ✗ ${n} ${file}: ${err.message}`);
      // Do NOT add to processed — allows retry on next run
    }

    // Periodic save every 10 episodes (more frequent since we have more data per ep)
    if (!DRY_RUN && (i + 1) % 10 === 0) {
      await fs.writeFile(OUTPUT_PATH, JSON.stringify(allMoments, null, 2));
      await fs.writeFile(PROGRESS_PATH, JSON.stringify({ processed: [...processed] }, null, 2));
      console.log(`[curate-v2] 💾 Progress save — ${allMoments.length} moments, ${processed.size} episodes done`);
    }

    if (!DRY_RUN && i < remaining.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(allMoments, null, 2));
  await fs.writeFile(PROGRESS_PATH, JSON.stringify({ processed: [...processed], complete: true }, null, 2));
  console.log(`\n[curate-v2] Done.`);
  console.log(`[curate-v2] ✓ Insights extracted: ${totalInsights}`);
  console.log(`[curate-v2] − No insight:         ${noInsight}`);
  console.log(`[curate-v2] ✗ Failed:             ${failed}`);
  console.log(`[curate-v2] Total moments:        ${allMoments.length}`);
  console.log(`[curate-v2] Output:               ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('[curate-v2] Fatal:', err.message);
  process.exit(1);
});
