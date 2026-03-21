// background/tts.js
// ElevenLabs TTS — returns base64-encoded MP3 string.
// Called fire-and-forget from service-worker.js after Push 1.
// Throws on non-2xx — caught by Promise.race .catch() in service-worker.

import { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } from './config.js';

export async function fetchTTS(text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
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
    const errBody = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} — ${errBody}`);
  }

  // Validate content-type — ElevenLabs should return audio/mpeg
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('audio')) {
    const body = await res.text();
    throw new Error(`ElevenLabs TTS: expected audio, got ${contentType} — ${body.slice(0, 200)}`);
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error('ElevenLabs TTS: received empty audio buffer');
  }

  // Chunked binary → base64 conversion.
  // Char-by-char += on large Uint8Arrays is slow and fragile.
  // Spread over 8 KB chunks is fast and avoids call stack limits.
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

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
