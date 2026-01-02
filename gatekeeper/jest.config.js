module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/middleware/**',
    '!src/routes/**',
    '!src/utils/logger.ts',
    '!src/utils/metrics.ts',
    '!src/services/logger.ts',
    '!src/services/progression-client.ts',
    '!src/models/**',
    '!src/config/realms-metadata.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
