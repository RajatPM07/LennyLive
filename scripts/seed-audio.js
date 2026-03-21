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
