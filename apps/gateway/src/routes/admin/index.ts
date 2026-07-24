import { Router } from 'express';
import { requireAdminRole } from '@abroad-matrimony/auth';
import { AdminRole } from '@abroad-matrimony/shared';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import { adminLoginSchema } from '../../schemas/admin/admin-login.schema.js';
import { adminAuthController } from '../../controllers/admin/admin-auth.controller.js';
import { flagsController } from '../../controllers/admin/flags.controller.js';
import { paymentAdminController } from '../../controllers/admin/payment-admin.controller.js';
import { groupsAdminController } from '../../controllers/admin/groups-admin.controller.js';
import { introductionsAdminController } from '../../controllers/admin/introductions-admin.controller.js';
import { usersAdminController } from '../../controllers/admin/users-admin.controller.js';
import { featureFlagsAdminController } from '../../controllers/admin/feature-flags-admin.controller.js';
import { verificationAdminController } from '../../controllers/admin/verification-admin.controller.js';
import { auditLogController } from '../../controllers/admin/audit-log.controller.js';
import { analyticsAdminController } from '../../controllers/admin/analytics-admin.controller.js';
import { eventsAdminController } from '../../controllers/admin/events-admin.controller.js';
import { eventsController } from '../../controllers/events/events.controller.js';
import { promptsAdminController } from '../../controllers/admin/prompts-admin.controller.js';
import { groupsMgmtController } from '../../controllers/admin/groups-mgmt.controller.js';
import { systemConfigController } from '../../controllers/admin/system-config.controller.js';
import { seederMonitoringController } from '../../controllers/admin/seeder-monitoring.controller.js';
import { aiMonitoringController } from '../../controllers/admin/ai-monitoring.controller.js';
import { aiProposalsController } from '../../controllers/admin/ai-proposals.controller.js';
import { resolveFlagBodySchema, adminFlagsQuerySchema } from '../../schemas/admin/resolve-flag.schema.js';
import { adminRefundBodySchema } from '../../schemas/payment/admin-refund.schema.js';
import { z } from 'zod';

// ─── Inline Zod schemas ───────────────────────────────────────────────────────

const userIdParamsSchema        = z.object({ userId:     z.string().uuid('userId must be a valid UUID') });
const dropIdParamSchema         = z.object({ dropId:     z.string().uuid('dropId must be a valid UUID') });
const eventIdParamSchema        = z.object({ eventId:    z.string().uuid('eventId must be a valid UUID') });
const promptIdParamSchema       = z.object({ promptId:   z.string().uuid('promptId must be a valid UUID') });
const groupIdParamSchema        = z.object({ groupId:    z.string().uuid('groupId must be a valid UUID') });
const requestIdParamSchema      = z.object({ requestId:  z.string().uuid('requestId must be a valid UUID') });
const flagKeyParamSchema        = z.object({ flagKey:    z.string().min(1).max(100) });
const configKeyParamSchema      = z.object({ configKey:  z.string().min(1).max(100) });
const flagIdParamsSchema        = z.object({ flagId:     z.string().uuid('flagId must be a valid UUID') });
const proposalIdParamSchema     = z.object({ proposalId: z.string().uuid('proposalId must be a valid UUID') });
const groupAndPostAdminParamSchema = z.object({
  groupId: z.string().uuid('groupId must be a valid UUID'),
  postId:  z.string().uuid('postId must be a valid UUID'),
});

const dropStatusQuerySchema   = z.object({ status: z.enum(['DRAFT','PENDING_APPROVAL','SCHEDULED','LIVE','EXPIRED']).optional() });
const proposeDropBodySchema   = z.object({
  name:            z.string().min(1).max(100),
  criteria:        z.unknown().optional(),
  memberPool:      z.array(z.string().uuid()).min(2),
  earlyAccessCost: z.number().int().min(0).optional(),
  unlockCost:      z.number().int().min(0).optional(),
  releaseAt:       z.string().datetime().optional(),
});
const updateMembersBodySchema = z.object({ memberPool: z.array(z.string().uuid()).min(2) });
const scheduleDropBodySchema  = z.object({ releaseAt: z.string().datetime() });

