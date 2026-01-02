/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ASGARD_FLAG = 'YGGDRASIL{ASGARD:test-flag-for-testing}';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/asgard_test';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
