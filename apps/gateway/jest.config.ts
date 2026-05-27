export default {
  displayName: 'gateway',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@abroad-matrimony/shared$': '<rootDir>/../../libs/shared/src/index.ts',
    '^@abroad-matrimony/config$': '<rootDir>/../../libs/config/src/index.ts',
    '^@abroad-matrimony/logger$': '<rootDir>/../../libs/logger/src/index.ts',
    '^@abroad-matrimony/cache$': '<rootDir>/../../libs/cache/src/index.ts',
    '^@abroad-matrimony/db$': '<rootDir>/../../libs/db/src/index.ts',
    '^@abroad-matrimony/event-bus$': '<rootDir>/../../libs/event-bus/src/index.ts',
    '^@abroad-matrimony/auth$': '<rootDir>/../../libs/auth/src/index.ts',
    '^@abroad-matrimony/profile$': '<rootDir>/../../libs/profile/src/index.ts',
  },
  coverageDirectory: '../../coverage/apps/gateway',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
  ],

  // coveragePathIgnorePatterns uses regex matched against absolute file paths.
  // More reliable than collectCoverageFrom negation globs across Jest versions.
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'server\\.ts$',            // HTTP listener entry point — not unit-testable
    'health\\.route\\.ts$',    // DB/Redis health checks — integration/E2E territory
    '/types/',                 // type-only declarations (express.d.ts), no runtime code
  ],

  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  coverageThresholds: {
    global: {
      statements: 90,
      branches: 80,
      functions: 85,
      lines: 90,
    },
  },
};
