# Realm Template

This is the standardized template for all Yggdrasil realms. It provides a consistent structure, configuration pattern, and testing framework.

## Using This Template

### 1. Copy Template
```bash
cp -r realms/_template realms/<realm-name>
cd realms/<realm-name>
```

### 2. Update Configuration

**package.json:**
- Change `name` to `@yggdrasil/<realm-name>`
- Update `description` with realm details

**src/config/index.ts:**
- Update `realmName` default value
- Add realm-specific configuration fields
- Extend `RealmConfig` interface if needed

### 3. Implement Realm Logic

**Create realm-specific routes:**
```typescript
// src/routes/realm.ts
import { Router } from 'express';
import { RealmConfig } from '../config';

export function createRealmRouter(config: RealmConfig): Router {
  const router = Router();
  
  // Add your routes here
  router.get('/api/endpoint', (req, res) => {
    // Implement vulnerability here
  });
  
  return router;
}
```

**Mount in src/index.ts:**
```typescript
import { createRealmRouter } from './routes/realm';
app.use(createRealmRouter(config));
```

### 4. Customize Frontend

Create HTML/CSS/JS in `src/public/` or inline in routes.

### 5. Write Tests

**Unit tests (tests/unit/):**
- Test non-vulnerable logic
- Test configuration loading
- Test helper functions
- **Do NOT test the vulnerability itself** (by design)

**Integration tests (tests/integration/):**
- Test exploit path end-to-end
- Verify flag retrieval
- Test via HTTP requests

### 6. Update README

Replace this file with realm-specific documentation including:
- OWASP category
- Vulnerability description
- Exploit path overview
- Environment variables

## Directory Structure

```
<realm-name>/
├── Dockerfile              # Container configuration
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript configuration
├── jest.config.js          # Test configuration
├── .eslintrc.js            # Linting rules
├── README.md               # Realm documentation
├── src/
│   ├── index.ts            # Application entry point
│   ├── config/
│   │   └── index.ts        # Environment-based configuration
│   ├── routes/
│   │   ├── health.ts       # Health check endpoint
│   │   └── <realm>.ts      # Realm-specific routes
│   ├── middleware/
│   │   └── logging.ts      # Request/error logging
│   ├── services/           # Business logic
│   └── public/             # Static assets
└── tests/
    ├── unit/               # Unit tests
    └── integration/        # E2E exploit tests
```

## Development Commands

```bash
# Install dependencies
npm install

# Development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run in production mode
npm start

# Run tests
npm test

# Run tests with coverage
npm test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Internal container port |
| `FLAG` | Yes | - | Realm flag in format `YGGDRASIL{REALM:UUID}` |
| `REALM_NAME` | No | `template` | Realm identifier |
| `NODE_ENV` | No | `development` | Environment mode |

## Docker Integration

Add to `docker-compose.yml`:
```yaml
<realm-name>:
  build:
    context: ./realms/<realm-name>
  container_name: <realm-name>
  environment:
    - NODE_ENV=${NODE_ENV:-development}
    - PORT=3000
    - FLAG=${<REALM_NAME_UPPER>_FLAG}
    - REALM_NAME=<realm-name>
  networks:
    - <realm-name>_net
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 10s
  restart: unless-stopped

networks:
  <realm-name>_net:
    driver: bridge
    name: <realm-name>_net
```

Update gatekeeper networks:
```yaml
yggdrasil-gatekeeper:
  networks:
    - yggdrasil_main
    - <realm-name>_net  # ADD THIS
```

## Testing Standards

### Unit Tests
- ✅ Health endpoint returns 200
- ✅ Config loads from environment correctly
- ✅ Non-challenge routes function properly
- ✅ Helper/service functions work as expected
- ❌ **Do NOT test the vulnerability** (intentional by design)
- Target: ≥70% coverage on non-challenge code

### Integration Tests
- ✅ Exploit path successfully retrieves flag
- ✅ Flag format matches `YGGDRASIL{REALM:UUID}`
- ✅ Flag submission via gatekeeper works
- ✅ Direct container access fails (network isolation)

## Code Style Guidelines

- Use TypeScript strict mode
- Follow clean architecture principles (config → services → routes)
- Apply dependency injection for testability
- Use descriptive variable/function names
- Add comments for vulnerability-specific code
- Keep functions small and focused
- Use early returns over nested conditionals

## Common Patterns

### Adding a Vulnerable Endpoint
```typescript
// src/routes/realm.ts
router.post('/api/vulnerable', (req, res) => {
  const { userInput } = req.body;
  
  // INTENTIONAL VULNERABILITY: [describe the issue]
  // This demonstrates [OWASP category]
  if (userInput === 'exploit') {
    throw new Error(`Flag: ${config.flag}`);
  }
  
  res.json({ message: 'Normal response' });
});
```

### Serving Custom HTML
```typescript
router.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${config.realmName}</title>
        <!-- Add your styles -->
      </head>
      <body>
        <!-- Add your UI -->
      </body>
    </html>
  `);
});
```

### Adding Configuration
```typescript
// src/config/index.ts
export interface RealmConfig {
  port: number;
  flag: string;
  realmName: string;
  nodeEnv: string;
  // Add realm-specific fields
  customSetting?: string;
}

export function loadConfig(): RealmConfig {
  // Load from environment
  const customSetting = process.env.CUSTOM_SETTING;
  
  return {
    // ... standard fields
    customSetting,
  };
}
```

## Troubleshooting

**TypeScript errors:**
```bash
npm run build
# Fix errors, then retry
```

**Linting issues:**
```bash
npm run lint:fix
```

**Tests failing:**
```bash
npm test -- --verbose
# Check error messages and fix issues
```

**Port conflicts:**
```bash
# Change PORT in .env or docker-compose.yml
# Default internal port is always 3000
```

## Next Steps

After implementing your realm:
1. Test locally with `npm run dev`
2. Add to `docker-compose.yml`
3. Update `flag-oracle` with realm metadata
4. Update gatekeeper realm configuration
5. Write integration test script
6. Update root README with realm info
7. Run full E2E test

---

**For more information, see:**
- Project documentation: `.docs/`
- Milestone plans: `.docs/milestones/`
