import type { Request, Response } from 'express';
import { notFoundMiddleware } from '../not-found.middleware.js';

describe('notFoundMiddleware', () => {
  it('responds with 404 and NOT_FOUND error code', () => {
    const req = {} as Request;
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) } as unknown as Response;

    notFoundMiddleware(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  it('does not call next — terminates the chain', () => {
    const req = {} as Request;
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) } as unknown as Response;
    const next = jest.fn();

    // next is intentionally not a parameter of notFoundMiddleware
    notFoundMiddleware(req, res);

    expect(next).not.toHaveBeenCalled();
  });
});
