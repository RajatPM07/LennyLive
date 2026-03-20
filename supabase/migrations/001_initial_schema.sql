-- =============================================================
-- Lenny Live — Initial Schema
-- =============================================================

-- 1. Enable pgvector
create extension if not exists vector;

-- =============================================================
-- 2. transcript_chunks
--    One row per curated PM moment from Lenny's podcast archive
-- =============================================================
create table if not exists transcript_chunks (
  id              uuid primary key default gen_random_uuid(),
  topic           text not null,          -- one of the 10 core PM topics
  guest_name      text not null,
  insight         text not null,          -- one-line insight (≤ 120 chars)
  pull_quote      text not null,          -- exact words from transcript
  episode_title   text not null,
  youtube_url     text not null,
  timestamp_secs  integer not null,       -- seconds into episode
  embedding       vector(768),            -- Google text-embedding-004
  created_at      timestamptz not null default now()
);

-- Constraint: topic must be one of the 10 curated PM topics
alter table transcript_chunks
  add constraint transcript_chunks_topic_check check (
    topic in (
      'Retention',
      'GTM Strategy',
      'Product-Market Fit',
      'Roadmap Prioritisation',
      'Growth Loops',
      'Stakeholder Management',
      'Hiring',
      'Metrics & North Star',
      'User Research',
      '0-to-1 Building'
    )
  );

-- IVFFlat index for fast approximate nearest-neighbour search
-- (rebuild with a higher lists value once you have > 1000 rows)
create index if not exists transcript_chunks_embedding_idx
  on transcript_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- =============================================================
-- 3. user_data
--    Anonymous user profile + gamification state
-- =============================================================
create table if not exists user_data (
  id                      uuid primary key default gen_random_uuid(),
  anonymous_id            text unique not null,   -- generated client-side UUID
  knowledge_score         integer not null default 0,
  current_streak          integer not null default 0,
  longest_streak          integer not null default 0,
  last_active_date        date,
  total_insights_engaged  integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Auto-update updated_at on any row change
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_data_updated_at
  before update on user_data
  for each row execute procedure update_updated_at();

-- =============================================================
-- 4. saved_insights
--    Personal Lenny notebook — insights a user has saved
-- =============================================================
create table if not exists saved_insights (
  id            uuid primary key default gen_random_uuid(),
  anonymous_id  text not null references user_data(anonymous_id) on delete cascade,
  chunk_id      uuid not null references transcript_chunks(id) on delete cascade,
  topic         text not null,           -- denormalised for fast topic filtering
  saved_at      timestamptz not null default now(),
  unique (anonymous_id, chunk_id)        -- no duplicates in library
);

create index if not exists saved_insights_anonymous_id_idx
  on saved_insights (anonymous_id);

create index if not exists saved_insights_topic_idx
  on saved_insights (anonymous_id, topic);

-- =============================================================
-- 5. match_transcript_chunks — helper RPC for RAG queries
--    Usage: select * from match_transcript_chunks(embedding, 0.5, 3);
--    Note: gemini-embedding-001 cosine similarities typically land in 0.5–0.65
--    for semantically related content — 0.75 is too aggressive for this model.
-- =============================================================
create or replace function match_transcript_chunks(
  query_embedding  vector(768),
  match_threshold  float   default 0.5,
  match_count      int     default 3
)
returns table (
  id             uuid,
  topic          text,
  guest_name     text,
  insight        text,
  pull_quote     text,
  episode_title  text,
  youtube_url    text,
  timestamp_secs integer,
  similarity     float
)
language sql stable as $$
  select
    id,
    topic,
    guest_name,
    insight,
    pull_quote,
    episode_title,
    youtube_url,
    timestamp_secs,
    1 - (embedding <=> query_embedding) as similarity
  from transcript_chunks
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
