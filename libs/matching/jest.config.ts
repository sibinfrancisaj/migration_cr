export default {
  displayName: 'matching',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  coverageDirectory: '../../coverage/libs/matching',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
  ],

  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/src/index\\.ts$',
  ],

  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  coverageThreshold: {
    global: {
      statements: 95,
      branches:   85,
      functions:  90,
      lines:      95,
    },
  },
};
