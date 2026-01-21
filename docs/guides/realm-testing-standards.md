# Realm Testing Standards

This document defines the testing requirements and standards for all Project Yggdrasil realms.

## Overview

All realms must include comprehensive testing that covers:
- **Unit tests** for non-vulnerable code paths
- **Integration tests** for exploit verification
- **Coverage requirements** of ≥70% for non-challenge code

**Important:** The vulnerability itself should **not** be tested in unit tests. Integration tests verify that the exploit works end-to-end.

---

## Unit Testing Requirements

### What to Test

✅ **Required Unit Tests:**

1. **Configuration Loading**
   - Environment variable parsing
   - Default value handling
   - Validation logic (port ranges, flag format)
   - Error handling for invalid config

2. **Health Endpoint**
   - Returns 200 status
   - Includes required fields (status, realm, timestamp)
   - Responds correctly under all conditions

3. **Non-Challenge Routes**
   - Normal operation flows
   - Input validation for non-vulnerable endpoints
   - Error responses for invalid requests

4. **Helper Functions & Services**
   - Utility functions
   - Data transformations
   - Business logic (excluding vulnerability)

❌ **What NOT to Test:**

- The vulnerability itself
- Exploit paths
- Security failures (these are intentional)
- Error conditions that expose flags

### Unit Test Structure

```typescript
// tests/unit/config.test.ts
describe('loadConfig', () => {
  it('should load default configuration', () => {
    const config = loadConfig();
    expect(config.port).toBe(3000);
    expect(config.flag).toContain('YGGDRASIL{');
  });

  it('should validate port range', () => {
    process.env.PORT = '70000';
    expect(() => loadConfig()).toThrow('Invalid PORT');
  });
});
```

### Coverage Requirements

- **Minimum:** 70% coverage for all non-vulnerable code
- **Measurement:** Lines, branches, functions, statements
- **Exclusions:** 
  - Entry point (`src/index.ts`)
  - TypeScript definition files (`.d.ts`)
  - Intentionally vulnerable code paths (document exclusions)

### Running Unit Tests

```bash
npm test                    # Run all tests
npm run test:coverage       # With coverage report
npm run test:watch          # Watch mode for development
```

---

## Integration Testing Requirements

### What to Test

✅ **Required Integration Tests:**

1. **Exploit Path End-to-End**
   - Complete attack flow from start to flag retrieval
   - Verify flag format matches `YGGDRASIL{REALM:UUID}`
   - Test all steps in the exploit chain

2. **Flag Submission**
   - Flag submission via gatekeeper works
   - Progression state updates correctly
   - Next realm unlocks as expected

3. **Network Isolation**
   - Direct container access fails (connection refused)
   - Only gatekeeper can proxy to realm

4. **Edge Cases**
   - Exploit variations
   - Boundary conditions
   - Error handling in exploit path

### Integration Test Structure

```typescript
// tests/integration/exploit.test.ts
describe('Exploit Path', () => {
  it('should retrieve flag via vulnerability', async () => {
    // Step 1: Perform exploit
    const response = await fetch('http://localhost:3000/api/vulnerable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: 'malicious-input' }),
    });

    // Step 2: Verify flag retrieval
    const data = await response.json();
    expect(data.flag).toMatch(/^YGGDRASIL\{[A-Z]+:[a-f0-9-]+\}$/i);
  });

  it('should fail gracefully for invalid exploit attempts', async () => {
    const response = await fetch('http://localhost:3000/api/vulnerable', {
      method: 'POST',
      body: JSON.stringify({ payload: 'normal-input' }),
    });

    expect(response.status).not.toBe(500);
  });
});
```

### Running Integration Tests

```bash
# Requires services to be running
docker-compose up -d <realm-name>

# Run integration tests
npm run test:integration

# Or via script
./scripts/test-<realm-name>.sh
```

---

## Test Organization

### Directory Structure

```
tests/
├── unit/
│   ├── config.test.ts          # Configuration tests
│   ├── health.test.ts          # Health endpoint tests
│   ├── services/               # Service layer tests
│   └── middleware/             # Middleware tests
└── integration/
    └── exploit.test.ts         # End-to-end exploit tests
```

### Naming Conventions

- **Unit tests:** `<module>.test.ts`
- **Integration tests:** `exploit.test.ts` or `<feature>.integration.test.ts`
- **Test descriptions:** Use clear, descriptive strings
  - Good: `'should validate flag format correctly'`
  - Bad: `'test flag'`

---

## Testing Tools

### Jest Configuration

All realms use Jest as the test runner with the following configuration:

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### Recommended Libraries

- **Jest**: Test runner and assertion library
- **Supertest**: HTTP testing for Express apps
- **ts-jest**: TypeScript support for Jest
- **@types/jest**: TypeScript definitions

