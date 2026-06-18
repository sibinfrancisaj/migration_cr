import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listCurrentIntroductions,
  listIntroductionHistory,
  getIntroductionDetail,
  acceptIntroduction,
  declineIntroduction,
  earlyUnlockWeeklyIntros,
  EarlyUnlockInsufficientDiamondsError,
  IntroductionNotFoundError,
  IntroductionForbiddenError,
  IntroductionExpiredError,
  IntroductionAlreadyRespondedError,
  generateWhyThisMatchLLM,
  // Drop services
  listDropsForUser,
  getDropDetail,
  earlyAccessDrop,
  unlockDropEarly,
  IntroductionDropNotFoundError,
  DropNotLiveError,
  InsufficientDiamondsForDropError,
  AlreadyUnlockedError,
} from '@abroad-matrimony/introductions';
import { getMatchScore, computeAndSaveScore, UserProfileMissingError } from '@abroad-matrimony/matching';
import { generateWhyThisMatch } from '@abroad-matrimony/introductions';
import { cacheGet, cacheSet } from '@abroad-matrimony/cache';
import { CACHE_KEYS, CACHE_TTL } from '@abroad-matrimony/shared';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import {
  INTRODUCTION_ERRORS,
  INTRODUCTION_MESSAGES,
  DROP_ERRORS,
  DROP_MESSAGES,
  EARLY_UNLOCK_ERRORS,
  EARLY_UNLOCK_MESSAGES,
  MATCH_CONTEXT_ERRORS,
} from '../../constants/introductions.constants.js';
import type {
  IntroIdParams,
  IntroHistoryQuery,
  DropIdParams,
} from '../../schemas/introductions/introductions.schema.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapIntroError(err: unknown, next: NextFunction): void {
  if (err instanceof IntroductionNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, INTRODUCTION_ERRORS.NOT_FOUND));
    return;
  }
  if (err instanceof IntroductionForbiddenError) {
    next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, INTRODUCTION_ERRORS.FORBIDDEN));
    return;
  }
  if (err instanceof IntroductionExpiredError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, INTRODUCTION_ERRORS.EXPIRED));
    return;
  }
  if (err instanceof IntroductionAlreadyRespondedError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, INTRODUCTION_ERRORS.ALREADY_RESPONDED));
    return;
  }
  next(err);
}

// ─── Drop error mapper ────────────────────────────────────────────────────────

