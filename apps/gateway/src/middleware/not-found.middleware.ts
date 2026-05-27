import type { Request, Response } from 'express';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { HTTP_STATUS, ERROR_CODES } from '../constants/index.js';

export function notFoundMiddleware(_req: Request, res: Response): void {
  const body: ApiResponse = {
    success: false,
    error: { code: ERROR_CODES.NOT_FOUND, message: 'Route not found' },
  };
  res.status(HTTP_STATUS.NOT_FOUND).json(body);
}
