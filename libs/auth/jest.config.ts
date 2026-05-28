export default {
  displayName: 'auth',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  coverageDirectory: '../../coverage/libs/auth',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
  ],

  // coveragePathIgnorePatterns uses regex matched against absolute file paths.
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/src/index\\.ts$',     // barrel re-export — no logic; always 0% because consuming
                            // projects mock @abroad-matrimony/auth at the module boundary
    '/adapters/index\\.ts$', // adapter factory barrel (tested separately via factory tests)
  ],

  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  coverageThreshold: {
    global: {
      statements: 95,
      branches: 85,
      functions: 90,
      lines: 95,
    },
  },
};
