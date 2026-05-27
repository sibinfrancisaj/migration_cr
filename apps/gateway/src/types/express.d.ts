import 'express';
import type { UserRole } from '@abroad-matrimony/shared';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    user?: {
      id: string;
      role: UserRole;
      deviceId: string;
    };
  }
}
