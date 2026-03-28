-- Migration 004: Rebuild IVFFlat index for V3 corpus
-- lists=10 was sized for ~280 rows; lists=40 handles 900-1500 rows correctly
-- (rule of thumb: lists ≈ sqrt(expected row count))

DROP INDEX IF EXISTS transcript_chunks_embedding_idx;

CREATE INDEX transcript_chunks_embedding_idx
  ON transcript_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 40);
