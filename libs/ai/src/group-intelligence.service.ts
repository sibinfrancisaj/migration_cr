/**
 * VEC-002 — Group Intelligence Service.
 *
 * Generates a 1536-dim text-embedding-3-small vector for a group from its
 * name, description, type, and cultural/profession tags.  The embedding is
 * stored in `group_embeddings` and used by VEC-003 for semantic group
 * suggestions.
 *
 * Short-circuits (no-op) when OPENAI_API_KEY is absent.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { isAiConfigured, getAiClient } from './client.js';

const log = createChildLogger({ module: 'ai:group-intelligence' });

// ── Error types ───────────────────────────────────────────────────────────────

export class GroupNotFoundError extends Error {
  constructor(groupId: string) {
    super(`Group not found: ${groupId}`);
    this.name = 'GroupNotFoundError';
  }
}

// ── Output type ───────────────────────────────────────────────────────────────

export interface GroupEmbeddingDto {
  groupId: string;
  summary: string;
  updatedAt: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a compact text description of a group for embedding.
 * Combines name, type, region/country context, description, and tags.
 */
function buildGroupText(group: {
  name: string;
  type: string;
  region: string;
  country: string | null;
  description: string | null;
  professionTag: string | null;
  culturalTag: string | null;
}): string {
  const parts: string[] = [
    `Group: ${group.name}`,
    `Type: ${group.type}`,
    `Region: ${group.region}${group.country ? ` (${group.country})` : ''}`,
  ];

  if (group.description) parts.push(`Description: ${group.description}`);
  if (group.professionTag) parts.push(`Profession focus: ${group.professionTag}`);
  if (group.culturalTag) parts.push(`Cultural focus: ${group.culturalTag}`);

  return parts.join('. ');
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Generates and upserts a group embedding.
 *
 * Steps:
 *   1. Fetch group row (name, description, tags).
 *   2. Build a compact text representation.
 *   3. Call text-embedding-3-small.
 *   4. Upsert into `group_embeddings`.
 *
 * Returns the upserted DTO.  Throws `GroupNotFoundError` when the group
 * doesn't exist.  Returns `null` (no-op) when AI is not configured.
 */
export async function generateGroupEmbedding(
  groupId: string,
): Promise<GroupEmbeddingDto | null> {
  if (!isAiConfigured()) {
    log.debug('AI not configured — skipping group embedding', { groupId });
    return null;
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id:           true,
      name:         true,
      type:         true,
      region:       true,
      country:      true,
      description:  true,
      professionTag: true,
      culturalTag:   true,
    },
  });

  if (!group) throw new GroupNotFoundError(groupId);

  const text = buildGroupText(group);

  const client = getAiClient();
  const embeddingResponse = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  const vector = embeddingResponse.data[0]?.embedding;
  if (!vector) {
    log.warn('Empty embedding returned for group', { groupId });
    return null;
  }

  const vectorLiteral = `[${vector.join(',')}]`;

  // Upsert via raw SQL — Prisma cannot write Unsupported("vector") fields
  await prisma.$executeRaw`
    INSERT INTO group_embeddings (group_id, summary, embedding, updated_at)
    VALUES (
      ${groupId},
      ${text},
      ${vectorLiteral}::vector,
      NOW()
    )
    ON CONFLICT (group_id) DO UPDATE
      SET summary     = EXCLUDED.summary,
          embedding   = EXCLUDED.embedding,
          updated_at  = NOW()
  `;

  log.info('Group embedding upserted', { groupId, textLength: text.length });

  // Read back via raw — Prisma client type won't include groupEmbedding until `prisma generate` is re-run
  type EmbeddingRow = { group_id: string; summary: string | null; updated_at: Date };
  const [row] = await prisma.$queryRaw<EmbeddingRow[]>`
    SELECT group_id, summary, updated_at FROM group_embeddings WHERE group_id = ${groupId}
  `;

  return {
    groupId:   groupId,
    summary:   row?.summary ?? text,
    updatedAt: row?.updated_at ?? new Date(),
  };
}

/**
 * Regenerates embeddings for all active groups that have no embedding or
 * whose group was updated more recently than its embedding.
 *
 * Returns counts of { processed, skipped, errors }.
 */
export async function generateAllGroupEmbeddings(): Promise<{
  processed: number;
  skipped:   number;
  errors:    number;
}> {
  if (!isAiConfigured()) {
    log.debug('AI not configured — skipping bulk group embeddings');
    return { processed: 0, skipped: 0, errors: 0 };
  }

  // Fetch groups that need (re)embedding: no embedding row OR group updated after last embed
  type StaleRow = { id: string };
  const staleGroups = await prisma.$queryRaw<StaleRow[]>`
    SELECT g.id
    FROM groups g
    LEFT JOIN group_embeddings ge ON ge.group_id = g.id
    WHERE g.is_active = true
      AND (ge.group_id IS NULL OR g.updated_at > ge.updated_at)
    ORDER BY g.created_at ASC
  `;

  let processed = 0;
  let skipped   = 0;
  let errors    = 0;

  for (const { id } of staleGroups) {
    try {
      const result = await generateGroupEmbedding(id);
      if (result) processed++;
      else skipped++;
    } catch (err) {
      log.warn('Failed to embed group', { groupId: id, err });
      errors++;
    }
  }

  log.info('Bulk group embedding complete', { processed, skipped, errors });
  return { processed, skipped, errors };
}
