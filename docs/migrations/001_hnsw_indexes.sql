-- Migration: HNSW indexes on profile_embeddings for fast ANN search
-- Run locally against Supabase (cloud runner cannot reach DB):
--   psql "$DIRECT_URL" -f docs/migrations/001_hnsw_indexes.sql
--
-- Prerequisites: pgvector extension must be enabled (already live in Supabase).
-- These indexes support the <=> cosine distance operator used in ANN queries.
-- HNSW build is non-blocking on Postgres 16 (CREATE INDEX CONCURRENTLY).

-- Primary profile embedding (1536-dim, text-embedding-3-small)
CREATE INDEX CONCURRENTLY IF NOT EXISTS profile_embeddings_embedding_hnsw
  ON profile_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Story embedding (1536-dim, Phase C)
CREATE INDEX CONCURRENTLY IF NOT EXISTS profile_embeddings_story_hnsw
  ON profile_embeddings
  USING hnsw ("storyEmbedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Habits embedding (1536-dim, Phase C)
CREATE INDEX CONCURRENTLY IF NOT EXISTS profile_embeddings_habits_hnsw
  ON profile_embeddings
  USING hnsw ("habitsEmbedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Verify indexes were created:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'profile_embeddings';
