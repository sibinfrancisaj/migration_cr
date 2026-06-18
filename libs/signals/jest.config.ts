export default {
  displayName: 'signals',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
};
