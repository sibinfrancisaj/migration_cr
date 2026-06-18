import type { Config } from 'jest';

const config: Config = {
  displayName: 'ai',
  preset: '../../jest.preset.js',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@abroad-matrimony/shared$': '<rootDir>/../../libs/shared/src/index.ts',
    '^@abroad-matrimony/config$': '<rootDir>/../../libs/config/src/index.ts',
    '^@abroad-matrimony/logger$': '<rootDir>/../../libs/logger/src/index.ts',
    '^@abroad-matrimony/db$': '<rootDir>/../../libs/db/src/index.ts',
  },
};

export default config;
