import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listEvents,
  getEvent,
  rsvpToEvent,
  cancelRsvp,
  getEventAttendees,
  getEventCalendar,
  getCoAttendancePairs,
  EventNotFoundError,
  AlreadyRsvpdError,
  NotRsvpdError,
  EventFullError,
  EventNotUpcomingError,
} from '@abroad-matrimony/gatherings';
import { enqueueScoreRecompute } from '@abroad-matrimony/matching';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { EVENT_ERRORS, EVENT_MESSAGES } from '../../constants/events.constants.js';
import type { EventIdParams, ListEventsQuery } from '../../schemas/events/events.schema.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapEventError(err: unknown, next: NextFunction): void {
  if (err instanceof EventNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, EVENT_ERRORS.NOT_FOUND));
    return;
  }
  if (err instanceof AlreadyRsvpdError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, EVENT_ERRORS.ALREADY_RSVPD));
    return;
  }
  if (err instanceof NotRsvpdError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, EVENT_ERRORS.RSVP_NOT_FOUND));
    return;
  }
  if (err instanceof EventFullError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, EVENT_ERRORS.EVENT_FULL));
    return;
  }
  if (err instanceof EventNotUpcomingError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, EVENT_ERRORS.NOT_UPCOMING));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const eventsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:events:list', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { tag, limit, upcoming } = req.query as unknown as ListEventsQuery;

      log.info('List events', { userId, tag, limit, upcoming });

      const events = await listEvents(userId, { tag, limit, upcoming });

      const body: ApiResponse<typeof events> = {
        success: true,
        data: events,
        meta: { total: events.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapEventError(err, next);
    }
  },

  /**
   * GET /api/v1/events/calendar
   * Returns this week's milestone schedule (EVENT-006).
   */
  async calendar(_req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:events:calendar', requestId: _req.requestId });
    try {
      log.info('Get event calendar');

      const milestones = await getEventCalendar();

      const body: ApiResponse<typeof milestones> = {
        success: true,
        data: milestones,
        meta: { total: milestones.length, message: EVENT_MESSAGES.CALENDAR_RETRIEVED },
        requestId: _req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /admin/events/:eventId/process-attendance
   * Records co-attending user pairs and enqueues a batch score recompute (EVENT-007).
   */
  async processAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:events:processAttendance', requestId: req.requestId });
    try {
      const { eventId } = req.params as unknown as EventIdParams;
      log.info('Process post-event co-attendance', { eventId });

      const pairs = await getCoAttendancePairs(eventId);

      // Enqueue one global score recompute — picks up all stale pairs including co-attendees
      if (pairs.length > 0) {
        const { getEnv } = await import('@abroad-matrimony/config');
        const env = getEnv();
        await enqueueScoreRecompute(env.REDIS_URL, { requestedBy: req.user?.id, force: false });
        log.info('processAttendance — recompute enqueued', { eventId, pairCount: pairs.length });
      }

      const body: ApiResponse<{ pairsFound: number }> = {
        success: true,
        data: { pairsFound: pairs.length },
        meta: { message: EVENT_MESSAGES.ATTENDANCE_PROCESSED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapEventError(err, next);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:events:getOne', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { eventId } = req.params as unknown as EventIdParams;

      log.info('Get event', { userId, eventId });

      const event = await getEvent(eventId, userId);

      const body: ApiResponse<typeof event> = {
        success: true,
        data: event,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapEventError(err, next);
    }
  },

  async rsvp(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:events:rsvp', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { eventId } = req.params as unknown as EventIdParams;

      log.info('RSVP to event', { userId, eventId });

      await rsvpToEvent(eventId, userId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: EVENT_MESSAGES.RSVP_CONFIRMED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapEventError(err, next);
    }
  },

  async cancelRsvp(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:events:cancel-rsvp', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { eventId } = req.params as unknown as EventIdParams;

      log.info('Cancel RSVP', { userId, eventId });

      await cancelRsvp(eventId, userId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: EVENT_MESSAGES.RSVP_CANCELLED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapEventError(err, next);
    }
  },

  async attendees(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:events:attendees', requestId: req.requestId });
    try {
      const { eventId } = req.params as unknown as EventIdParams;

      log.info('Get event attendees', { eventId });

      const attendees = await getEventAttendees(eventId);

      const body: ApiResponse<typeof attendees> = {
        success: true,
        data: attendees,
        meta: { total: attendees.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapEventError(err, next);
    }
  },
};
