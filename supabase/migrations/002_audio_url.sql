-- supabase/migrations/002_audio_url.sql
-- Adds audio_url column for lazy-cached TTS audio.
-- Pre-generated MP3s are stored in Supabase Storage bucket 'tts-audio'.
-- NULL means not yet generated — service worker falls back to real-time TTS.

ALTER TABLE transcript_chunks
  ADD COLUMN IF NOT EXISTS audio_url text;

-- Must drop first — Postgres cannot change return type of an existing function.
DROP FUNCTION IF EXISTS match_transcript_chunks(vector, float, int);

-- Update match_transcript_chunks to return audio_url so the
-- service worker can serve cached audio without a second DB round-trip.
CREATE OR REPLACE FUNCTION match_transcript_chunks(
  query_embedding  vector(768),
  match_threshold  float   DEFAULT 0.5,
  match_count      int     DEFAULT 3
)
RETURNS TABLE (
  id              uuid,
  topic           text,
  guest_name      text,
  insight         text,
  pull_quote      text,
  episode_title   text,
  youtube_url     text,
  timestamp_secs  integer,
  audio_url       text,
  similarity      float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, topic, guest_name, insight, pull_quote,
    episode_title, youtube_url, timestamp_secs,
    audio_url,
    1 - (embedding <=> query_embedding) AS similarity
  FROM transcript_chunks
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
