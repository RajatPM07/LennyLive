// scripts/finalize-corpus.js
// Merges podcast + newsletter corpora, wipes DB, and re-embeds everything.
// Sources:
//   data/curated_moments_v2.json       — podcast moments (curate-v2.js output)
//   data/curated_moments_newsletters.json — newsletter moments (curate-newsletters.js output)
// Output:
//   data/curated_moments.json          — merged canonical corpus (backup of previous saved first)
//
// Run: node scripts/finalize-corpus.js

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, copyFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '..', 'data');

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  // --- Step 1: Load and merge podcast + newsletter corpora ---
  console.log('[finalize] Step 1: Loading and merging corpora...');

  const podcastPath    = join(DATA_DIR, 'curated_moments_v2.json');
  const newsletterPath = join(DATA_DIR, 'curated_moments_newsletters.json');

  const podcastMoments = JSON.parse(await readFile(podcastPath, 'utf8'));
  if (!Array.isArray(podcastMoments) || podcastMoments.length === 0) {
    throw new Error('curated_moments_v2.json is empty — run curate-v2.js first');
  }
  console.log(`[finalize] ✓ Podcast moments: ${podcastMoments.length}`);

  let newsletterMoments = [];
  try {
    const raw = JSON.parse(await readFile(newsletterPath, 'utf8'));
    if (Array.isArray(raw) && raw.length > 0) {
      newsletterMoments = raw;
      console.log(`[finalize] ✓ Newsletter moments: ${newsletterMoments.length}`);
    } else {
      console.warn('[finalize] ⚠ curated_moments_newsletters.json is empty — proceeding with podcasts only');
    }
  } catch {
    console.warn('[finalize] ⚠ curated_moments_newsletters.json not found — proceeding with podcasts only');
  }

  const moments = [...podcastMoments, ...newsletterMoments];
  console.log(`[finalize] ✓ Total merged: ${moments.length} moments`);

  // Warn about any pull_quotes over 350 chars
  const longQuotes = moments.filter(m => m.pull_quote?.length > 350);
  if (longQuotes.length > 0) {
    console.warn(`[finalize] ⚠ ${longQuotes.length} pull_quotes exceed 350 chars — included as-is`);
  }

  // --- Step 2: Backup and replace curated_moments.json ---
  console.log('[finalize] Step 2: Backing up and replacing curated_moments.json...');
  const mainPath   = join(DATA_DIR, 'curated_moments.json');
  const backupPath = join(DATA_DIR, 'curated_moments.backup.json');
  await copyFile(mainPath, backupPath);
  await writeFile(mainPath, JSON.stringify(moments, null, 2));
  console.log(`[finalize] ✓ Backup saved to curated_moments.backup.json`);
  console.log(`[finalize] ✓ curated_moments.json updated with ${moments.length} moments`);

  // --- Step 3: Wipe transcript_chunks ---
  console.log('[finalize] Step 3: Wiping transcript_chunks...');
  // Supabase JS client doesn't support raw DDL, but we can delete all rows
  // by matching everything (neq on id from a stable uuid)
  const { error: delError, count } = await supabase
    .from('transcript_chunks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // matches all rows

  if (delError) throw new Error(`Delete failed: ${delError.message}`);
  console.log(`[finalize] ✓ Deleted all rows from transcript_chunks`);

  // Verify empty
  const { count: remaining } = await supabase
    .from('transcript_chunks')
    .select('*', { count: 'exact', head: true });
  console.log(`[finalize] ✓ Rows remaining: ${remaining ?? 'unknown'}`);

  // --- Step 4: Run embed.js ---
  console.log(`[finalize] Step 4: Embedding ${moments.length} moments into Supabase...`);
  execSync('node scripts/embed.js', { stdio: 'inherit', cwd: join(__dirname, '..') });

  console.log('\n[finalize] ✅ All done!');
  console.log(`[finalize] ${moments.length} moments embedded into transcript_chunks.`);
  console.log('[finalize] Reload the extension and test double-tap Ctrl.');
}

main().catch(err => {
  console.error('[finalize] Fatal:', err.message);
  process.exit(1);
});
