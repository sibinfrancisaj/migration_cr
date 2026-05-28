import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from './error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../constants/index.js';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.flatten().fieldErrors as Record<string, unknown>;
      next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, 'Validation failed', details));
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validates `req.params` against a Zod schema.
 * On success, replaces `req.params` with the parsed (coerced) values.
 * On failure, passes a 400 VALIDATION_ERROR to next().
 *
 * Usage: router.put('/:questionKey', validateParams(paramsSchema), handler)
 */
/**
 * Validates `req.query` against a Zod schema.
 * On success, replaces `req.query` with the parsed (coerced) values.
 * On failure, passes a 400 VALIDATION_ERROR to next().
 *
 * Usage: router.get('/discover', validateQuery(discoverQuerySchema), handler)
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.flatten().fieldErrors as Record<string, unknown>;
      next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, 'Validation failed', details));
      return;
    }
    req.query = result.data as unknown as Record<string, string>;
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = result.error.flatten().fieldErrors as Record<string, unknown>;
      next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, 'Validation failed', details));
      return;
    }
    // Cast is safe — Zod has validated the shape; Express types req.params as Record<string, string>
    req.params = result.data as unknown as Record<string, string>;
    next();
  };
}
