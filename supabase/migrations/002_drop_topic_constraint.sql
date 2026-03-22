-- 002_drop_topic_constraint.sql
-- Remove the hard 10-topic CHECK constraint on transcript_chunks.
-- topic is now a free-form display label only — used for the postcard UI pill.
-- RAG matching is purely semantic via embeddings, not constrained by topic buckets.

ALTER TABLE transcript_chunks
  DROP CONSTRAINT IF EXISTS transcript_chunks_topic_check;
