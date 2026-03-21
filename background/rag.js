// background/rag.js
// RAG pipeline: embed query via Google AI, search Supabase pgvector.
// Imported by service-worker.js. Uses ES module syntax.

import { GOOGLE_AI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

/**
 * Embed a text query using Google AI gemini-embedding-001.
 * Returns float[] (768 dimensions).
 * Throws on non-2xx HTTP response.
 */
export async function embedQuery(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GOOGLE_AI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google AI embedContent failed: ${res.status}`);
  }
  const data = await res.json();
  return data.embedding.values; // float[] (768 elements)
}

/**
 * Search Supabase pgvector for the top 3 transcript chunks
 * most similar to the given embedding.
 * Returns array of chunk objects (may be empty if no results above threshold).
 * Throws on non-2xx HTTP response.
 */
export async function searchChunks(embedding) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/match_transcript_chunks`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 3,
    }),
  });
  if (!res.ok) {
    throw new Error(`Supabase match_transcript_chunks failed: ${res.status}`);
  }
  return res.json(); // array of chunk objects, may be empty
}
