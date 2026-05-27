import 'express';
import type { UserRole, AdminRole } from '@abroad-matrimony/shared';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    /** Set by requireAuth middleware — present on all protected user routes. */
    user?: {
      id: string;
      role: UserRole;
      deviceId: string;
    };
    /** Set by requireAdminRole middleware — present on all protected admin routes. */
    admin?: {
      id: string;
      role: AdminRole;
      email: string;
    };
  }
}
