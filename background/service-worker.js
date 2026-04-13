// background/service-worker.js
// MV3 service worker — push model RAG pipeline.
// Receives QUERY from content script, runs embed + search,
// then pushes RESPONSE back via chrome.tabs.sendMessage.
// "Push model" avoids the unreliable sendResponse-with-return-true pattern
// for async work in MV3 service workers.

import { embedQuery, searchChunks, searchChunksAt } from './rag.js';
import { fetchTTS, fetchAndEncodeUrl } from './tts.js';
import { abstractQuery, generateQuestions, classifyPage } from './abstraction.js';
import { synthesizeResponse } from './synthesis.js';

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

  if (message.type === 'GENERATE_QUESTIONS') {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    generateQuestions(message.keyword, message.blockContent)
      .then(result => {
        // result = { concept, questions } or { concept: null, questions: [] }
        // Empty questions = NOT_PM — send back with null so content script suppresses badge
        const isEmpty = !result.questions || result.questions.length === 0;
        chrome.tabs.sendMessage(tabId, {
          type: 'QUESTIONS_READY',
          keyword: result.concept || '',    // concept from Groq drives badge label
          questions: isEmpty ? null : result.questions,
          notPm: isEmpty,
        });
      })
      .catch(err => {
        console.warn('[LennyLive] generateQuestions failed:', err.message);
        chrome.tabs.sendMessage(tabId, {
          type: 'QUESTIONS_READY',
          keyword: message.keyword,
          questions: null,
          error: true,
        });
      });
    return;
  }

  if (message.type === 'CLASSIFY_PAGE') {
    const tabId = sender.tab?.id;
    if (!tabId) return;
    classifyPage(message.pageContent)
      .then(isPM => {
        chrome.tabs.sendMessage(tabId, { type: 'PAGE_CLASSIFIED', isPM });
        console.log('[LennyLive] Page classified for tab', tabId, '— PM:', isPM);
      })
      .catch(err => {
        console.warn('[LennyLive] Page classification failed:', err.message);
        // Fail silent: pageIsPMContext stays null, regex fallback works
      });
    return;
  }
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
  // Date / time questions
  /^what (is |'?s )?(the )?(day|date|time|year|month)\b/i,
  /^what (day|date|time) is (it|today)\b/i,
  /^(what|which) day (is (it|today)|of the week)\b/i,
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

// Selection-reference phrases: user is pointing at the highlighted text, not asking standalone.
// "tell me about the highlighted text" → after filler strip → "the highlighted text" → swap with selection.
// Without this, "the highlighted text" embeds literally and returns random results.
const SELECTION_REF_RE = /^(the highlighted text|the selected text|the selection|this|that|it|those|the text)$/i;

async function handleQuery(message, tabId) {
  const { transcript, selection, pageContext = '' } = message;

  // Selection dot path: empty transcript + selection present → use selection directly.
  // Must be the FIRST check — cleanQuery('') returns '' which would reach
  // embedQuery('') and fail with a Gemini API error.
  if (!transcript?.trim() && selection?.trim()) {
    console.log('[LennyLive] Selection dot query — using selection:', selection.trim());
    try {
      const embedding = await embedQuery(selection.trim());
      console.log('[LennyLive] Searching Supabase pgvector (threshold: 0.45, fast-path: 0.62)...');
      const chunks = await searchChunks(embedding);
      if (!chunks || chunks.length === 0) {
        pushResponse(tabId, { type: 'RESPONSE', status: 'no_results', insight: null });
        return;
      }
      const top = chunks[0];
      const insight = shapeInsight(top, false);
      const relatedInsights = chunks.slice(1, 3).map(c => shapeInsight(c, false));
      console.log('[LennyLive] Selection dot hit:', insight.guest_name, '| similarity:', top.similarity);
      pushResponse(tabId, { type: 'RESPONSE', status: 'ok', insight, relatedInsights });
      pushAudio(insight, tabId, selection.trim(), chunks);
    } catch (err) {
      console.error('[LennyLive] Selection dot RAG error:', err.message);
      pushResponse(tabId, { type: 'RESPONSE', status: 'network_error', insight: null });
    }
    return;
  }

  let cleanedTranscript = cleanQuery(transcript);

  // Reject obvious conversational queries before hitting any API.
  // "how are you?" must never reach the RAG pipeline or abstraction layer.
  if (isConversational(cleanedTranscript)) {
    console.log('[LennyLive] Conversational query rejected (chitchat):', cleanedTranscript);
    pushResponse(tabId, { type: 'RESPONSE', status: 'chitchat', insight: null });
    return;
  }

  // If the cleaned query is just a pointer to the selection ("the highlighted text",
  // "this", "that"), replace it with the actual selection text.
  // e.g. "tell me about the highlighted text" + selection "Gamification" → embed "Gamification"
  if (selection && SELECTION_REF_RE.test(cleanedTranscript)) {
    console.log('[LennyLive] Selection reference detected — using selection as query:', selection);
    cleanedTranscript = selection.trim();
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
  if (selection && selection.trim() !== cleanedTranscript) parts.push(`Context: ${selection}`);
  const queryText = parts.join('\n\n');

  if (cleanedTranscript !== transcript) {
    console.log('[LennyLive] Query cleaned:', transcript, '→', cleanedTranscript);
  }

  try {
    console.log('[LennyLive] Embedding query:', queryText.slice(0, 120));
    const embedding = await embedQuery(queryText);

    console.log('[LennyLive] Searching Supabase pgvector (threshold: 0.45, fast-path: 0.62)...');
    const chunks = await searchChunks(embedding);

    // Three-tier confidence band:
    //   > 0.62 → high confidence — ship it directly (fast path)
    //   0.45–0.62 → low confidence — refine with Groq + pageContext before shipping
    //   < 0.45 → no match — abstraction fallback (searchChunks already filtered these out)
    //
    // Threshold raised from 0.55 → 0.62 to catch phonetic speech recognition errors
    // (e.g. "attention" heard instead of "retention" scores ~0.608 — now goes through
    // Groq abstraction which uses pageContext + selection to recover the correct topic).
    // Genuine strong hits still clear 0.62 (e.g. "retention" → 0.713).
    if (chunks && Array.isArray(chunks) && chunks.length > 0) {
      const top = chunks[0];
      if (top.similarity > 0.62) {
        const insight = shapeInsight(top, false);
        const relatedInsights = chunks.slice(1, 3).map(c => shapeInsight(c, false));
        console.log('[LennyLive] High confidence hit:', insight.guest_name, '| similarity:', top.similarity);
        pushResponse(tabId, { type: 'RESPONSE', status: 'ok', insight, relatedInsights });
        pushAudio(insight, tabId, cleanedTranscript, chunks);
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
    const relatedInsights = abstractedChunks.slice(1, 3).map(c => shapeInsight(c, false));
    console.log('[LennyLive] Abstraction path hit:', insight.guest_name, '| similarity:', insight.similarity);
    pushResponse(tabId, { type: 'RESPONSE', status: 'ok', insight, relatedInsights });
    pushAudio(insight, tabId, cleanedTranscript, abstractedChunks);

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

// Build the spoken text from the pull_quote — the same text shown on the postcard.
// This eliminates the audio/postcard mismatch: what the user reads = what they hear.
//
// Framing prefix differs by source:
//   Podcast:    "[Guest] on [topic]: [pull_quote]"
//   Newsletter: "From my newsletter on [topic]: [pull_quote]"
function buildSpokenText(insight) {
  const isNewsletter = insight.guest_name === 'Lenny Rachitsky';
  const framing = isNewsletter
    ? `From my newsletter on ${insight.topic}:`
    : `${insight.guest_name} on ${insight.topic}:`;
  return `${framing} ${insight.pull_quote}`;
}

// Push 2 — fire-and-forget audio (never blocks Push 1 / postcard).
// Uses Groq synthesis when top-3 chunks available (tailored to query),
// falls back to buildSpokenText (pull_quote) if synthesis fails.
function pushAudio(insight, tabId, query = '', allChunks = []) {
  const synthesisAvailable = query && allChunks.length > 0;

  const getSpokenText = synthesisAvailable
    ? synthesizeResponse(query, allChunks).catch(err => {
        console.warn('[LennyLive] Synthesis failed, falling back:', err.message);
        return buildSpokenText(insight);
      })
    : Promise.resolve(buildSpokenText(insight));

  getSpokenText.then(spokenText => {
    console.log('[LennyLive] Spoken text:', spokenText.slice(0, 120));

    let ttsTimeoutId;
    const ttsTimeout = new Promise((_, reject) => {
      ttsTimeoutId = setTimeout(() => reject(new Error('TTS timeout (8s)')), 8000);
    });

    Promise.race([fetchTTS(spokenText), ttsTimeout])
      .then(audio => {
        console.log('[LennyLive] Audio ready:', insight.guest_name);
        pushResponse(tabId, { type: 'AUDIO', audio });
      })
      .catch(err => {
        console.warn('[LennyLive] Audio skipped:', err.message);
        pushResponse(tabId, { type: 'RESPONSE', status: 'network_error', insight: null });
      })
      .finally(() => clearTimeout(ttsTimeoutId));
  });
}

function pushResponse(tabId, response) {
  // Use Promise API — no callback means Chrome doesn't expect sendResponse from
  // the content script, avoiding the misleading "port closed" lastError noise.
  chrome.tabs.sendMessage(tabId, response).catch((err) => {
    // Only fires if the tab was closed before the message arrived.
    console.warn('[LennyLive] pushResponse failed:', err.message);
  });
}