const rejectProposalBodySchema  = z.object({ reason: z.string().max(500).optional() });
const proposalStatusQuerySchema = z.object({ status: z.enum(['PENDING','APPROVED','REJECTED']).optional() });

const verificationStatusQuerySchema = z.object({
  status: z.enum(['PENDING','UNDER_REVIEW','APPROVED','REJECTED']).optional(),
  limit:  z.string().optional(),
  cursor: z.string().optional(),
});
const rejectVerificationBodySchema  = z.object({ reason: z.string().min(1).max(500) });

const createFlagBodySchema = z.object({
  key:                  z.string().min(1).max(100),
  description:          z.string().max(500).optional(),
  enabled:              z.boolean().optional(),
  rolloutPercentage:    z.number().int().min(0).max(100).optional(),
  allowedUserIds:       z.array(z.string().uuid()).optional(),
  allowedEnvironments:  z.array(z.string()).optional(),
});
const updateFlagBodySchema = z.object({
  description:          z.string().max(500).optional(),
  enabled:              z.boolean().optional(),
  rolloutPercentage:    z.number().int().min(0).max(100).optional(),
  allowedUserIds:       z.array(z.string().uuid()).optional(),
  allowedEnvironments:  z.array(z.string()).optional(),
});

const upsertConfigBodySchema = z.object({
  value:       z.string().min(1),
  description: z.string().max(500).optional(),
});
const createConfigBodySchema = z.object({
  key:         z.string().min(1).max(100),
  value:       z.string().min(1),
  description: z.string().max(500).optional(),
});

const createEventBodySchema = z.object({
  groupId:     z.string().uuid().optional(),
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  tag:         z.string().optional(),
  creditCost:  z.number().int().min(0).optional(),
  startAt:     z.string().datetime(),
  endAt:       z.string().datetime().optional(),
  location:    z.string().max(500).optional(),
  onlineUrl:   z.string().url().optional(),
  capacity:    z.number().int().min(1).optional(),
});
const updateEventBodySchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  tag:         z.string().optional(),
  creditCost:  z.number().int().min(0).optional(),
  startAt:     z.string().datetime().optional(),
  endAt:       z.string().datetime().optional(),
  location:    z.string().max(500).optional(),
  onlineUrl:   z.string().url().optional(),
  capacity:    z.number().int().min(1).optional(),
  status:      z.string().optional(),
});

const createPromptBodySchema = z.object({
  weekKey:     z.string().optional(),
  question:    z.string().min(1).max(500),
  theme:       z.string().max(100).optional(),
  publishedAt: z.string().datetime().optional(),
  expiresAt:   z.string().datetime().optional(),
});
const updatePromptBodySchema = z.object({
  question:    z.string().min(1).max(500).optional(),
  theme:       z.string().max(100).optional(),
  publishedAt: z.string().datetime().optional(),
  expiresAt:   z.string().datetime().optional(),
});

const createGroupBodySchema = z.object({
  name:          z.string().min(1).max(100),
  description:   z.string().max(500).optional(),
  type:          z.enum(['REGIONAL','CULTURAL','PROFESSIONAL','INTEREST']),
  scope:         z.enum(['COUNTRY','GLOBAL']).optional(),
  accessType:    z.enum(['OPEN','INVITE_ONLY']).optional(),
  targetCountry: z.string().optional(),
  targetCity:    z.string().optional(),
  parentGroupId: z.string().uuid().optional(),
});
const updateGroupBodySchema = z.object({
  name:          z.string().min(1).max(100).optional(),
  description:   z.string().max(500).optional(),
  accessType:    z.enum(['OPEN','INVITE_ONLY']).optional(),
  targetCountry: z.string().optional(),
  targetCity:    z.string().optional(),
});

const suspendBodySchema   = z.object({ reason: z.string().min(1).max(500) });
const banBodySchema       = z.object({ reason: z.string().min(1).max(500) });

const embeddingStatusQuerySchema = z.object({
  status: z.enum(['complete','pending','stale']).optional(),
  limit:  z.string().optional(),
  cursor: z.string().optional(),
});

