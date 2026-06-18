import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listAdminEvents,
  getAdminEvent,
  createEvent,
  updateEvent,
  archiveEvent,
  EventAdminNotFoundError,
  EventAlreadyArchivedError,
} from '@abroad-matrimony/gatherings';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';

const EVENTS_ADMIN_ERRORS = {
  NOT_FOUND:       'Event not found',
  ALREADY_ARCHIVED: 'Event is already archived',
} as const;

function mapEventAdminError(err: unknown, next: NextFunction): void {
  if (err instanceof EventAdminNotFoundError)   { next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, EVENTS_ADMIN_ERRORS.NOT_FOUND)); return; }
  if (err instanceof EventAlreadyArchivedError) { next(new AppError(HTTP_STATUS.CONFLICT,  ERROR_CODES.CONFLICT,  EVENTS_ADMIN_ERRORS.ALREADY_ARCHIVED)); return; }
  next(err);
}

export const eventsAdminController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:events:list', requestId: req.requestId });
    try {
      const { status, limit, cursor } = req.query as Record<string, string | undefined>;
      log.info('Admin list events', { status });
      const result = await listAdminEvents({ status, limit: limit ? Number(limit) : undefined, cursor });
      const body: ApiResponse<typeof result> = { success: true, data: result, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapEventAdminError(err, next); }
  },

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:events:get', requestId: req.requestId });
    try {
      const { eventId } = req.params;
      log.info('Admin get event', { eventId });
      const data = await getAdminEvent(eventId);
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapEventAdminError(err, next); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:events:create', requestId: req.requestId });
    try {
      log.info('Admin create event');
      const data = await createEvent(
        req.body as Parameters<typeof createEvent>[0],
        req.admin!.id,
        req.ip ?? '',
      );
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) { mapEventAdminError(err, next); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:events:update', requestId: req.requestId });
    try {
      const { eventId } = req.params;
      log.info('Admin update event', { eventId });
      const data = await updateEvent(
        eventId,
        req.body as Parameters<typeof updateEvent>[1],
        req.admin!.id,
        req.ip ?? '',
      );
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapEventAdminError(err, next); }
  },

  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:events:archive', requestId: req.requestId });
    try {
      const { eventId } = req.params;
      log.info('Admin archive event', { eventId });
      await archiveEvent(eventId, req.admin!.id, req.ip ?? '');
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: 'Event archived' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapEventAdminError(err, next); }
  },
};
