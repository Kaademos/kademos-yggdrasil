# Niflheim (Realm 10)

**OWASP Category:** A10:2025 - Exceptional Conditions  
**Difficulty:** Easy (Entry Level)  
**Tech Stack:** Node.js/Express, TypeScript, Vanilla JavaScript  
**Theme:** Cryo-Stasis Facility in frozen wasteland

## Overview

Niflheim is the first realm in Project Yggdrasil, serving as the entry point for users. It demonstrates the A10:2025 Exceptional Conditions vulnerability through a fail-open error handling mechanism in a cryo-facility pressure regulation system.

## Vulnerability Description

### A10:2025 - Exceptional Conditions (Fail-Open)

The pressure regulator API endpoint fails to properly handle exceptional input values. When the system receives "impossible" pressure readings (negative values, extremely high values, or non-numeric inputs), it throws an unhandled exception that:

1. **Exposes sensitive information** - The error message includes the access code (flag)
2. **Fails open** - System defaults to an insecure state rather than failing closed
3. **Lacks proper validation** - No input sanitization or boundary checks before processing

This represents a common real-world vulnerability where error handling reveals too much information and systems fail insecurely under exceptional conditions.

## Exploit Path

### Step-by-Step Exploitation

1. **Access the realm** via gatekeeper:
   ```bash
   curl http://localhost:8080/realms/niflheim/
   ```

2. **Trigger the vulnerability** by submitting an impossible pressure value:
   ```bash
   curl -X POST http://localhost:8080/realms/niflheim/api/pressure \
     -H "Content-Type: application/json" \
     -d '{"pressure": -9999}'
   ```

3. **Extract the flag** from the error response:
   ```json
   {
     "error": "CRITICAL ERROR: Impossible pressure detected: -9999. Cryo-system integrity compromised. EMERGENCY OVERRIDE ENGAGED. Chamber 42 unlocked. Access Code: YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}"
   }
   ```

4. **Submit the flag** to progress:
   ```bash
   curl -X POST http://localhost:8080/submit-flag \
     -H "Content-Type: application/json" \
     -d '{"userId":"your-user-id","flag":"YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}"}'
   ```

### Alternative Exploitation Methods

The vulnerability can be triggered with various inputs:
- **Negative pressure**: `-1`, `-9999`, `-999999`
- **Extremely high pressure**: `999999`, `1000000`
- **Non-numeric values**: `"not-a-number"`, `"abc"`, `null`
- **Special values**: `Infinity`, `-Infinity`, `NaN`

## Technical Details

### Vulnerable Code

Located in `src/routes/pressure.ts`:

```typescript
router.post('/api/pressure', (req: Request, res: Response) => {
  const { pressure } = req.body;
  const pressureValue = typeof pressure === 'string' ? parseFloat(pressure) : pressure;

  // VULNERABILITY: No proper validation or error handling
  if (pressureValue > 100 || pressureValue < 0 || isNaN(pressureValue)) {
    // FAIL-OPEN: Exception exposes flag
    throw new Error(
      `CRITICAL ERROR: Impossible pressure detected: ${pressure}. ` +
      `Cryo-system integrity compromised. ` +
      `EMERGENCY OVERRIDE ENGAGED. ` +
      `Chamber ${Math.floor(Math.random() * 100)} unlocked. ` +
      `Access Code: ${config.flag}`
    );
  }

  // Normal operation continues...
});
```

### Why It's Vulnerable

1. **No input validation** - Accepts any value without sanitization
2. **Unhandled exceptions** - Throws errors instead of returning controlled error responses
3. **Information disclosure** - Error messages contain sensitive data (flag)
4. **Fail-open behavior** - System assumes emergency unlock on error

### Proper Fix (Educational)

In a real system, this should be fixed by:

```typescript
// Proper validation
if (typeof pressure !== 'number' || isNaN(pressure)) {
  return res.status(400).json({
    error: 'Invalid pressure value',
    message: 'Pressure must be a valid number'
  });
}

// Range validation
if (pressure < 0 || pressure > 100) {
  return res.status(400).json({
    error: 'Pressure out of range',
    message: 'Pressure must be between 0-100 PSI'
  });
}

// Log errors without exposing sensitive data
try {
  // Process request
} catch (error) {
  logger.error('Pressure system error', { error });
  return res.status(500).json({
    error: 'Internal server error',
    message: 'System is unavailable'
  });
}
```

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "realm": "niflheim",
  "timestamp": "2025-12-11T..."
}
```

### `GET /api/status`
Returns current system state.

**Response:**
```json
{
  "currentPressure": 50,
  "doorStatus": "LOCKED",
  "timestamp": "2025-12-11T..."
}
```

### `POST /api/pressure` (VULNERABLE)
Updates pressure regulator.

**Request:**
```json
{
  "pressure": 50
}
```

**Normal Response (200):**
```json
{
  "message": "Pressure updated successfully",
  "state": {
    "currentPressure": 50,
    "doorStatus": "LOCKED",
    "timestamp": "2025-12-11T..."
  }
}
```

**Error Response (500) - Exploit:**
```json
{
  "error": "CRITICAL ERROR: ... Access Code: YGGDRASIL{NIFLHEIM:...}"
}
```

## UI Features

The Niflheim UI includes:

- **Cryo-facility theme** - Icy blue gradient with cyber aesthetics
- **System status display** - Real-time pressure, door status, timestamp
- **Interactive pressure regulator** - Number input with update button
- **Visual feedback** - Success/error messages with distinct styling
- **Responsive design** - Works on desktop and mobile

## Development

### Local Setup

```bash
cd realms/niflheim
npm install
npm run dev
```

The realm will be available at `http://localhost:3000` (containerized port, not exposed to host).

