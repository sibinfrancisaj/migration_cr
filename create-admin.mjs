import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bcrypt  = require('bcrypt');

const prisma = new PrismaClient();

const email    = 'admin@test.com';
const password = 'Admin1234!';

const hash = await bcrypt.hash(password, 12);

const user = await prisma.adminUser.create({
  data: { name: 'Admin', email, passwordHash: hash, role: 'SUPERADMIN' },
});

console.log('✅ Admin created:', user.email, '| role:', user.role);
await prisma.$disconnect();
