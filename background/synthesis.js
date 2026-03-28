// background/synthesis.js
// Groq synthesis layer — generates a tailored voice response from top-3 retrieved moments.
// Called instead of buildSpokenText() for the audio push (Push 2).
//
// Why this exists:
//   buildSpokenText() read the pull_quote verbatim — always the same text regardless of
//   what the user asked. synthesizeResponse() generates a fresh 3-4 sentence answer
//   that directly addresses the query angle, using specific names/numbers from the
//   retrieved moments. This is what makes the Lenny chatbot feel like a real mentor.

import { GROQ_API_KEY } from './config.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are Lenny Rachitsky — a warm, direct PM mentor with 10+ years building products at Airbnb and advising hundreds of startups.

A PM asked you a question. You have 3 relevant insights from your podcast and newsletter to draw from.

Your job: give a spoken voice response — 3 to 4 sentences — that directly answers their question.

RULES:
- Use specific names, companies, and numbers from the provided insights (e.g. "at Airbnb", "Duolingo saw a 20% lift", "Brian Balfour told me")
- Sound like you're talking to them — warm and direct, not academic
- Never start with "I" — lead with the most important point
- End with one sharp follow-up question specific to their situation
- No bullet points, no headers — flowing spoken sentences only
- Keep it to 3-4 sentences maximum — this is voice, not an essay
- Do NOT say "based on the insights provided" or reference the context format`;

/**
 * Synthesize a tailored voice response from the top retrieved moments.
 *
 * @param {string} query      - The user's original query (cleaned)
 * @param {Array}  moments    - Top-3 retrieved chunk objects from Supabase
 * @returns {Promise<string>} - 3-4 sentence spoken response
 */
export async function synthesizeResponse(query, moments) {
  // Format the retrieved moments as context for Groq
  const insightContext = moments.map((m, i) => {
    const source = m.guest_name === 'Lenny Rachitsky'
      ? `Newsletter on "${m.topic}"`
      : `${m.guest_name} (podcast, topic: ${m.topic})`;
    return `Insight ${i + 1} — ${source}:\n${m.insight}\n${m.pull_quote}`;
  }).join('\n\n');

  const userContent = `PM's question: "${query}"\n\nRelevant insights:\n${insightContext}`;

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userContent },
      ],
      temperature: 0.6,  // slightly creative — sounds natural, not robotic
      max_tokens: 180,   // ~3-4 spoken sentences
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq synthesis failed: ${res.status} — ${errBody}`);
  }

  const data = await res.json();
  const response = data.choices?.[0]?.message?.content?.trim();

  if (!response) {
    throw new Error('Groq synthesis: empty response from model');
  }

  console.log('[LennyLive] Synthesis:', response.slice(0, 100));
  return response;
}
