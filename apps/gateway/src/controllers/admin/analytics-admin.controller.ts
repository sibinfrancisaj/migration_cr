import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  getKpiDashboard,
  getCohortRetention,
  getGroupAnalytics,
  getDropAnalytics,
  getAiAnalytics,
  getDiamondAnalytics,
  getMatchHealth,
  getUserMatches,
  getUserActivity,
} from '@abroad-matrimony/analytics';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { HTTP_STATUS } from '../../constants/index.js';

export const analyticsAdminController = {

  async getKpi(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:analytics:kpi', requestId: req.requestId });
    try {
      const { from, to } = req.query as Record<string, string | undefined>;
      log.info('Admin get KPI dashboard', { from, to });
      const data = await getKpiDashboard({ from, to });
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

  async getCohortRetention(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:analytics:cohort', requestId: req.requestId });
    try {
      const { from, to, granularity } = req.query as Record<string, string | undefined>;
      log.info('Admin get cohort retention', { from, to, granularity });
      const data = await getCohortRetention({ from, to, granularity: granularity as 'day' | 'week' | undefined });
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

  async getGroupAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:analytics:groups', requestId: req.requestId });
    try {
      const { from, to } = req.query as Record<string, string | undefined>;
      log.info('Admin get group analytics', { from, to });
      const data = await getGroupAnalytics({ from, to });
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

  async getDropAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:analytics:drops', requestId: req.requestId });
    try {
      const { from, to } = req.query as Record<string, string | undefined>;
      log.info('Admin get drop analytics', { from, to });
      const data = await getDropAnalytics({ from, to });
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

  async getAiAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:analytics:ai', requestId: req.requestId });
    try {
      const { from, to } = req.query as Record<string, string | undefined>;
      log.info('Admin get AI analytics', { from, to });
      const data = await getAiAnalytics({ from, to });
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

  async getDiamondAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:analytics:diamonds', requestId: req.requestId });
    try {
      const { from, to } = req.query as Record<string, string | undefined>;
      log.info('Admin get diamond analytics', { from, to });
      const data = await getDiamondAnalytics({ from, to });
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

  async getMatchHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:analytics:match-health', requestId: req.requestId });
    try {
      log.info('Admin get match health');
      const data = await getMatchHealth();
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

  async getUserMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:analytics:user-matches', requestId: req.requestId });
    try {
      const { userId } = req.params;
      const limit = Number(req.query['limit'] ?? 20);
      log.info('Admin get user matches', { userId });
      const data = await getUserMatches(userId!, limit);
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

  async getUserActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:analytics:user-activity', requestId: req.requestId });
    try {
      const { userId } = req.params;
      log.info('Admin get user activity', { userId });
      const data = await getUserActivity(userId!);
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },
};