---

## Per-Realm Test Script

Each realm should include a shell script for automated testing:

```bash
#!/bin/bash
# scripts/test-<realm-name>.sh

set -e

echo "Testing <REALM-NAME> Realm"

# Step 1: Test via gatekeeper proxy
echo "Step 1: Triggering exploit..."
RESPONSE=$(curl -s -X POST http://localhost:8080/realms/<realm-name>/api/vulnerable \
  -H "Content-Type: application/json" \
  -d '{"payload": "exploit"}')

# Step 2: Extract flag
FLAG=$(echo $RESPONSE | jq -r '.flag' | grep -oP 'YGGDRASIL\{[^}]+\}')

if [ -z "$FLAG" ]; then
  echo "❌ Failed to retrieve flag"
  exit 1
fi

echo "✅ Flag retrieved: $FLAG"

# Step 3: Validate flag format
if ! echo "$FLAG" | grep -qP '^YGGDRASIL\{[A-Z]+:[a-f0-9-]+\}$'; then
  echo "❌ Invalid flag format"
  exit 1
fi

echo "✅ Flag format valid"

# Step 4: Test flag submission (optional)
USER_ID="test-user-$(date +%s)"
SUBMIT_RESPONSE=$(curl -s -X POST http://localhost:8080/submit-flag \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"flag\":\"$FLAG\"}")

echo "Submit response: $SUBMIT_RESPONSE"

echo "✅ All tests passed for <REALM-NAME>"
```

---

## Continuous Integration

### GitHub Actions

All tests must pass in CI before merging:

```yaml
# .github/workflows/ci.yml (excerpt)
- name: Run Realm Tests
  run: |
    cd realms/<realm-name>
    npm install
    npm test
    npm run lint
```

### Pre-Commit Hooks

Optional but recommended:

```bash
# .git/hooks/pre-commit
#!/bin/bash
npm test
npm run lint
```

---

## Common Testing Patterns

### Mocking Configuration

```typescript
const mockConfig: RealmConfig = {
  port: 3000,
  flag: 'YGGDRASIL{TEST:00000000-0000-0000-0000-000000000000}',
  realmName: 'test-realm',
  nodeEnv: 'test',
};
```

### Testing Express Routes

```typescript
import express from 'express';
import request from 'supertest';

describe('Route Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(createRouter(mockConfig));
  });

  it('should return expected response', async () => {
    const response = await request(app).get('/api/endpoint');
    expect(response.status).toBe(200);
  });
});
```

### Testing Async Operations

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

---

## Test Quality Checklist

Before considering tests complete, verify:

- [ ] All unit tests pass
- [ ] Coverage ≥70% for non-vulnerable code
- [ ] Integration test successfully exploits vulnerability
- [ ] Flag format validated
- [ ] Test script works from clean environment
- [ ] Tests are independent (no shared state)
- [ ] Tests are deterministic (no random failures)
- [ ] Error messages are clear and helpful
- [ ] Tests document expected behavior

---

## Troubleshooting

### Tests Fail Locally

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild TypeScript
npm run build

# Run with verbose output
npm test -- --verbose
```

### Coverage Below Threshold

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/index.html

# Identify uncovered lines and add tests
```

### Integration Tests Timeout

```bash
# Increase timeout in jest.config.js
testTimeout: 30000

# Or per-test
it('long test', async () => { ... }, 30000);
```

---

## Appendix: Example Test Suite

### Complete Unit Test Example

```typescript
// tests/unit/config.test.ts
import { loadConfig } from '../../src/config';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('loads defaults correctly', () => {
      const config = loadConfig();
      expect(config.port).toBe(3000);
      expect(config.nodeEnv).toBe('development');
    });

    it('parses custom port', () => {
      process.env.PORT = '8080';
      expect(loadConfig().port).toBe(8080);
    });

    it('throws on invalid port', () => {
      process.env.PORT = 'invalid';
      expect(() => loadConfig()).toThrow();
    });
  });
});
```

### Complete Integration Test Example

```typescript
// tests/integration/exploit.test.ts
describe('Niflheim Exploit Path', () => {
  const BASE_URL = 'http://localhost:8080/realms/niflheim';

  it('retrieves flag via exception handling vulnerability', async () => {
    // Exploit: Send impossible pressure value
    const response = await fetch(`${BASE_URL}/api/pressure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pressure: -9999 }),
    });

    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toContain('YGGDRASIL{');
    
    const flag = data.error.match(/YGGDRASIL\{[^}]+\}/)[0];
    expect(flag).toMatch(/^YGGDRASIL\{NIFLHEIM:[a-f0-9-]+\}$/i);
  });
});
```

---

**Applies To:** All Project Yggdrasil realms
