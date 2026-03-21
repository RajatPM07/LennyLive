-- supabase/migrations/003_drop_topic_check.sql
-- Drops the hard-coded CHECK constraint on transcript_chunks.topic.
-- Run this when you want to allow dynamic LLM-generated topic labels
-- beyond the original 10 values.
-- Safe to run multiple times (IF EXISTS handles re-runs).

ALTER TABLE transcript_chunks
  DROP CONSTRAINT IF EXISTS transcript_chunks_topic_check;
