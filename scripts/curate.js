// scripts/curate.js
// Extracts the single best PM insight from each Lenny's Podcast transcript
// using Gemini 2.0 Flash. Processes ALL episodes (no buzzword gate, no slice limit).
// Outputs to data/new_curated_moments.json.
// Run:      node scripts/curate.js
// Dry run:  node scripts/curate.js --dry-run

import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const DRY_RUN    = process.argv.includes('--dry-run');
const EPISODES_DIR   = '/tmp/lennys-transcripts/episodes';
const OUTPUT_PATH    = path.join(process.cwd(), 'data', 'new_curated_moments.json');
// Tracks which episode dirs have been processed so the run is resumable.
const PROGRESS_PATH  = path.join(process.cwd(), 'data', 'curate_progress.json');

// Truncate very long transcripts — Gemini Flash context window is generous
// but 60K chars keeps token cost low and avoids edge-case failures.
const TRANSCRIPT_MAX_CHARS = 60_000;

// 7 000ms between requests → ~8.5 RPM, safely under gemini-2.5-flash free tier (10 RPM).
const DELAY_MS = 7_000;

// These are the only values the transcript_chunks.topic CHECK constraint allows.
// Keep in sync with 001_initial_schema.sql until 003_drop_topic_check.sql is run.
const ALLOWED_TOPICS = [
  'Retention',
  'GTM Strategy',
  'Product-Market Fit',
  'Roadmap Prioritisation',
  'Growth Loops',
  'Stakeholder Management',
  'Hiring',
  'Metrics & North Star',
  'User Research',
  '0-to-1 Building',
];

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
// gemini-2.5-flash: used because gemini-2.0-flash daily free-tier quota is exhausted.
// 2.5-flash has separate quota and is actually a more capable model for extraction.
const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Poll until the daily quota resets (Google resets at midnight PT).
// Checks every 15 minutes with a tiny probe request.
async function waitForQuotaReset() {
  console.warn('[curate] Daily quota exhausted — polling every 15 min until it resets...');
  while (true) {
    await sleep(15 * 60 * 1000); // 15 minutes
    try {
      await model.generateContent('ping');
      console.log('[curate] Quota reset detected — resuming...');
      return;
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('429')) {
        console.log('[curate] Quota still exhausted — waiting 15 more min...');
      } else {
        // Unexpected error — log and keep waiting
        console.warn('[curate] Unexpected error during quota poll:', msg.slice(0, 80));
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
        // After reset, retry this same request (reset attempt counter)
        attempt = 0;
        continue;
      }
      if (isPerMinuteLimit && attempt < maxRetries) {
        const backoff = 20_000 * attempt;
        console.warn(`[curate] Per-minute rate limit — waiting ${backoff / 1000}s (attempt ${attempt}/${maxRetries})...`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
}

async function processEpisode(dir) {
  const transcriptPath = path.join(EPISODES_DIR, dir, 'transcript.md');
  const raw = await fs.readFile(transcriptPath, 'utf8');
  const content = raw.length > TRANSCRIPT_MAX_CHARS
    ? raw.slice(0, TRANSCRIPT_MAX_CHARS) + '\n[TRANSCRIPT TRUNCATED AT 60 000 CHARS]'
    : raw;

  const prompt = `You are a senior product manager curating PM insights from Lenny's Podcast transcripts.

Find the SINGLE BEST, most actionable product management insight from this transcript.

STRICT OUTPUT RULES — violating any rule means the moment will be rejected:

1. "topic": MUST be EXACTLY one of these 10 values (copy-paste exactly, including capitalisation):
   ${ALLOWED_TOPICS.map(t => `"${t}"`).join(', ')}
   Pick whichever best fits the insight. Do NOT invent new topic names.

2. "insight": ONE sentence only, ≤120 characters. The sharpest, most memorable takeaway.
   This is read aloud as TTS audio — no jargon, no hedging, no "X said that".

3. "pull_quote": The postcard headline. MAXIMUM 250 characters total. 1–3 SHORT sentences.
   Lead with the counterintuitive finding or specific data point.
   NO setup framing. NO "According to X…". Cut straight to the insight.
   Count your characters carefully — 250 is the hard limit.

4. "guest_name": Exact string from the transcript frontmatter "guest:" field.

5. "episode_title": Exact string from the transcript frontmatter "title:" field.

6. "youtube_url": Exact URL from the transcript frontmatter "youtube_url:" field.

7. "timestamp_secs": Integer seconds into episode where this insight appears.
   Estimate from the transcript context. Use 0 if unknown.

If no strong, actionable PM insight exists, return an empty array: []

Return ONLY a raw JSON array with ONE object (no markdown, no backticks):
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

  // Strip any accidental markdown fences the model might add
  const cleaned = responseText
    .replace(/^\s*```json\s*/i, '')
    .replace(/```\s*$/,         '')
    .trim();

  let moments;
  try {
    moments = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message} | raw: ${cleaned.slice(0, 300)}`);
  }

  if (!Array.isArray(moments) || moments.length === 0) return null;

  const m = moments[0];

  // Hard-reject if topic is not in the allowed list — would violate DB constraint
  if (!ALLOWED_TOPICS.includes(m.topic)) {
    throw new Error(`Rejected: invalid topic "${m.topic}"`);
  }

  // Normalise timestamp to integer
  m.timestamp_secs = parseInt(m.timestamp_secs, 10) || 0;

  // Warn (but don't reject) if pull_quote is too long — human can review later
  if (m.pull_quote && m.pull_quote.length > 250) {
    console.warn(`[curate]   ⚠ pull_quote ${m.pull_quote.length} chars (>250) for ${dir} — included with warning`);
  }

  return m;
}

async function main() {
  if (!process.env.GOOGLE_AI_API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY');

  const allDirs = (await fs.readdir(EPISODES_DIR))
    .filter(d => !d.startsWith('.') && !d.includes('.'))
    .sort();

  // Resume support — load previously processed dirs and saved moments
  let processed = new Set();
  let allMoments = [];
  try {
    const prog = JSON.parse(await fs.readFile(PROGRESS_PATH, 'utf8'));
    processed = new Set(prog.processed || []);
    console.log(`[curate] Resuming — ${processed.size} episodes already done`);
  } catch { /* fresh start */ }
  try {
    const existing = JSON.parse(await fs.readFile(OUTPUT_PATH, 'utf8'));
    if (Array.isArray(existing) && existing.length > 0) {
      allMoments = existing;
      console.log(`[curate] Loaded ${allMoments.length} existing moments from output file`);
    }
  } catch { /* fresh start */ }

  const remaining = allDirs.filter(d => !processed.has(d));
  console.log(`[curate] ${DRY_RUN ? 'DRY RUN — ' : ''}${remaining.length} episodes remaining (${allDirs.length} total)...`);

  let found = 0, noInsight = 0, failed = 0;

  for (let i = 0; i < remaining.length; i++) {
    const dir = remaining[i];
    const n   = `${processed.size + i + 1}/${allDirs.length}`;

    try {
      const moment = await processEpisode(dir);
      if (moment) {
        allMoments.push(moment);
        found++;
        console.log(`[curate] ✓ ${n} ${dir} — ${moment.guest_name} | ${moment.topic}`);
      } else {
        noInsight++;
        if (!DRY_RUN) console.log(`[curate] − ${n} ${dir} — no strong PM insight`);
      }
      // Mark as processed only on success or "no insight" (not on error)
      processed.add(dir);
    } catch (err) {
      failed++;
      console.error(`[curate] ✗ ${n} ${dir}: ${err.message}`);
      // Do NOT add to processed — allows retry on next run
    }

    // Periodic save every 25 episodes
    if (!DRY_RUN && (i + 1) % 25 === 0) {
      await fs.writeFile(OUTPUT_PATH, JSON.stringify(allMoments, null, 2));
      await fs.writeFile(PROGRESS_PATH, JSON.stringify({ processed: [...processed] }, null, 2));
      console.log(`[curate] 💾 Progress save — ${allMoments.length} moments, ${processed.size} episodes done`);
    }

    if (!DRY_RUN && i < remaining.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(allMoments, null, 2));
  await fs.writeFile(PROGRESS_PATH, JSON.stringify({ processed: [...processed] }, null, 2));
  console.log(`\n[curate] Done.`);
  console.log(`[curate] ✓ Found:      ${found}`);
  console.log(`[curate] − No insight:  ${noInsight}`);
  console.log(`[curate] ✗ Failed:      ${failed}`);
  console.log(`[curate] Total moments: ${allMoments.length}`);
  console.log(`[curate] Output:        ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('[curate] Fatal:', err.message);
  process.exit(1);
});
