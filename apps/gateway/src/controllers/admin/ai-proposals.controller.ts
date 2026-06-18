import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { proposeIntroductionDrops, generateEventPreConnections } from '@abroad-matrimony/ai';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { HTTP_STATUS } from '../../constants/index.js';

export const aiProposalsController = {

  /**
   * POST /admin/ai/drops/propose
   * Trigger AI to generate DRAFT IntroductionDrops for a given region.
   * Body: { region: string }
   */
  async proposeDrops(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:ai:propose-drops', requestId: req.requestId });
    try {
      const { region } = req.body as { region: string };
      log.info('Admin AI propose drops', { region });
      const data = await proposeIntroductionDrops(region);
      const body: ApiResponse<typeof data> = { success: true, data, meta: { message: `${data.length} draft drops proposed by AI` }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

  /**
   * POST /admin/ai/events/:eventId/pre-connections
   * Trigger AI to generate pre-connection drops for an event 72h before it starts.
   * Path: { eventId: UUID }
   */
  async generatePreConnections(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:ai:pre-connections', requestId: req.requestId });
    try {
      const { eventId } = req.params;
      log.info('Admin AI generate event pre-connections', { eventId });
      const data = await generateEventPreConnections(eventId);
      const body: ApiResponse<typeof data> = {
        success: true,
        data,
        meta: { message: data ? 'Pre-connection drop created' : 'Not enough attendees for pre-connections' },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },
};
