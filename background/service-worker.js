// background/service-worker.js
// MV3 service worker — push model RAG pipeline.
// Receives QUERY from content script, runs embed + search,
// then pushes RESPONSE back via chrome.tabs.sendMessage.
// "Push model" avoids the unreliable sendResponse-with-return-true pattern
// for async work in MV3 service workers.

import { embedQuery, searchChunks, searchChunksAt } from './rag.js';
import { fetchTTS, fetchAndEncodeUrl } from './tts.js';
import { abstractQuery } from './abstraction.js';

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

// Conversational queries with no PM intent — reject immediately before any API call.
// Catches greetings, small talk, identity questions, and other non-PM phrases.
// This prevents the abstraction layer from mapping "how are you" → "stakeholder management".
const CONVERSATIONAL_PATTERNS = [
  // Greetings
  /^(hi|hey|hello|howdy|yo)\b/i,
  /^how are you/i,
  /^what('s| is) up/i,
  /^who are you/i,
  /^what (is|are) you/i,
  /^(good |)(morning|afternoon|evening)\b/i,
  // Affirmations / closings
  /^thank(s| you)/i,
  /^(ok|okay|cool|got it|nice|great|awesome|sounds good)\b/i,
  /^(yes|no|maybe|sure|absolutely|definitely)\b$/i,
  /^(bye|goodbye|see you|later)\b/i,
  // Action / hype phrases with no PM question
  /^let'?s (go|do (this|it)|start|begin|roll|rock)\b/i,
  /^(go|come on|alright|right|ready|here we go)\b/i,
  /^(wow|whoa|oh|ah|uh|um|hmm)\b$/i,
  /^(testing|test|one two|check)\b/i,
  // Meta questions about the extension itself
  /^(what can you do|help me|how do(es)? (this|it) work)/i,
];

function isConversational(text) {
  const q = text.trim().toLowerCase();
  return CONVERSATIONAL_PATTERNS.some(re => re.test(q));
}

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
  const { transcript, selection, pageContext = '' } = message;
  const cleanedTranscript = cleanQuery(transcript);

  // Reject obvious conversational queries before hitting any API.
  // "how are you?" must never reach the RAG pipeline or abstraction layer.
  if (isConversational(cleanedTranscript)) {
    console.log('[LennyLive] Conversational query rejected (chitchat):', cleanedTranscript);
    pushResponse(tabId, { type: 'RESPONSE', status: 'chitchat', insight: null });
    return;
  }

  // Fast-path embedding uses transcript + selection only — NOT pageContext.
  // pageContext is reserved for the Groq abstraction fallback.
  //
  // Why: a 1-word transcript like "activation" + 500 chars of PRD content
  // means pageContext dominates the embedding vector, dragging "activation"
  // toward "0-to-1 Building" instead of "Retention". The transcript is the
  // user's explicit intent — it must be the primary signal.
  // pageContext's job is to help Groq understand niche domains, not to
  // override clear PM keyword queries.
  const parts = [cleanedTranscript];
  if (selection) parts.push(`Context: ${selection}`);
  const queryText = parts.join('\n\n');

  if (cleanedTranscript !== transcript) {
    console.log('[LennyLive] Query cleaned:', transcript, '→', cleanedTranscript);
  }

  try {
    console.log('[LennyLive] Embedding query:', queryText.slice(0, 120));
    const embedding = await embedQuery(queryText);

    console.log('[LennyLive] Searching Supabase pgvector (threshold: 0.45)...');
    const chunks = await searchChunks(embedding);

    // Three-tier confidence band:
    //   > 0.55 → high confidence — ship it directly (fast path)
    //   0.45–0.55 → low confidence — refine with Groq + pageContext before shipping
    //   < 0.45 → no match — abstraction fallback (searchChunks already filtered these out)
    //
    // Why not raise the threshold to 0.75? gemini-embedding-001 peaks at ~0.62
    // for related content — 0.75 would return zero results for everything.
    if (chunks && Array.isArray(chunks) && chunks.length > 0) {
      const top = chunks[0];
      if (top.similarity > 0.55) {
        const insight = shapeInsight(top, false);
        console.log('[LennyLive] High confidence hit:', insight.guest_name, '| similarity:', top.similarity);
        pushResponse(tabId, { type: 'RESPONSE', status: 'ok', insight });
        pushAudio(insight, tabId);
        return;
      }
      console.log('[LennyLive] Low confidence match (', top.similarity.toFixed(3), ') — refining with Groq + pageContext');
    }

    // Abstraction fallback: no match OR low-confidence match — refine via Groq
    console.log('[LennyLive] No direct match — triggering Groq abstraction fallback');
    let abstractedQuery;
    try {
      abstractedQuery = await abstractQuery(cleanedTranscript, selection, pageContext);
    } catch (abstractErr) {
      console.warn('[LennyLive] Abstraction failed:', abstractErr.message);
      pushResponse(tabId, { type: 'RESPONSE', status: 'network_error', insight: null });
      return;
    }

    // Groq determined no business/product subject — warm rejection
    if (abstractedQuery.trim() === 'NOT_PM') {
      console.log('[LennyLive] Groq: no business subject — returning chitchat');
      pushResponse(tabId, { type: 'RESPONSE', status: 'chitchat', insight: null });
      return;
    }

    console.log('[LennyLive] Re-embedding abstracted query:', abstractedQuery);
    const abstractedEmbedding = await embedQuery(abstractedQuery);

    console.log('[LennyLive] Re-searching Supabase (threshold: 0.35)...');
    const abstractedChunks = await searchChunksAt(abstractedEmbedding, 0.35);

    if (!abstractedChunks || !Array.isArray(abstractedChunks) || abstractedChunks.length === 0) {
      console.log('[LennyLive] No results after abstraction for query:', transcript);
      pushResponse(tabId, { type: 'RESPONSE', status: 'no_results', insight: null });
      return;
    }

    const top = abstractedChunks[0];
    const insight = shapeInsight(top, true); // abstracted: true → honest mentor framing
    console.log('[LennyLive] Abstraction path hit:', insight.guest_name, '| similarity:', insight.similarity);
    pushResponse(tabId, { type: 'RESPONSE', status: 'ok', insight });
    pushAudio(insight, tabId);

  } catch (err) {
    console.error('[LennyLive] RAG pipeline error:', err.message);
    pushResponse(tabId, { type: 'RESPONSE', status: 'network_error', insight: null });
  }
}

