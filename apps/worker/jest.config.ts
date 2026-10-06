import type { Config } from 'jest';

const config: Config = {
  displayName: 'worker',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
};

export default config;
