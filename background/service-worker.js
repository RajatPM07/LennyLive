// background/service-worker.js
// MV3 service worker — push model RAG pipeline.
// Receives QUERY from content script, runs embed + search,
// then pushes RESPONSE back via chrome.tabs.sendMessage.
// "Push model" avoids the unreliable sendResponse-with-return-true pattern
// for async work in MV3 service workers.

import { embedQuery, searchChunks } from './rag.js';
import { fetchTTS, fetchAndEncodeUrl } from './tts.js';

chrome.runtime.onMessage.addListener((message, sender) => {
  console.log('[LennyLive] Message received:', message.type, message);

  if (message.type === 'QUERY') {
    // Validate sender — must come from a tab (not popup/devtools)
    if (!sender.tab?.id) {
      console.warn('[LennyLive] QUERY received from non-tab context — ignoring');
      return; // no return true — not keeping port open
    }

    const tabId = sender.tab.id;

    // Run RAG pipeline async — service worker stays alive during awaited fetch calls
    handleQuery(message, tabId);

    // Do NOT return true — we are NOT using sendResponse.
    // The response goes back via chrome.tabs.sendMessage after async work.
  }

  // BUZZWORD_TRIGGERED handler removed — content-script does not send this message.
  // Dead code from sub-project 1 stub — intentionally absent here.
});

// Strip conversational filler from speech queries before embedding.
// "can you tell me about retention" → "retention"
// Filler dilutes the embedding vector and reduces similarity scores.
const FILLER_PREFIXES = [
  /^(can you |could you |please |)tell me (about|what you know about|regarding) /i,
  /^what do (we|you|i) know about /i,
  /^what (does|do) (lenny|you) (say|think|know) about /i,
  /^(what('s| is) (your|the) (take|view|opinion|insight) on) /i,
  /^(talk to me about|explain|describe|give me|show me) /i,
  /^(hey lenny[,.]? |lenny[,.]? )/i,
];
function cleanQuery(text) {
  let q = text.trim();
  for (const re of FILLER_PREFIXES) q = q.replace(re, '');
  return q.trim() || text.trim(); // fallback to original if we stripped everything
}

async function handleQuery(message, tabId) {
  const { transcript, selection } = message;
  const cleanedTranscript = cleanQuery(transcript);
  const queryText = selection ? `${cleanedTranscript}\n\nContext: ${selection}` : cleanedTranscript;
  if (cleanedTranscript !== transcript) {
    console.log('[LennyLive] Query cleaned:', transcript, '→', cleanedTranscript);
  }

  try {
    console.log('[LennyLive] Embedding query:', queryText.slice(0, 100));
    const embedding = await embedQuery(queryText);

    console.log('[LennyLive] Searching Supabase pgvector...');
    const chunks = await searchChunks(embedding);

    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      console.log('[LennyLive] No results above threshold for query:', transcript);
      pushResponse(tabId, { type: 'RESPONSE', status: 'no_results', insight: null });
      return;
    }

    // Shape the top result into the insight object
    const top = chunks[0];
    const insight = {
      guest_name:     top.guest_name,
      topic:          top.topic,
      insight:        top.insight,
      pull_quote:     top.pull_quote,
      episode_title:  top.episode_title,
      youtube_url:    top.youtube_url,
      timestamp_secs: top.timestamp_secs,
      similarity:     top.similarity,
      audio_url:      top.audio_url ?? null,  // null if not yet seeded
    };

    console.log('[LennyLive] Insight found:', insight.guest_name, '|', insight.topic, '| similarity:', insight.similarity);
    pushResponse(tabId, { type: 'RESPONSE', status: 'ok', insight });

    // Push 2 — fire-and-forget audio (never blocks Push 1)
    // Prefer pre-cached URL from Supabase Storage (instant CDN fetch).
    // If CDN fetch fails, falls back to real-time TTS so audio is never silently lost.
    // Falls back to real-time TTS also when audio_url is null (unseeded moments).
    const ttsTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TTS timeout (8s)')), 8000)
    );
    const audioPromise = insight.audio_url
      ? fetchAndEncodeUrl(insight.audio_url).catch(err => {
          console.warn('[LennyLive] Cached audio failed, falling back to TTS:', err.message);
          return Promise.race([fetchTTS(insight.insight), ttsTimeout]);
        })
      : Promise.race([fetchTTS(insight.insight), ttsTimeout]);

    audioPromise
      .then(audio => {
        console.log('[LennyLive] Audio ready:', insight.audio_url ? 'cached' : 'real-time', insight.guest_name);
        pushResponse(tabId, { type: 'AUDIO', audio });
      })
      .catch(err => console.warn('[LennyLive] Audio skipped:', err.message));

  } catch (err) {
    console.error('[LennyLive] RAG pipeline error:', err.message);
    pushResponse(tabId, { type: 'RESPONSE', status: 'error', insight: null });
  }
}

function pushResponse(tabId, response) {
  // Use Promise API — no callback means Chrome doesn't expect sendResponse from
  // the content script, avoiding the misleading "port closed" lastError noise.
  chrome.tabs.sendMessage(tabId, response).catch((err) => {
    // Only fires if the tab was closed before the message arrived.
    console.warn('[LennyLive] pushResponse failed:', err.message);
  });
}
