// scripts/curate-newsletters.js
// Extracts 3-5 high-quality PM insights per newsletter from Lenny's Newsletter archive.
// Uses Gemini 2.5 Flash. Newsletters are Lenny's own polished writing, not podcast transcripts.
// Outputs to data/curated_moments_newsletters.json.
// Run:      node scripts/curate-newsletters.js
// Dry run:  node scripts/curate-newsletters.js --dry-run

import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const DRY_RUN          = process.argv.includes('--dry-run');
const NEWSLETTERS_DIR  = process.env.NEWSLETTERS_DIR || '/Users/rajat/Downloads/lennys-newsletterpodcastdata-all/02-newsletters';
const OUTPUT_PATH      = path.join(process.cwd(), 'data', 'curated_moments_newsletters.json');
const PROGRESS_PATH    = path.join(process.cwd(), 'data', 'curate_newsletters_progress.json');

// Newsletters are prose articles — 100K chars is plenty (most are 2-5K words)
const CONTENT_MAX_CHARS = 100_000;

// 1s between requests — conservative for paid tier
const DELAY_MS = 1_000;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForQuotaReset() {
  console.warn('[curate-newsletters] Daily quota exhausted — polling every 15 min until it resets...');
  while (true) {
    await sleep(15 * 60 * 1000);
    try {
      await model.generateContent('ping');
      console.log('[curate-newsletters] Quota reset detected — resuming...');
      return;
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('429')) {
        console.log('[curate-newsletters] Quota still exhausted — waiting 15 more min...');
      } else {
        console.warn('[curate-newsletters] Unexpected error during quota poll:', msg.slice(0, 80));
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
      const isSpendingCap = msg.includes('429') && msg.includes('spending cap');
      const isPerMinuteLimit = msg.includes('429') && msg.includes('PerMinute');
      if (isDailyLimit || isSpendingCap) {
        await waitForQuotaReset();
        attempt = 0;
        continue;
      }
      if (isPerMinuteLimit && attempt < maxRetries) {
        const backoff = 20_000 * attempt;
        console.warn(`[curate-newsletters] Per-minute rate limit — waiting ${backoff / 1000}s (attempt ${attempt}/${maxRetries})...`);
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

// Derive newsletter URL from filename slug
// e.g. "14-habits-of-highly-effective-product-managers.md" →
//      "https://www.lennysnewsletter.com/p/14-habits-of-highly-effective-product-managers"
function slugToUrl(filename) {
  const slug = filename.replace(/\.md$/, '');
  return `https://www.lennysnewsletter.com/p/${slug}`;
}

async function processNewsletter(filename) {
  const filePath = path.join(NEWSLETTERS_DIR, filename);
  const raw = await fs.readFile(filePath, 'utf8');
  const { meta, body } = parseFrontmatter(raw);

  const title = meta.title || filename.replace('.md', '');
  const newsletterUrl = slugToUrl(filename);

  const content = body.length > CONTENT_MAX_CHARS
    ? body.slice(0, CONTENT_MAX_CHARS) + '\n[CONTENT TRUNCATED]'
    : body;

  const prompt = `You are curating Lenny Rachitsky's newsletter archive for an AI mentor tool used by early-stage PMs.

Lenny's newsletter is his own polished writing — frameworks, data analysis, and hard-won advice. This is NOT a podcast transcript.

Your job: find the 3 to 5 BEST, most DISTINCT PM insights from this newsletter issue.

=== FIRST: DECIDE IF THIS NEWSLETTER IS PM-RELEVANT ===

Some newsletters are NOT PM content. If this newsletter is primarily about any of the following, return an empty array []:
- Gift guides or product recommendations
- Personal milestones (subscriber counts, anniversaries)
- Subscriber perks or promotions
- Non-PM lifestyle content (health, parenting)
- Pure news roundups with no actionable PM insight

=== OUTPUT RULES (violating any = rejected) ===

1. "topic": A free-form label, 2-4 words, describing the PM concept.
   Examples: "retention hooks", "pricing strategy", "hiring bar", "growth loops", "founder mode", "metric selection", "stakeholder buy-in", "product sense"
   Do NOT use generic labels like "Product Management" or "Business Strategy".

2. "insight": ONE punchy sentence, ≤ 150 characters.
   Write this in Lenny's analytical voice — direct, opinionated, specific.
   Lead with what's SURPRISING or COUNTERINTUITIVE — the thing that makes a PM stop and think.
   No jargon hype. No "leveraging" or "optimizing". Write like a smart friend giving advice.
   BAD: "Effective PMs consistently demonstrate a set of key habits that drive product success."
   GOOD: "The best PMs I've studied obsess over the problem, not the solution — and they say no to 90% of requests."

3. "pull_quote": The postcard text that hooks the reader. 2-3 sentences, MAXIMUM 350 characters.
   Start with the most SURPRISING claim, specific data point, or counterintuitive finding from the newsletter.
   NO setup framing. NO "According to Lenny…". NO "The key insight is…".
   Write it like you're telling a friend something wild you read. Make someone stop scrolling.

4. "guest_name": "Lenny Rachitsky"

5. "episode_title": "${title}"

6. "youtube_url": "${newsletterUrl}"

7. "timestamp_secs": 0

=== QUALITY BAR ===
- Would a senior PM share this insight in a Slack channel? If not, cut it.
- Is it specific enough to be actionable? Vague wisdom = cut it.
- Does the pull_quote make someone want to read more? If not, sharpen it.

If fewer than 3 insights meet this bar, return only what's genuinely good.
If this newsletter has no strong PM insight (gift guide, promo, personal post), return [].

Return ONLY a raw JSON array (no markdown, no backticks, no commentary):
[{
  "topic": "...",
  "guest_name": "Lenny Rachitsky",
  "episode_title": "...",
  "insight": "...",
  "pull_quote": "...",
  "youtube_url": "...",
  "timestamp_secs": 0
}]

Newsletter content:
${content}`;

  const responseText = await generateWithRetry(prompt);

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

  const valid = [];
  for (const m of moments) {
    if (!m.topic || !m.insight || !m.pull_quote) continue;

    // Normalise fixed fields
    m.guest_name    = 'Lenny Rachitsky';
    m.episode_title = title;
    m.youtube_url   = newsletterUrl;
    m.timestamp_secs = 0;

    if (m.pull_quote.length > 350) {
      console.warn(`[curate-newsletters]   ⚠ pull_quote ${m.pull_quote.length} chars (>350) — included with warning`);
    }

    valid.push(m);
  }

  return valid;
}

async function main() {
  if (!process.env.GOOGLE_AI_API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY');

  const allFiles = (await fs.readdir(NEWSLETTERS_DIR))
    .filter(f => f.endsWith('.md'))
    .sort();

  // Resume support
  let processed = new Set();
  let allMoments = [];
  try {
    const prog = JSON.parse(await fs.readFile(PROGRESS_PATH, 'utf8'));
    processed = new Set(prog.processed || []);
    console.log(`[curate-newsletters] Resuming — ${processed.size} newsletters already done`);
  } catch { /* fresh start */ }
  try {
    const existing = JSON.parse(await fs.readFile(OUTPUT_PATH, 'utf8'));
    if (Array.isArray(existing) && existing.length > 0) {
      allMoments = existing;
      console.log(`[curate-newsletters] Loaded ${allMoments.length} existing moments from output file`);
    }
  } catch { /* fresh start */ }

  const remaining = allFiles.filter(f => !processed.has(f));
  console.log(`[curate-newsletters] ${DRY_RUN ? 'DRY RUN — ' : ''}${remaining.length} newsletters remaining (${allFiles.length} total)...`);

  let totalInsights = 0, skipped = 0, failed = 0;

  for (let i = 0; i < remaining.length; i++) {
    const file = remaining[i];
    const n = `${processed.size + i + 1}/${allFiles.length}`;

    if (DRY_RUN) {
      console.log(`[curate-newsletters] DRY RUN ${n} ${file}`);
      processed.add(file);
      continue;
    }

    try {
      const moments = await processNewsletter(file);
      if (moments.length > 0) {
        allMoments.push(...moments);
        totalInsights += moments.length;
        console.log(`[curate-newsletters] ✓ ${n} ${file} — ${moments.length} insights`);
      } else {
        skipped++;
        console.log(`[curate-newsletters] − ${n} ${file} — skipped (non-PM content)`);
      }
      processed.add(file);
    } catch (err) {
      failed++;
      console.error(`[curate-newsletters] ✗ ${n} ${file}: ${err.message}`);
      // Do NOT add to processed — allows retry on next run
    }

    // Periodic save every 10 newsletters
    if ((i + 1) % 10 === 0) {
      await fs.writeFile(OUTPUT_PATH, JSON.stringify(allMoments, null, 2));
      await fs.writeFile(PROGRESS_PATH, JSON.stringify({ processed: [...processed] }, null, 2));
      console.log(`[curate-newsletters] 💾 Progress save — ${allMoments.length} moments, ${processed.size} newsletters done`);
    }

    if (i < remaining.length - 1) await sleep(DELAY_MS);
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(allMoments, null, 2));
  await fs.writeFile(PROGRESS_PATH, JSON.stringify({ processed: [...processed], complete: true }, null, 2));

  console.log(`\n[curate-newsletters] Done.`);
  console.log(`[curate-newsletters] ✓ Insights extracted: ${totalInsights}`);
  console.log(`[curate-newsletters] − Skipped (non-PM):   ${skipped}`);
  console.log(`[curate-newsletters] ✗ Failed:             ${failed}`);
  console.log(`[curate-newsletters] Total moments:        ${allMoments.length}`);
  console.log(`[curate-newsletters] Output:               ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('[curate-newsletters] Fatal:', err.message);
  process.exit(1);
});