const proposeAiDropBodySchema = z.object({ region: z.string().min(1).max(100) });

export const adminRouter = Router();

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** POST /admin/auth/login — public */
adminRouter.post('/auth/login', validateBody(adminLoginSchema), adminAuthController.login);

// ─── User Administration (ADMIN-002) ─────────────────────────────────────────

/** GET /admin/users */
adminRouter.get('/users', requireAdminRole(AdminRole.MODERATOR), usersAdminController.listUsers);

/** GET /admin/users/:userId */
adminRouter.get('/users/:userId', requireAdminRole(AdminRole.MODERATOR), validateParams(userIdParamsSchema), usersAdminController.getUserDetail);

/** PUT /admin/users/:userId/suspend */
adminRouter.put('/users/:userId/suspend', requireAdminRole(AdminRole.MODERATOR), validateParams(userIdParamsSchema), validateBody(suspendBodySchema), usersAdminController.suspendUser);

/** PUT /admin/users/:userId/unsuspend */
adminRouter.put('/users/:userId/unsuspend', requireAdminRole(AdminRole.MODERATOR), validateParams(userIdParamsSchema), usersAdminController.unsuspendUser);

/** PUT /admin/users/:userId/ban */
adminRouter.put('/users/:userId/ban', requireAdminRole(AdminRole.SUPERADMIN), validateParams(userIdParamsSchema), validateBody(banBodySchema), usersAdminController.banUser);

/** DELETE /admin/users/:userId/seeded */
adminRouter.delete('/users/:userId/seeded', requireAdminRole(AdminRole.SUPERADMIN), validateParams(userIdParamsSchema), usersAdminController.wipeSeededData);

/** GET /admin/users/:userId/flags */
adminRouter.get('/users/:userId/flags', requireAdminRole(AdminRole.MODERATOR), validateParams(userIdParamsSchema), validateQuery(adminFlagsQuerySchema), flagsController.listByUser);

// ─── Feature Flags (ADMIN-003) ────────────────────────────────────────────────

/** GET /admin/feature-flags */
adminRouter.get('/feature-flags', requireAdminRole(AdminRole.SUPERADMIN), featureFlagsAdminController.list);

/** GET /admin/feature-flags/:flagKey */
adminRouter.get('/feature-flags/:flagKey', requireAdminRole(AdminRole.SUPERADMIN), validateParams(flagKeyParamSchema), featureFlagsAdminController.get);

/** POST /admin/feature-flags */
adminRouter.post('/feature-flags', requireAdminRole(AdminRole.SUPERADMIN), validateBody(createFlagBodySchema), featureFlagsAdminController.create);

/** PATCH /admin/feature-flags/:flagKey */
adminRouter.patch('/feature-flags/:flagKey', requireAdminRole(AdminRole.SUPERADMIN), validateParams(flagKeyParamSchema), validateBody(updateFlagBodySchema), featureFlagsAdminController.update);

/** DELETE /admin/feature-flags/:flagKey */
adminRouter.delete('/feature-flags/:flagKey', requireAdminRole(AdminRole.SUPERADMIN), validateParams(flagKeyParamSchema), featureFlagsAdminController.remove);

// ─── Verification Administration (ADMIN-004) ──────────────────────────────────

/** GET /admin/verification */
adminRouter.get('/verification', requireAdminRole(AdminRole.MODERATOR), validateQuery(verificationStatusQuerySchema), verificationAdminController.list);

/** GET /admin/verification/:requestId */
adminRouter.get('/verification/:requestId', requireAdminRole(AdminRole.MODERATOR), validateParams(requestIdParamSchema), verificationAdminController.get);

/** POST /admin/verification/:requestId/approve */
adminRouter.post('/verification/:requestId/approve', requireAdminRole(AdminRole.MODERATOR), validateParams(requestIdParamSchema), verificationAdminController.approve);

/** POST /admin/verification/:requestId/reject */
adminRouter.post('/verification/:requestId/reject', requireAdminRole(AdminRole.MODERATOR), validateParams(requestIdParamSchema), validateBody(rejectVerificationBodySchema), verificationAdminController.reject);

