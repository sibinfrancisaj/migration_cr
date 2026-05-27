import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { revokeForDevice, revokeAllForUser } from '@abroad-matrimony/auth';
import { HTTP_STATUS } from '../../constants/index.js';

export const logoutController = {
  /**
   * POST /api/v1/auth/logout
   * Revokes all active refresh tokens for the caller's current device.
   * Requires requireAuth middleware — req.user is guaranteed present.
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:logout', requestId: req.requestId });
    try {
      // req.user is set by requireAuth — destructure with confidence
      const { id: userId, deviceId } = req.user!;

      await revokeForDevice(userId, deviceId);

      log.info('User logged out (device revoked)', { userId, deviceId });

      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/logout/all
   * Revokes all active refresh tokens for the caller across every device.
   * Requires requireAuth middleware — req.user is guaranteed present.
   */
  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:logout-all', requestId: req.requestId });
    try {
      const { id: userId } = req.user!;

      await revokeAllForUser(userId);

      log.info('User logged out from all devices', { userId });

      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  },
};
