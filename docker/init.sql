-- Runs once on first container boot (docker-entrypoint-initdb.d)
-- Enables the pgvector extension required by Prisma schema (extensions = [vector])
CREATE EXTENSION IF NOT EXISTS vector;