// ─── Audit Log (ADMIN-005) ────────────────────────────────────────────────────

/** GET /admin/audit-log */
adminRouter.get('/audit-log', requireAdminRole(AdminRole.SUPERADMIN), auditLogController.list);

// ─── Moderation Flags (ADMIN-006) ─────────────────────────────────────────────

/** PUT /admin/flags/:flagId */
adminRouter.put('/flags/:flagId', requireAdminRole(AdminRole.MODERATOR), validateParams(flagIdParamsSchema), validateBody(resolveFlagBodySchema), flagsController.resolve);

// ─── Analytics (ADMIN-007 + ADMIN-017) ───────────────────────────────────────

/** GET /admin/analytics/kpi */
adminRouter.get('/analytics/kpi', requireAdminRole(AdminRole.MODERATOR), analyticsAdminController.getKpi);

/** GET /admin/analytics/cohort */
adminRouter.get('/analytics/cohort', requireAdminRole(AdminRole.MODERATOR), analyticsAdminController.getCohortRetention);

/** GET /admin/analytics/groups */
adminRouter.get('/analytics/groups', requireAdminRole(AdminRole.MODERATOR), analyticsAdminController.getGroupAnalytics);

/** GET /admin/analytics/drops */
adminRouter.get('/analytics/drops', requireAdminRole(AdminRole.MODERATOR), analyticsAdminController.getDropAnalytics);

/** GET /admin/analytics/ai */
adminRouter.get('/analytics/ai', requireAdminRole(AdminRole.MODERATOR), analyticsAdminController.getAiAnalytics);

/** GET /admin/analytics/diamonds */
adminRouter.get('/analytics/diamonds', requireAdminRole(AdminRole.MODERATOR), analyticsAdminController.getDiamondAnalytics);

/** GET /admin/analytics/match-health */
adminRouter.get('/analytics/match-health', requireAdminRole(AdminRole.MODERATOR), analyticsAdminController.getMatchHealth);

/** GET /admin/users/:userId/matches */
adminRouter.get('/users/:userId/matches', requireAdminRole(AdminRole.MODERATOR), analyticsAdminController.getUserMatches);

/** GET /admin/users/:userId/activity */
adminRouter.get('/users/:userId/activity', requireAdminRole(AdminRole.MODERATOR), analyticsAdminController.getUserActivity);

// ─── Events Administration (ADMIN-008) ───────────────────────────────────────

/** GET /admin/events */
adminRouter.get('/events', requireAdminRole(AdminRole.MODERATOR), eventsAdminController.list);

/** POST /admin/events — MUST be before /:eventId */
adminRouter.post('/events', requireAdminRole(AdminRole.MODERATOR), validateBody(createEventBodySchema), eventsAdminController.create);

/** GET /admin/events/:eventId */
adminRouter.get('/events/:eventId', requireAdminRole(AdminRole.MODERATOR), validateParams(eventIdParamSchema), eventsAdminController.get);

/** PATCH /admin/events/:eventId */
adminRouter.patch('/events/:eventId', requireAdminRole(AdminRole.MODERATOR), validateParams(eventIdParamSchema), validateBody(updateEventBodySchema), eventsAdminController.update);

/** DELETE /admin/events/:eventId */
adminRouter.delete('/events/:eventId', requireAdminRole(AdminRole.MODERATOR), validateParams(eventIdParamSchema), eventsAdminController.archive);

/** POST /admin/events/:eventId/process-attendance — EVENT-007 co-attendance score boost */
adminRouter.post('/events/:eventId/process-attendance', requireAdminRole(AdminRole.MODERATOR), validateParams(eventIdParamSchema), eventsController.processAttendance);

// ─── Prompts Administration (ADMIN-009) ───────────────────────────────────────

/** GET /admin/prompts */
adminRouter.get('/prompts', requireAdminRole(AdminRole.MODERATOR), promptsAdminController.list);

/** POST /admin/prompts */
adminRouter.post('/prompts', requireAdminRole(AdminRole.MODERATOR), validateBody(createPromptBodySchema), promptsAdminController.create);

