// background/abstraction.js
// Groq abstraction layer — maps niche PM queries to fundamental PM concepts.
// Used as fallback when RAG returns no results above the similarity threshold.
//
// Why Groq (not Claude): llama3-8b-8192 on Groq runs in <200ms.
// Claude API adds 500–1500ms — unacceptable for an ambient tool.

import { GROQ_API_KEY } from './config.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a product management expert. Map business and product problems to fundamental PM concepts.

THE RULE: If the query contains ANY noun that could be a business domain, product, service, process, or metric — always abstract it into 2-3 PM concepts. Only output NOT_PM for pure social phrases, emotional expressions, entertainment requests, or gibberish that have zero business subject.

When in doubt → abstract. NOT_PM is the rare exception.

Output ONLY one of:
- The word NOT_PM — for pure social/emotional/entertainment with no business noun
- 2-3 PM terms, comma-separated — for anything with a business/product/service subject

No explanation. No sentences. No bullet points. Do NOT repeat the input query. Do NOT use arrow notation. Output the PM terms only.

NOT_PM examples (pure expression, no business subject):
- "it's time to disco" → NOT_PM
- "how do I get to England?" → NOT_PM
- "I'm hungry" → NOT_PM
- "tell me a joke" → NOT_PM
- "sing me a song" → NOT_PM

ABSTRACT examples (has a business/product/service noun — even if niche):
- "insurance claim" → "conversion funnel, friction reduction, activation"
- "how do I track insurance claims?" → "metrics, funnel tracking, operational KPIs"
- "B2B SaaS pricing tiers vs D2C" → "pricing strategy, value metric, packaging"
- "driver onboarding in a marketplace" → "two-sided marketplace, supply activation, onboarding"
- "hospital EHR adoption by nurses" → "enterprise onboarding, change management, user adoption"
- "gamification for loyalty program" → "retention loops, engagement mechanics, habit formation"
- "court case management software" → "enterprise workflow, user adoption, stakeholder management"
- "pizza delivery drop-off" → "last-mile ops, customer experience, retention"`;

/**
 * Abstract a niche PM query into fundamental PM concepts Lenny would know.
 * Called only when RAG fast path returns no results above threshold.
 *
 * @param {string} transcript   - What the user said (speech query)
 * @param {string} selection    - Text they highlighted (may be empty)
 * @param {string} pageContext  - Text from the page they're working on (may be empty)
 * @returns {Promise<string>}   - 2-3 PM concept terms as a comma-separated string
 */
export async function abstractQuery(transcript, selection, pageContext) {
  const parts = [];
  if (transcript)   parts.push(`Query: ${transcript}`);
  if (selection)    parts.push(`Highlighted: ${selection}`);
  if (pageContext)  parts.push(`Page content: ${pageContext}`);

  if (parts.length === 0) {
    throw new Error('abstractQuery: no signals to abstract from');
  }

  const userContent = parts.join('\n');

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
      temperature: 0.2,  // low temp for consistent, focused output
      max_tokens: 60,    // 2-3 terms max — no need for more
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq abstraction failed: ${res.status} — ${errBody}`);
  }

  const data = await res.json();
  const abstracted = data.choices?.[0]?.message?.content?.trim();

  if (!abstracted) {
    throw new Error('Groq abstraction: empty response from model');
  }

  console.log('[LennyLive] Abstraction:', transcript.slice(0, 60), '→', abstracted);
  return abstracted;
}

/**
 * Generate 2-3 contextual PM questions for the write+pause sensor.
 * Called when the user pauses typing for 1.5s in a block containing a PM keyword.
 * Fast Groq call — no embedding, no Supabase.
 *
 * @param {string} keyword      - PM keyword detected in the active block
 * @param {string} blockContent - Text of the active block (first 300 chars)
 * @returns {Promise<string[]>} - Array of 2-3 question strings
 */
export async function generateQuestions(keyword, blockContent) {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0.5,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content: `You are helping a junior PM who is stuck while writing.
Generate exactly 3 short, specific questions they might want to ask about this topic.
Questions must be answerable with a concrete product management insight.
Output ONLY the 3 questions, one per line. No numbering. No preamble. No bullet points.`,
        },
        {
          role: 'user',
          content: `Topic: ${keyword}\nContext: ${blockContent.slice(0, 300)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq generateQuestions failed: ${res.status} — ${errBody}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';

  // Strip leading bullets/numbers — LLaMA occasionally ignores "no numbering" instruction
  return text
    .split('\n')
    .map(q => q.replace(/^[-•\d.)\s]+/, '').trim())
    .filter(q => q.length > 0)
    .slice(0, 3);
}
