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
  },
  coverageDirectory: '../../coverage/apps/gateway',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
};
