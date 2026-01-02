# Helheim (Realm 9)

**OWASP Category:** A09:2025 - Logging & Alerting Failures  
**Difficulty:** Easy-Medium  
**Tech Stack:** Node.js/Express, TypeScript, Static HTML/CSS/JS  
**Theme:** Dark underworld memorial forum

## Overview

Helheim demonstrates the A09:2025 Logging & Alerting Failures vulnerability through insecure logging practices that expose sensitive information in publicly accessible log files, combined with a complete lack of monitoring and alerting.

## Vulnerability Description

### A09:2025 - Logging & Alerting Failures

The memorial forum has three critical logging failures:

1. **Sensitive Data in Logs**: Error logs contain flags, system information, and request details
2. **Publicly Accessible Logs**: The `/temp_logs/` directory is served as static files via HTTP
3. **No Monitoring/Alerting**: Errors are logged silently with no alerts or notifications

This represents real-world scenarios where:
- Applications log too much information (PII, credentials, tokens)
- Log files are exposed through web servers or misconfigured storage
- Security incidents go undetected due to lack of monitoring

## Exploit Path

### Step-by-Step Exploitation

1. **Access the memorial forum**:
   ```bash
   curl http://localhost:8080/realms/helheim/
   ```

2. **Trigger an error** by submitting invalid data:
   ```bash
   curl -X POST http://localhost:8080/realms/helheim/api/memorial \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

3. **Access the public log directory**:
   ```bash
   curl http://localhost:8080/realms/helheim/temp_logs/error.log
   ```

4. **Extract the flag** from the log file:
   ```
   SENSITIVE DATA (Should NOT be in logs):
   - Realm: HELHEIM
   - Access Flag: YGGDRASIL{HELHEIM:e1a93eab-4720-4ef8-a2eb-342a77e9f200}
   ```

### Alternative Methods

- Submit memorial with **missing name**: `{"message":"test"}`
- Submit memorial with **missing message**: `{"name":"test"}`
- Submit memorial with **wrong types**: `{"name":123,"message":true}`
- Submit memorial with **too long content**: name >100 chars or message >500 chars

All validation errors are logged with the flag!

## API Endpoints

### `GET /health`
Health check endpoint.

### `GET /api/memorials`
Returns recent memorials.

**Response:**
```json
{
  "memorials": [...],
  "total": 2
}
```

### `POST /api/memorial` (VULNERABLE)
Creates a new memorial with weak validation that logs errors.

**Request:**
```json
{
  "name": "Name",
  "message": "Message"
}
```

**Triggers logging when:**
- Missing required fields
- Invalid types
- Content too long

### `GET /api/system-status`
Returns fake monitoring status (always "operational").

### `GET /temp_logs/` (VULNERABLE)
Publicly accessible log directory containing `error.log` with sensitive data.

## Vulnerable Code

Located in `src/routes/memorial.ts`:

```typescript
function logErrorToFile(error: Error, context: any, config: RealmConfig): void {
  const logFile = path.join(__dirname, '../../public/temp_logs/error.log');

  // VULNERABILITY: Logs contain sensitive information
  const logEntry = `
[${new Date().toISOString()}] ERROR
Error: ${error.message}
Stack Trace: ${error.stack}
Request Context: ${JSON.stringify(context, null, 2)}

SENSITIVE DATA (Should NOT be in logs):
- Access Flag: ${config.flag}
  `;

  // VULNERABILITY: No monitoring or alerting
  fs.appendFileSync(logFile, logEntry, 'utf-8');
}

// VULNERABILITY: Serve logs as static files
app.use('/temp_logs', express.static('public/temp_logs'));
```

### Why It's Vulnerable

1. **Over-logging**: Includes sensitive data (flags, tokens) in logs
2. **Public exposure**: Logs served via HTTP without authentication
3. **No sanitization**: Raw error messages and stack traces exposed
4. **No alerting**: Errors logged silently, no notifications
5. **No monitoring**: "System status" is fake, always shows green

### Proper Fix (Educational)

```typescript
// 1. Use structured logging with levels
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

// 2. Sanitize sensitive data
function sanitizeError(error: Error): object {
  return {
    message: error.message,
    // Do NOT include: stack, config, flags, tokens
  };
}

// 3. Never serve logs publicly
// Remove: app.use('/temp_logs', express.static(...));

// 4. Implement real monitoring
import { sendAlert } from './monitoring';

function handleError(error: Error) {
  logger.error(sanitizeError(error));
  
  // Alert on critical errors
  if (isCriticalError(error)) {
    sendAlert({
      severity: 'high',
      message: 'Critical error in memorial service',
    });
  }
}

// 5. Use log aggregation (ELK, Datadog, etc.)
// Centralize logs, never expose them via web server
```

## UI Features

- **Dark memorial theme** with purple/black gradient
- **System status indicator** (fake - always green)
- **Memorial list** with recent submissions
- **Create memorial form** with validation
- **Links to system logs** (intentionally vulnerable)

## Development

```bash
cd realms/helheim
npm install
npm run dev
```

## Testing

```bash
# Unit tests
npm test

# Build
npm run build

# Integration test (requires services running)
./scripts/test-helheim.sh
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Internal port |
| `FLAG` | Yes | Default | Flag in format `YGGDRASIL{HELHEIM:UUID}` |
| `REALM_NAME` | No | `helheim` | Realm identifier |
| `NODE_ENV` | No | `development` | Environment mode |

## Security Notes

### What This Realm Teaches

1. **Never log sensitive data** - No PII, credentials, tokens, or flags
2. **Never expose logs publicly** - Use proper log management systems
3. **Implement monitoring & alerting** - Detect and respond to errors quickly
4. **Sanitize error messages** - User-facing errors should be generic
5. **Use structured logging** - JSON format with proper log levels

### Real-World Examples

- **2019: Capital One breach** - Logs exposed AWS credentials
- **2018: Timehop breach** - Logs contained access tokens
- **2021: Multiple breaches** - `.git` and `.log` files exposed via web servers

## Files Structure

```
helheim/
├── src/
│   ├── index.ts
│   ├── config/
│   ├── routes/
│   │   ├── health.ts
│   │   └── memorial.ts (vulnerable logging)
│   └── public/
│       ├── index.html (dark memorial UI)
│       └── temp_logs/ (publicly accessible logs)
└── tests/
```

## Next Realm

After submitting Helheim's flag, **Svartalfheim** (Realm 8) unlocks, featuring A08:2025 Software/Data Integrity (insecure deserialization).

---

**Flag Format:** `YGGDRASIL{HELHEIM:e1a93eab-4720-4ef8-a2eb-342a77e9f200}`  
**Realm Level:** 9  
**Implemented:** Milestone 3, Phase 2
