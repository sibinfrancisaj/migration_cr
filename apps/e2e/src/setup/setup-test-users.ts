/**
 * setupFilesAfterFramework — runs once per test file inside the Jest transform
 * context, so @abroad-matrimony/db path aliases resolve correctly.
 *
 * Auto-discovers seeded user IDs from the DB and writes them into process.env
 * so that getJourneyContext() can read them.
 *
 * Only runs when E2E_ENABLED=true AND the IDs are not already set.
 */

import { isE2eEnabled } from '../lib/env.js';
import { prisma } from '@abroad-matrimony/db';

beforeAll(async () => {
  if (!isE2eEnabled()) return;

  const needsUserA = !process.env['E2E_USER_A_ID'];
  const needsUserB = !process.env['E2E_USER_B_ID'];
  const needsAdmin = !process.env['E2E_ADMIN_USER_ID'];

  if (!needsUserA && !needsUserB && !needsAdmin) return;

  try {
    if (needsUserA || needsUserB) {
      const seededUsers = await prisma.user.findMany({
        where:   { isSeeded: true, role: 'MEMBER' },
        select:  { id: true },
        orderBy: { createdAt: 'asc' },
        take:    2,
      });

      if (seededUsers.length < 2) {
        throw new Error(
          `[e2e] Need ≥ 2 seeded MEMBER users, found ${seededUsers.length}. ` +
          'Run: POST http://localhost:3100/seed/run',
        );
      }

      if (needsUserA) process.env['E2E_USER_A_ID'] = seededUsers[0]!.id;
      if (needsUserB) process.env['E2E_USER_B_ID'] = seededUsers[1]!.id;
    }

    if (needsAdmin) {
      const admin = await prisma.user.findFirst({
        where:  { role: 'SUPERADMIN' },
        select: { id: true },
      });
      if (admin) process.env['E2E_ADMIN_USER_ID'] = admin.id;
    }
  } finally {
    await prisma.$disconnect();
  }
}, 15000);