// Shape a raw DB chunk into the insight object sent to the content script.
// abstracted: true means the result came via Groq abstraction fallback — niche domain.
function shapeInsight(chunk, abstracted) {
  return {
    guest_name:     chunk.guest_name,
    topic:          chunk.topic,
    insight:        chunk.insight,
    pull_quote:     chunk.pull_quote,
    episode_title:  chunk.episode_title,
    youtube_url:    chunk.youtube_url,
    timestamp_secs: chunk.timestamp_secs,
    similarity:     chunk.similarity,
    audio_url:      chunk.audio_url ?? null,
    abstracted,  // true = honest mentor framing in UI (postcard can use this in future)
  };
}

// Build the spoken text following the Lenny Formula cadence.
// Three sentences: Hook + Source → Core Insight → Push Question.
// This replaces speaking the raw `insight` field (one bare sentence with no context).
//
// NOTE: audio_url cache was seeded with the raw insight text — it won't match
// this formatted output. Always use real-time TTS so the formula plays correctly.
// Re-seed the audio cache with formatted text as a future task.
function buildSpokenText(insight) {
  const hook = `When I spoke to ${insight.guest_name} about ${insight.topic},`;
  const core = `their main point was that ${insight.insight}`;
  const push = `How are you thinking about this in your current work?`;
  return `${hook} ${core} ${push}`;
}

// Push 2 — fire-and-forget audio (never blocks Push 1 / postcard).
// Always uses real-time TTS with the Lenny Formula spoken text.
// (audio_url cache is stale for this format — skipped until re-seeded.)
function pushAudio(insight, tabId) {
  const spokenText = buildSpokenText(insight);
  console.log('[LennyLive] Spoken text:', spokenText.slice(0, 120));

  let ttsTimeoutId;
  const ttsTimeout = new Promise((_, reject) => {
    ttsTimeoutId = setTimeout(() => reject(new Error('TTS timeout (8s)')), 8000);
  });

  Promise.race([fetchTTS(spokenText), ttsTimeout])
    .then(audio => {
      console.log('[LennyLive] Audio ready (real-time Lenny Formula):', insight.guest_name);
      pushResponse(tabId, { type: 'AUDIO', audio });
    })
    .catch(err => {
      console.warn('[LennyLive] Audio skipped:', err.message);
      pushResponse(tabId, { type: 'RESPONSE', status: 'network_error', insight: null });
    })
    .finally(() => clearTimeout(ttsTimeoutId));
}

function pushResponse(tabId, response) {
  // Use Promise API — no callback means Chrome doesn't expect sendResponse from
  // the content script, avoiding the misleading "port closed" lastError noise.
  chrome.tabs.sendMessage(tabId, response).catch((err) => {
    // Only fires if the tab was closed before the message arrived.
    console.warn('[LennyLive] pushResponse failed:', err.message);
  });
}