### Running Tests

```bash
# Unit tests only
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Linting
npm run lint
npm run lint:fix
```

### Building

```bash
npm run build
npm start
```

### Docker

```bash
# Build image
docker build -t niflheim .

# Run container
docker run -p 3000:3000 \
  -e FLAG=YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf} \
  niflheim
```

## Testing

### Unit Tests

**Coverage: 93.33%** (exceeds 70% threshold)

Tests cover:
- ✅ Configuration loading and validation
- ✅ Health endpoint functionality
- ✅ Pressure status endpoint
- ✅ Valid pressure update operations
- ✅ Boundary value handling
- ✅ Normal error handling

**Note:** The vulnerability itself is NOT tested in unit tests (by design).

### Integration Tests

Integration tests verify the exploit path and require running services:

```bash
# Start services (use 'make yggdrasil' for first-time setup)
make up

# Run integration test script
./scripts/test-niflheim.sh

# Or manually test
curl -X POST http://localhost:8080/realms/niflheim/api/pressure \
  -H "Content-Type: application/json" \
  -d '{"pressure": -9999}'
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Internal container port |
| `FLAG` | Yes | Default UUID | Realm flag in format `YGGDRASIL{NIFLHEIM:UUID}` |
| `REALM_NAME` | No | `niflheim` | Realm identifier |
| `NODE_ENV` | No | `development` | Environment mode (development/production) |

## Network Isolation

Niflheim runs in an isolated Docker network (`niflheim_net`):

- ✅ Only accessible via gatekeeper proxy at `/realms/niflheim/*`
- ✅ Direct access to port 3000 is blocked from host
- ✅ No communication with other realms
- ✅ Gatekeeper is the only service with network access

## Security Notes

### What This Realm Teaches

1. **Input validation is critical** - All user input must be validated before processing
2. **Fail-safe, not fail-open** - Systems should fail securely when errors occur
3. **Error messages must not leak data** - Generic errors for users, detailed logs for operators
4. **Exception handling matters** - Unhandled exceptions can expose system internals
5. **Defense in depth** - Multiple layers of validation and error handling

### Real-World Examples

This vulnerability pattern appears in:
- **APIs with verbose error messages** - Exposing stack traces, config, or database errors
- **Authentication systems** - Failing open on errors ("allow access when unsure")
- **Payment systems** - Releasing funds when validation fails
- **Access control** - Granting access on system errors

## Files Structure

```
niflheim/
├── Dockerfile                  # Container configuration
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── jest.config.js              # Test configuration
├── .eslintrc.js                # Linting rules
├── README.md                   # This file
├── src/
│   ├── index.ts                # Application entry point
│   ├── config/
│   │   └── index.ts            # Configuration management
│   ├── routes/
│   │   ├── health.ts           # Health check endpoint
│   │   └── pressure.ts         # Vulnerable pressure API
│   └── middleware/
│       └── logging.ts          # Request/error logging
└── tests/
    ├── unit/
    │   ├── config.test.ts      # Config tests
    │   ├── health.test.ts      # Health endpoint tests
    │   └── pressure.test.ts    # Pressure API tests (non-vulnerable paths)
    └── integration/
        └── exploit.test.ts     # End-to-end exploit tests
```

## Troubleshooting

### TypeScript Errors

```bash
npm run build
# Fix errors, then rebuild
```

### Tests Failing

```bash
# Check if services are running (for integration tests)
docker ps

# Run with verbose output
npm test -- --verbose

# Check specific test file
npm test -- tests/unit/pressure.test.ts
```

### Flag Not Revealing

Ensure you're sending an invalid pressure value:
- Must be < 0 or > 100
- Or non-numeric (NaN, string, null)

### Cannot Access Realm

Ensure services are running:
```bash
make yggdrasil  # or 'make up' if already setup
curl http://localhost:8080/realms/niflheim/health
```

## Learning Resources

- [OWASP Top 10:2025 - A10 Exceptional Conditions](https://owasp.org/)
- [CWE-209: Information Exposure Through Error Messages](https://cwe.mitre.org/data/definitions/209.html)
- [CWE-755: Improper Handling of Exceptional Conditions](https://cwe.mitre.org/data/definitions/755.html)
- [Fail-Safe vs Fail-Secure Design Principles](https://en.wikipedia.org/wiki/Fail-safe)

## Next Realm

After capturing Niflheim's flag and submitting it, **Helheim** (Realm 9) will be unlocked, featuring A09:2025 Logging & Alerting Failures.

---

**Flag Format:** `YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}`  
**Realm Level:** 10 (Entry)  
**Implemented:** Milestone 3, Phase 1