/** GET /admin/prompts/:promptId */
adminRouter.get('/prompts/:promptId', requireAdminRole(AdminRole.MODERATOR), validateParams(promptIdParamSchema), promptsAdminController.get);

/** PATCH /admin/prompts/:promptId */
adminRouter.patch('/prompts/:promptId', requireAdminRole(AdminRole.MODERATOR), validateParams(promptIdParamSchema), validateBody(updatePromptBodySchema), promptsAdminController.update);

// ─── Group Management — full CRUD (ADMIN-010) ─────────────────────────────────
// NOTE: static /proposals routes declared before /:groupId to avoid path conflicts

/** GET /admin/groups */
adminRouter.get('/groups', requireAdminRole(AdminRole.MODERATOR), groupsMgmtController.list);

/** POST /admin/groups */
adminRouter.post('/groups', requireAdminRole(AdminRole.MODERATOR), validateBody(createGroupBodySchema), groupsMgmtController.create);

/** GET /admin/groups/proposals — MUST be before /:groupId */
adminRouter.get('/groups/proposals', requireAdminRole(AdminRole.MODERATOR), validateQuery(proposalStatusQuerySchema), groupsAdminController.listProposals);

/** POST /admin/groups/proposals/:proposalId/approve */
adminRouter.post('/groups/proposals/:proposalId/approve', requireAdminRole(AdminRole.MODERATOR), validateParams(proposalIdParamSchema), groupsAdminController.approveProposal);

/** POST /admin/groups/proposals/:proposalId/reject */
adminRouter.post('/groups/proposals/:proposalId/reject', requireAdminRole(AdminRole.MODERATOR), validateParams(proposalIdParamSchema), validateBody(rejectProposalBodySchema), groupsAdminController.rejectProposal);

/** GET /admin/groups/:groupId */
adminRouter.get('/groups/:groupId', requireAdminRole(AdminRole.MODERATOR), validateParams(groupIdParamSchema), groupsMgmtController.get);

/** PATCH /admin/groups/:groupId */
adminRouter.patch('/groups/:groupId', requireAdminRole(AdminRole.MODERATOR), validateParams(groupIdParamSchema), validateBody(updateGroupBodySchema), groupsMgmtController.update);

/** DELETE /admin/groups/:groupId */
adminRouter.delete('/groups/:groupId', requireAdminRole(AdminRole.SUPERADMIN), validateParams(groupIdParamSchema), groupsMgmtController.archive);

/** POST /admin/groups/:groupId/posts/:postId/pin */
adminRouter.post('/groups/:groupId/posts/:postId/pin', requireAdminRole(AdminRole.MODERATOR), validateParams(groupAndPostAdminParamSchema), groupsAdminController.pinPost);

/** DELETE /admin/groups/:groupId/posts/:postId/pin */
adminRouter.delete('/groups/:groupId/posts/:postId/pin', requireAdminRole(AdminRole.MODERATOR), validateParams(groupAndPostAdminParamSchema), groupsAdminController.unpinPost);

// ─── AI Proposals (ADMIN-012) ─────────────────────────────────────────────────

/** POST /admin/ai/drops/propose */
adminRouter.post('/ai/drops/propose', requireAdminRole(AdminRole.MODERATOR), validateBody(proposeAiDropBodySchema), aiProposalsController.proposeDrops);

/** POST /admin/ai/events/:eventId/pre-connections */
adminRouter.post('/ai/events/:eventId/pre-connections', requireAdminRole(AdminRole.MODERATOR), validateParams(eventIdParamSchema), aiProposalsController.generatePreConnections);

// ─── Group Proposals — admin only (ADMIN-013) — already covered above in ADMIN-010 section

// ─── System Config (ADMIN-014) ────────────────────────────────────────────────

/** GET /admin/system-config */
adminRouter.get('/system-config', requireAdminRole(AdminRole.SUPERADMIN), systemConfigController.list);

/** POST /admin/system-config */
adminRouter.post('/system-config', requireAdminRole(AdminRole.SUPERADMIN), validateBody(createConfigBodySchema), systemConfigController.create);

