import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listEvents,
  getEvent,
  rsvpToEvent,
  cancelRsvp,
  getEventAttendees,
  EventNotFoundError,
  AlreadyRsvpdError,
  NotRsvpdError,
  EventFullError,
  EventNotUpcomingError,
} from '@abroad-matrimony/gatherings';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { EventTag } from '@abroad-matrimony/shared';
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
      const { tag } = req.query as unknown as ListEventsQuery;

      log.info('List events', { userId, tag });

      const events = await listEvents(userId, tag as EventTag | undefined);

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
