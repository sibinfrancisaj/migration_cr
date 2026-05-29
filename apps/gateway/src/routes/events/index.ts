import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import {
  eventIdParamSchema,
  listEventsQuerySchema,
} from '../../schemas/events/events.schema.js';
import { eventsController } from '../../controllers/events/events.controller.js';

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

/** GET /api/v1/events?tag=SOCIAL|SPIRITUAL|... */
eventsRouter.get('/', validateQuery(listEventsQuerySchema), eventsController.list);

/** GET /api/v1/events/:eventId */
eventsRouter.get('/:eventId', validateParams(eventIdParamSchema), eventsController.getOne);

/** POST /api/v1/events/:eventId/rsvp */
eventsRouter.post('/:eventId/rsvp', validateParams(eventIdParamSchema), eventsController.rsvp);

/** DELETE /api/v1/events/:eventId/rsvp */
eventsRouter.delete('/:eventId/rsvp', validateParams(eventIdParamSchema), eventsController.cancelRsvp);

/** GET /api/v1/events/:eventId/attendees */
eventsRouter.get('/:eventId/attendees', validateParams(eventIdParamSchema), eventsController.attendees);