/** GET /admin/system-config/:configKey */
adminRouter.get('/system-config/:configKey', requireAdminRole(AdminRole.SUPERADMIN), validateParams(configKeyParamSchema), systemConfigController.get);

/** PUT /admin/system-config/:configKey */
adminRouter.put('/system-config/:configKey', requireAdminRole(AdminRole.SUPERADMIN), validateParams(configKeyParamSchema), validateBody(upsertConfigBodySchema), systemConfigController.upsert);

/** DELETE /admin/system-config/:configKey */
adminRouter.delete('/system-config/:configKey', requireAdminRole(AdminRole.SUPERADMIN), validateParams(configKeyParamSchema), systemConfigController.remove);

// ─── Seeder Monitoring (ADMIN-015) ────────────────────────────────────────────

/** GET /admin/seeder/status */
adminRouter.get('/seeder/status', requireAdminRole(AdminRole.SUPERADMIN), seederMonitoringController.getStatus);

/** POST /admin/seeder/flush */
adminRouter.post('/seeder/flush', requireAdminRole(AdminRole.SUPERADMIN), seederMonitoringController.flush);

// ─── AI / Embedding Monitoring (ADMIN-016) ────────────────────────────────────

/** GET /admin/ai/embeddings/status */
adminRouter.get('/ai/embeddings/status', requireAdminRole(AdminRole.MODERATOR), aiMonitoringController.getStatus);

/** GET /admin/ai/embeddings */
adminRouter.get('/ai/embeddings', requireAdminRole(AdminRole.MODERATOR), validateQuery(embeddingStatusQuerySchema), aiMonitoringController.listEmbeddings);

/** POST /admin/ai/embeddings/:userId/recompute */
adminRouter.post('/ai/embeddings/:userId/recompute', requireAdminRole(AdminRole.MODERATOR), validateParams(userIdParamsSchema), aiMonitoringController.recomputeOne);

/** POST /admin/ai/embeddings/recompute-all — MUST be before /:userId/recompute */
adminRouter.post('/ai/embeddings/recompute-all', requireAdminRole(AdminRole.MODERATOR), aiMonitoringController.recomputeAllStale);

// ─── Introduction Drop Administration (IDROP-004) ──────────────────────────────

/** GET /admin/introductions/drops */
adminRouter.get('/introductions/drops', requireAdminRole(AdminRole.MODERATOR), validateQuery(dropStatusQuerySchema), introductionsAdminController.listDrops);

/** POST /admin/introductions/drops/propose — MUST be before /:dropId */
adminRouter.post('/introductions/drops/propose', requireAdminRole(AdminRole.MODERATOR), validateBody(proposeDropBodySchema), introductionsAdminController.proposeDrop);

/** GET /admin/introductions/drops/:dropId */
adminRouter.get('/introductions/drops/:dropId', requireAdminRole(AdminRole.MODERATOR), validateParams(dropIdParamSchema), introductionsAdminController.getDropDetail);

/** PATCH /admin/introductions/drops/:dropId/approve */
adminRouter.patch('/introductions/drops/:dropId/approve', requireAdminRole(AdminRole.MODERATOR), validateParams(dropIdParamSchema), introductionsAdminController.approveDrop);

/** PATCH /admin/introductions/drops/:dropId/members */
adminRouter.patch('/introductions/drops/:dropId/members', requireAdminRole(AdminRole.MODERATOR), validateParams(dropIdParamSchema), validateBody(updateMembersBodySchema), introductionsAdminController.updateMembers);

/** PATCH /admin/introductions/drops/:dropId/schedule */
adminRouter.patch('/introductions/drops/:dropId/schedule', requireAdminRole(AdminRole.MODERATOR), validateParams(dropIdParamSchema), validateBody(scheduleDropBodySchema), introductionsAdminController.scheduleDrop);

// ─── Payments (PAY-008) ───────────────────────────────────────────────────────

/** POST /admin/payment/refund */
adminRouter.post('/payment/refund', requireAdminRole(AdminRole.SUPERADMIN), validateBody(adminRefundBodySchema), paymentAdminController.refund);
