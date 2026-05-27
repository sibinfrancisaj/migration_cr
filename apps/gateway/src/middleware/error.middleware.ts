import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { HTTP_STATUS, ERROR_CODES } from '../constants/index.js';

const log = createChildLogger({ module: 'gateway:error' });

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    const body: ApiResponse = {
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
      requestId,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  log.error('Unhandled error', { err: err.message, stack: err.stack, requestId });

  const body: ApiResponse = {
    success: false,
    error: { code: ERROR_CODES.INTERNAL, message: 'An unexpected error occurred' },
    requestId,
  };
  res.status(HTTP_STATUS.INTERNAL).json(body);
}
