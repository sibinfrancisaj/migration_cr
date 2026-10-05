import type { Config } from 'jest';

const config: Config = {
  displayName: 'e2e',
  testMatch: ['**/journeys/**/*.test.ts'],
  preset: '../../jest.preset.js',
  globalSetup: './src/setup/global-setup.ts',
  // setupFilesAfterEnv runs inside the Jest transform context, so path aliases work.
  // Used for Prisma-based test-user auto-discovery.
  setupFilesAfterEnv: ['./src/setup/setup-test-users.ts'],
  testTimeout: 30000,
  // E2E tests must run sequentially — they share real API state
  maxWorkers: 1,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@abroad-matrimony/shared$': '<rootDir>/../../libs/shared/src/index.ts',
    '^@abroad-matrimony/db$': '<rootDir>/../../libs/db/src/index.ts',
  },
};

export default config;
