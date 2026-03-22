// scripts/finalize-corpus.js
// Run AFTER curate.js completes successfully.
// 1. Validates new_curated_moments.json
// 2. Backs up curated_moments.json → curated_moments.backup.json
// 3. Copies new_curated_moments.json → curated_moments.json
// 4. Wipes all rows from transcript_chunks via Supabase service role
// 5. Runs embed.js to re-embed the full new corpus
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
  // --- Step 1: Validate new_curated_moments.json ---
  console.log('[finalize] Step 1: Validating new_curated_moments.json...');
  const newPath = join(DATA_DIR, 'new_curated_moments.json');
  const moments = JSON.parse(await readFile(newPath, 'utf8'));
  if (!Array.isArray(moments) || moments.length === 0) {
    throw new Error('new_curated_moments.json is empty or invalid — run curate.js first');
  }
  console.log(`[finalize] ✓ ${moments.length} moments found`);

  // Warn about any pull_quotes over 250 chars
  const longQuotes = moments.filter(m => m.pull_quote?.length > 250);
  if (longQuotes.length > 0) {
    console.warn(`[finalize] ⚠ ${longQuotes.length} pull_quotes exceed 250 chars — included as-is`);
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
