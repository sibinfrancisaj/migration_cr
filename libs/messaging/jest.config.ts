export default {
  displayName: 'messaging',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  coverageDirectory: '../../coverage/libs/messaging',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/firestore.messaging.adapter.ts', // requires live Firebase — tested via integration
  ],

  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/src/index\\.ts$',
  ],

  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  coverageThreshold: {
    global: {
      statements: 90,
      branches:   80,
      functions:  85,
      lines:      90,
    },
  },
};
