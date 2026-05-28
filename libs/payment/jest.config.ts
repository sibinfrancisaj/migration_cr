export default {
  displayName: 'payment',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  coverageDirectory: '../../coverage/libs/payment',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/stripe.payment.adapter.ts',    // requires live Stripe — tested via integration
    '!src/**/razorpay.payment.adapter.ts',  // requires live Razorpay — tested via integration
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
