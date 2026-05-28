import 'express';
import type { UserRole, AdminRole } from '@abroad-matrimony/shared';

/**
 * Express Request augmentation for libs/auth middleware.
 *
 * Mirrors apps/gateway/src/types/express.d.ts so that TypeScript resolves
 * req.requestId / req.user / req.admin correctly when compiling auth
 * middleware in this library's own tsconfig context.
 *
 * TypeScript merges these declarations at the project level — having the
 * same augmentation in both places is intentional and safe.
 */
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