function mapDropError(err: unknown, next: NextFunction): void {
  if (err instanceof IntroductionDropNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, DROP_ERRORS.NOT_FOUND));
    return;
  }
  if (err instanceof DropNotLiveError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, DROP_ERRORS.NOT_LIVE));
    return;
  }
  if (err instanceof InsufficientDiamondsForDropError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, DROP_ERRORS.INSUFFICIENT_DIAMONDS));
    return;
  }
  if (err instanceof AlreadyUnlockedError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, DROP_ERRORS.ALREADY_UNLOCKED));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const introductionsController = {
  /**
   * GET /api/v1/introductions
   * List this week's introductions for the authenticated user.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:list', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('List introductions', { userId });

      const intros = await listCurrentIntroductions(userId);

      const body: ApiResponse<typeof intros> = {
        success: true,
        data: intros,
        meta: { total: intros.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapIntroError(err, next);
    }
  },

  /**
   * GET /api/v1/introductions/history?page=&limit=
   * List historical introductions (all previous weeks).
   */
  async history(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:history', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { page, limit } = req.query as unknown as IntroHistoryQuery;

      log.info('List introduction history', { userId, page, limit });

      const result = await listIntroductionHistory(userId, page, limit);

      const body: ApiResponse<typeof result.intros> = {
        success: true,
        data: result.intros,
        meta: { total: result.total, page, limit },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapIntroError(err, next);
    }
  },

  /**
   * POST /api/v1/introductions/:introId/accept
   * Accept an introduction.
   */
  async accept(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:accept', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { introId } = req.params as unknown as IntroIdParams;

      log.info('Accept introduction', { userId, introId });

      const dto = await acceptIntroduction(introId, userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: INTRODUCTION_MESSAGES.ACCEPTED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapIntroError(err, next);
    }
  },

  /**
   * POST /api/v1/introductions/:introId/decline
   * Decline an introduction.
   */
  async decline(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:decline', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { introId } = req.params as unknown as IntroIdParams;

      log.info('Decline introduction', { userId, introId });

      const dto = await declineIntroduction(introId, userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: INTRODUCTION_MESSAGES.DECLINED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapIntroError(err, next);
    }
  },

  /**
   * GET /api/v1/introductions/:introId
   * Get full detail for a single introduction (INTRO-003).
   */
  async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:getDetail', requestId: req.requestId });
    try {
      const userId  = req.user!.id;
      const { introId } = req.params as unknown as IntroIdParams;
      log.info('Get introduction detail', { userId, introId });

      const dto = await getIntroductionDetail(introId, userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapIntroError(err, next);
    }
  },

  /**
   * POST /api/v1/introductions/unlock-early
   * Spend 300 diamonds to view this week's introductions before Sunday (INTRO-004).
   */
  async unlockEarly(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:unlockEarly', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Early unlock weekly introductions', { userId });

      const result = await earlyUnlockWeeklyIntros(userId);

      const body: ApiResponse<typeof result> = {
        success: true,
        data: result,
        meta: {
          message: result.alreadyUnlocked
            ? EARLY_UNLOCK_MESSAGES.ALREADY_UNLOCKED
            : EARLY_UNLOCK_MESSAGES.UNLOCKED,
        },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof EarlyUnlockInsufficientDiamondsError) {
        next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, EARLY_UNLOCK_ERRORS.INSUFFICIENT_DIAMONDS));
        return;
      }
      next(err);
    }
  },

  /**
   * GET /api/v1/profiles/:id/match-context
   * Returns compatibility score + dimension cards + why-this-match for any profile (INTRO-007).
   * Calls getMatchScore from cache; falls back to computeAndSaveScore if not yet computed.
   */
  async getMatchContext(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:matchContext', requestId: req.requestId });
    try {
      const viewerUserId  = req.user!.id;
      const profileUserId = req.params.id;

      if (viewerUserId === profileUserId) {
        next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION, MATCH_CONTEXT_ERRORS.CANNOT_SELF_MATCH));
        return;
      }

      log.info('Get match context', { viewerUserId, profileUserId });

      // ── 1. Cache lookup ─────────────────────────────────────────────────────
      const ctxCacheKey = CACHE_KEYS.MATCH_CONTEXT(viewerUserId, profileUserId);
      const cachedCtx = await cacheGet<unknown>(ctxCacheKey);
      if (cachedCtx) {
        const body: ApiResponse<unknown> = { success: true, data: cachedCtx, requestId: req.requestId };
        res.status(HTTP_STATUS.OK).json(body);
        return;
      }

      // ── 2. Resolve match score (cache → DB → compute) ──────────────────────
      let matchScore = await getMatchScore(viewerUserId, profileUserId);
      if (!matchScore) {
        try {
          matchScore = await computeAndSaveScore(viewerUserId, profileUserId);
        } catch (err) {
          if (err instanceof UserProfileMissingError) {
            next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, MATCH_CONTEXT_ERRORS.PROFILE_NOT_FOUND));
            return;
          }
          throw err;
        }
      }

      // ── 3. Generate why-this-match (LLM + rule-based fallback) ────────────
      const whyThisMatch = await generateWhyThisMatchLLM(
        viewerUserId,
        profileUserId,
        matchScore.breakdown,
        matchScore.totalScore,
      );

      const ctx = {
        totalScore: matchScore.totalScore,
        totalPct:   Math.round(matchScore.totalScore * 100),
        breakdown:  matchScore.breakdown,
        whyThisMatch,
        computedAt: matchScore.computedAt,
      };

      // ── 4. Cache the context 1 hour ────────────────────────────────────────
      cacheSet(ctxCacheKey, ctx, CACHE_TTL.MATCH_CONTEXT_SECONDS).catch(() => {/* swallow */});

      const body: ApiResponse<typeof ctx> = { success: true, data: ctx, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  // ── IntroductionDrop handlers ───────────────────────────────────────────────

  /**
   * GET /api/v1/introductions/drops
   * List all LIVE drops where the authenticated user has curated pairings.
   */
  async listDrops(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:listDrops', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('List drops for user', { userId });

      const drops = await listDropsForUser(userId);

      const body: ApiResponse<typeof drops> = {
        success: true,
        data: drops,
        meta: { total: drops.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapDropError(err, next);
    }
  },

  /**
   * GET /api/v1/introductions/drops/:dropId
   * Get drop detail with pairings (blurred until released or unlocked).
   */
  async getDropDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:getDropDetail', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { dropId } = req.params as unknown as DropIdParams;
      log.info('Get drop detail', { userId, dropId });

      const detail = await getDropDetail(dropId, userId);

      const body: ApiResponse<typeof detail> = {
        success: true,
        data: detail,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapDropError(err, next);
    }
  },

  /**
   * POST /api/v1/introductions/drops/:dropId/early-access
   * Pay earlyAccessCost diamonds to view profile cards before the drop releases.
   */
  async earlyAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:earlyAccess', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { dropId } = req.params as unknown as DropIdParams;
      log.info('Early access drop', { userId, dropId });

      const detail = await earlyAccessDrop(userId, dropId);

      const body: ApiResponse<typeof detail> = {
        success: true,
        data: detail,
        meta: { message: DROP_MESSAGES.EARLY_ACCESS_GRANTED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapDropError(err, next);
    }
  },

  /**
   * POST /api/v1/introductions/drops/:dropId/unlock
   * Pay incremental diamonds to fully unlock profiles before release.
   */
  async unlock(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:unlock', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { dropId } = req.params as unknown as DropIdParams;
      log.info('Unlock drop', { userId, dropId });

      const detail = await unlockDropEarly(userId, dropId);

      const body: ApiResponse<typeof detail> = {
        success: true,
        data: detail,
        meta: { message: DROP_MESSAGES.DROP_UNLOCKED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapDropError(err, next);
    }
  },
};
