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
  // Convert binary MP3 stream → base64 string for Chrome message bus transport
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
