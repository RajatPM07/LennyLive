# LennyLive

**Winner, Lenny Rachitsky April 2026 Build Challenge**

A Chrome extension that surfaces insights from 300 product leaders directly
into your active workspace. No tab-switching. No searching. The right mental
model, exactly when your brain is already inside the problem.

[Landing Page](https://landing-mu-nine-76.vercel.app/) |
[Demo](https://github.com/RajatPM07/LennyLive/tree/main/Demo%20session) |
[PRD](https://github.com/RajatPM07/LennyLive/blob/main/LENNY_LIVE_PRD.md)

---

## The Problem

Lenny Rachitsky's podcast and newsletter archive contains 300 episodes and
350 posts of distilled product thinking from the best operators in the world.
The problem is access. PMs encounter that knowledge when they browse Twitter
or search for it deliberately. They almost never encounter it at the moment
they are actually writing a PRD, drafting user stories, or scoping a GTM plan.

The insight that would have changed the decision arrives 48 hours after the
decision was made.

LennyLive closes that gap by pushing contextual guidance into the PM's active
window, without interrupting the workflow.

---

## What It Does

- **Ambient detection:** Watches your active input in Notion, Jira, Linear, and
  Google Docs. When you write 40 or more words and pause, the extension evaluates
  whether a PM concept is present and surfaces a relevant insight from the archive.
- **Voice query (Active Mode):** Double-tap Ctrl on any page to speak a question
  directly. The pipeline embeds your query, searches the transcript corpus via
  cosine similarity, and returns a sourced answer in under 2 seconds.
- **Text selection review:** Highlight any text and double-tap Ctrl. LennyLive
  reads the selection and returns a structured review: one strength, one
  improvement, one critical question.
- **Dual-channel response:** Audio (ElevenLabs voice clone of Lenny) and a
  visual Postcard showing the pull quote, guest credentials, and a timestamped
  link to the source episode.
- **Three-tier confidence system:** High-confidence matches go direct to the
  transcript. Low-confidence queries fall through to Groq for concept abstraction
  before a second search pass. Niche domains (e.g., insurance-specific terms)
  get mapped to underlying PM concepts so no query goes unanswered.

---

## Architecture

```
Double-tap Ctrl (Active) or Write+Pause Sensor (Passive)
        |
        v
  Dual-Gate Filter
  Gate 1: Local regex (blocks non-PM input, zero API cost)
  Gate 2: Groq llama-3.1-8b-instant classification (<200ms)
        |
        v
  Gemini embedding-001 (768-dim vector)
        |
        v
  Supabase pgvector cosine search
        |
    [similarity >= 0.55] --> Direct transcript match
    [0.45 to 0.54]       --> Groq abstraction fallback
    [< 0.45]             --> Concept re-embed + second search
        |
        v
  ElevenLabs TTS (audio channel)
  Visual Postcard (DOM injection via Shadow DOM)
```

---

## Product Decisions Worth Noting

- **Why Shadow DOM for the Postcard?** Injecting into arbitrary third-party
  pages (Notion, Jira, Linear) means style collisions are unavoidable without
  encapsulation. Shadow DOM was the only option that made the UI deterministic
  across all target surfaces. This added build complexity but eliminated an entire
  class of production bugs.
- **Why Groq for classification, not a local model?** Latency was the constraint.
  The extension has a 200ms budget for the classification gate before user
  perception of lag begins. Groq's llama-3.1-8b-instant inference fits inside
  that window. A local model would have required a separate native messaging host,
  adding setup friction for every installer.
- **Why a three-tier confidence band, not a single threshold?** A single threshold
  creates a binary outcome: answer or silence. The three-tier system means a PM
  asking about insurance claim settlement (a niche term with no direct transcript
  match) still gets a structured PM-level response, because Groq abstracts the
  domain to "dispute resolution and customer experience" before the second search.
  Coverage without hallucination.
- **Why pre-generate audio and cache it in ElevenLabs Storage?** TTS latency for
  real-time generation was 2 to 4 seconds, which broke the ambient feel of the
  product. Pre-generating audio for the top 200 insights and caching the URLs in
  Supabase brought response time to under 500ms for the most common queries.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Extension | Chrome Manifest V3, JavaScript |
| Embeddings | Google Gemini embedding-001 (768 dim) |
| Vector DB | Supabase pgvector |
| LLM Classification | Groq, llama-3.1-8b-instant |
| Voice | ElevenLabs TTS |
| Build tooling | Claude Code, Cursor |

---

## Repo Structure

```
LennyLive/
  background/         Service worker, RAG pipeline, Groq abstraction
  content/            Content script, DOM injection, keyboard sensors
  popup/              Extension popup UI
  data/               Transcript chunk seed data
  supabase/migrations Database schema, vector index, match function
  landing/            Landing page source
  LENNY_LIVE_PRD.md   Full product requirements document
  CLAUDE.md           AI coding context file
```

---

## Local Setup

1. Clone the repo.
2. Create `background/config.js` (excluded from Git) with your API keys:

```js
const CONFIG = {
  SUPABASE_URL: "your-supabase-url",
  SUPABASE_ANON_KEY: "your-supabase-anon-key",
  GOOGLE_AI_API_KEY: "your-gemini-key",
  GROQ_API_KEY: "your-groq-key",
  ELEVENLABS_AGENT_ID: "your-elevenlabs-agent-id",
  ELEVENLABS_VOICE_ID: "your-elevenlabs-voice-id"
};
```

3. Open `chrome://extensions/`, enable Developer mode, click Load unpacked,
   and select the root `LennyLive/` directory.
4. Seed the Supabase table using the migration files in `supabase/migrations/`.

---

## Status

Built and submitted for Lenny Rachitsky's April 2026 challenge. Winner.
Active personal use. Not published to the Chrome Web Store.
