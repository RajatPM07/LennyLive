import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

// Normalize whitespace before DB comparisons and inserts
function normalize(str) {
  return str.trim().replace(/\s+/g, ' ');
}

async function getEmbedding(text) {
  // gemini-embedding-001 replaced text-embedding-004; outputDimensionality truncates to 768 dims
  // to match the vector(768) column in transcript_chunks
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: 768,
  });
  return result.embedding.values; // float[] of length 768
}

async function rowExists(episodeTitle, insight) {
  const { data, error } = await supabase
    .from('transcript_chunks')
    .select('id')
    .eq('episode_title', normalize(episodeTitle))
    .eq('insight', normalize(insight))
    .limit(1);
  if (error) throw new Error(`Existence check failed: ${error.message}`);
  return data.length > 0;
}

async function main() {
  const REQUIRED_ENV = ['GOOGLE_AI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
  }

  const moments = JSON.parse(readFileSync(join(__dirname, '../data/curated_moments.json'), 'utf8'));
  console.log(`[LennyLive] ${DRY_RUN ? 'DRY RUN — ' : ''}Processing ${moments.length} moments...`);

  let embedded = 0, skipped = 0;

  for (let i = 0; i < moments.length; i++) {
    const m = moments[i];
    const label = `${i + 1}/${moments.length}: ${m.guest_name} — ${m.topic}`;

    if (await rowExists(m.episode_title, m.insight)) {
      console.log(`[LennyLive] Skipped (exists) ${label}`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[LennyLive] Would embed ${label}`);
      embedded++;
      continue;
    }

    // Embed topic + insight — anchors on PM concept AND guest's specific angle.
    // pull_quote is narrative prose (poor retrieval signal); topic+insight matches query style.
    const embedding = await getEmbedding(normalize(m.topic + ' ' + m.insight));

    const { error } = await supabase.from('transcript_chunks').insert({
      topic: normalize(m.topic),
      guest_name: normalize(m.guest_name),
      insight: normalize(m.insight),
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
