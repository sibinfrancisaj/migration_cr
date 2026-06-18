/**
 * ADMIN-014 — SystemConfig management service.
 * Key-value store for admin-configurable platform settings.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'config:system-config' });

export class SystemConfigNotFoundError extends Error {
  constructor() { super('SYSTEM_CONFIG_NOT_FOUND'); this.name = 'SystemConfigNotFoundError'; }
}
export class SystemConfigAlreadyExistsError extends Error {
  constructor() { super('SYSTEM_CONFIG_ALREADY_EXISTS'); this.name = 'SystemConfigAlreadyExistsError'; }
}
export class SystemConfigDeleteProtectedError extends Error {
  constructor() { super('SYSTEM_CONFIG_DELETE_PROTECTED'); this.name = 'SystemConfigDeleteProtectedError'; }
}
export class SystemConfigValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'SystemConfigValidationError'; }
}

/** Keys that cannot be deleted — system-critical. */
const PROTECTED_KEYS = new Set([
  'SUGGESTED_GROUPS_MAX',
  'DRIP_BATCH_SIZE',
  'DRIP_WINDOW_HOURS',
  'INTRO_DROP_AI_POOL_SIZE',
]);

/** Type constraints for known keys. */
const KNOWN_KEY_VALIDATORS: Record<string, (v: string) => boolean> = {
  SUGGESTED_GROUPS_MAX:      (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 50,
  DRIP_BATCH_SIZE:           (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 20,
  DRIP_WINDOW_HOURS:         (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 24,
  INTRO_DROP_AI_POOL_SIZE:   (v) => Number.isInteger(Number(v)) && Number(v) >= 3 && Number(v) <= 10,
};

export interface SystemConfigDto {
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

function toDto(c: { key: string; value: string; description: string | null; updatedAt: Date }): SystemConfigDto {
  return {
    key: c.key,
    value: c.value,
    description: c.description,
    updatedAt: c.updatedAt.toISOString(),
  };
}

// ─── listSystemConfig ────────────────────────────────────────────────────────

export async function listSystemConfig(): Promise<SystemConfigDto[]> {
  const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  return configs.map(toDto);
}

// ─── getSystemConfig ─────────────────────────────────────────────────────────

export async function getSystemConfig(key: string): Promise<SystemConfigDto> {
  const config = await prisma.systemConfig.findUnique({ where: { key } });
  if (!config) throw new SystemConfigNotFoundError();
  return toDto(config);
}

// ─── upsertSystemConfig ──────────────────────────────────────────────────────

export async function upsertSystemConfig(
  key: string,
  value: string,
  description?: string,
): Promise<SystemConfigDto> {
  // Validate known keys
  const validator = KNOWN_KEY_VALIDATORS[key];
  if (validator && !validator(value)) {
    throw new SystemConfigValidationError(
      `Invalid value "${value}" for key "${key}". Check allowed range.`,
    );
  }

  const config = await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value, description: description ?? null },
    update: { value, ...(description !== undefined ? { description } : {}) },
  });

  log.info('SystemConfig updated', { key, value });
  return toDto(config);
}

// ─── createSystemConfig ──────────────────────────────────────────────────────

export async function createSystemConfig(
  key: string,
  value: string,
  description?: string,
): Promise<SystemConfigDto> {
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
    throw new SystemConfigValidationError('Key must be UPPER_SNAKE_CASE (e.g. MY_CONFIG_KEY)');
  }

  const existing = await prisma.systemConfig.findUnique({ where: { key } });
  if (existing) throw new SystemConfigAlreadyExistsError();

  const config = await prisma.systemConfig.create({
    data: { key, value, description: description ?? null },
  });

  log.info('SystemConfig created', { key });
  return toDto(config);
}

// ─── deleteSystemConfig ──────────────────────────────────────────────────────

export async function deleteSystemConfig(key: string): Promise<void> {
  if (PROTECTED_KEYS.has(key)) throw new SystemConfigDeleteProtectedError();

  const existing = await prisma.systemConfig.findUnique({ where: { key } });
  if (!existing) throw new SystemConfigNotFoundError();

  await prisma.systemConfig.delete({ where: { key } });
  log.info('SystemConfig deleted', { key });
}
