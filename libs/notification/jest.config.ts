export default {
  displayName: 'notification',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  coverageDirectory: '../../coverage/libs/notification',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/firebase.push.adapter.ts', // requires live Firebase — tested via integration
  ],

  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/src/index\\.ts$',
  ],

  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  coverageThreshold: {
    global: {
      statements: 85,
      branches:   75,
      functions:  80,
      lines:      85,
    },
  },
};
