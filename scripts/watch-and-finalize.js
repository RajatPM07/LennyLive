// scripts/watch-and-finalize.js
// Watches for curate.js to finish (by polling the progress file),
// then automatically runs finalize-corpus.js.
// Run: node scripts/watch-and-finalize.js
// Safe to run in parallel with curate.js.

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync, spawnSync } from 'child_process';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const ROOT        = join(__dirname, '..');
const PROGRESS    = join(ROOT, 'data', 'curate_progress.json');
const TOTAL_EPISODES = 303;
const POLL_MS     = 60_000; // check every 60 seconds

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getProgress() {
  try {
    const data = JSON.parse(await readFile(PROGRESS, 'utf8'));
    return (data.processed || []).length;
  } catch { return 0; }
}

async function main() {
  console.log('[watch] Watching for curate.js to complete...');
  console.log(`[watch] Will finalize when progress reaches ${TOTAL_EPISODES} episodes.`);

  while (true) {
    const done = await getProgress();
    console.log(`[watch] Progress: ${done}/${TOTAL_EPISODES} episodes processed`);

    if (done >= TOTAL_EPISODES) {
      console.log('[watch] ✓ curate.js complete! Running finalize-corpus.js...');
      try {
        execSync('node scripts/finalize-corpus.js', { stdio: 'inherit', cwd: ROOT });
        console.log('[watch] ✅ finalize-corpus.js completed successfully.');
      } catch (err) {
        console.error('[watch] finalize-corpus.js failed:', err.message);
        process.exit(1);
      }
      break;
    }

    await sleep(POLL_MS);
  }
}

main().catch(err => {
  console.error('[watch] Fatal:', err.message);
  process.exit(1);
});
