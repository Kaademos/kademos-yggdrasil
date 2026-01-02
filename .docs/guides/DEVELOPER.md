# Developer Onboarding Guide
## Project Yggdrasil

Welcome to Project Yggdrasil! This guide will help you get up and running quickly.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Development Workflow](#development-workflow)
4. [Testing Strategy](#testing-strategy)
5. [Common Tasks](#common-tasks)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- **Docker & Docker Compose**: Required for running services
- **Node.js 18+**: For local development
- **Make**: For convenient commands
- **Git**: Version control

### Initial Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd project_yggdrasil

# 2. Copy environment template
cp .env.example .env

# 3. Generate secrets (optional for development)
# SESSION_SECRET: openssl rand -hex 32
# JOTUNHEIM_SESSION_SECRET: openssl rand -hex 32
# Database passwords: openssl rand -base64 24

# 4. Install dependencies (optional, happens in Docker)
npm install
cd gatekeeper && npm install && cd ..
cd flag-oracle && npm install && cd ..

# 5. Start the platform
make up

# 6. Verify services are running
make logs

# 7. Access the platform
open http://localhost:8080
```

### Verify Installation

```bash
# Check all services are healthy
docker-compose ps

# Test gatekeeper
curl http://localhost:8080/health

# Test flag-oracle
curl http://localhost:3001/health

# Access observability
open http://localhost:3200  # Grafana (admin/admin)
open http://localhost:9090  # Prometheus
```

---

## Architecture Overview

### High-Level Structure

```
Project Yggdrasil
├── Control Plane
│   ├── yggdrasil-gatekeeper (port 8080)
│   │   └── Reverse proxy, auth, progression gating
│   └── flag-oracle (port 3001)
│       └── Flag validation, progression tracking
├── Realms (10 total)
│   ├── Each on isolated Docker network
│   ├── Each with intentional vulnerability
│   └── Only accessible via gatekeeper
└── Observability Stack
    ├── Loki (logging)
    ├── Prometheus (metrics)
    └── Grafana (visualization)
```

### Network Topology

```
                    [User]
                      |
                      v
            [yggdrasil-gatekeeper:8080]
             /         |         \
            /          |          \
     [flag-oracle]  [realms]  [observability]
           |            |            |
    [Redis/File]  [10 isolated  [Loki/
                   networks]    Prometheus/
                                Grafana]
```

### Key Concepts

**Progression Model:**
- Users start at Realm 10 (Niflheim)
- Must exploit vulnerability to get flag
- Submit flag to unlock next realm
- Progress from 10 → 1 (Asgard)

**Flag Format:**
```
YGGDRASIL{REALM_NAME:UUID}
Example: YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}
```

**Realm Isolation:**
- Each realm on own Docker network (`<realm>_net`)
- Only gatekeeper attached to all networks
- Realms cannot communicate with each other
- Direct realm access blocked (no host ports)

---

## Development Workflow

### Local Development

#### Running Services Locally (without Docker)

```bash
# Terminal 1: Redis (required)
docker run -d -p 6379:6379 redis:7-alpine

# Terminal 2: Flag Oracle
cd flag-oracle
npm run dev

# Terminal 3: Gatekeeper
cd gatekeeper
npm run dev

# Terminal 4: Sample Realm
cd realms/sample-realm
npm run dev
```

#### Hot Reloading with Docker

```bash
# Use volume mounts for live code updates
# Already configured in docker-compose.yml for development

# Rebuild specific service after changes
docker-compose up -d --build gatekeeper

# View logs
docker-compose logs -f gatekeeper
```

### Making Changes

**Workflow:**

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes to relevant service
3. Run linter: `npm run lint` (in service directory)
4. Run tests: `npm test`
5. Test in Docker: `make up`
6. Commit changes: `git commit -m "feat: description"`
7. Push and create PR

### Code Style

**General Principles:**
- Small, focused functions
- Early returns over nested conditionals
- Clear separation of concerns (routes → services → repositories)
- TypeScript strict mode enabled
- Minimal comments (prefer self-documenting code)

**TypeScript Example:**
```typescript
// Good: Early return, clear separation
export async function validateFlag(userId: string, flag: string): Promise<ValidationResult> {
  if (!userId || !flag) {
    return { valid: false, error: 'Missing parameters' };
  }
  
  const validation = this.flagValidator.validate(flag);
  if (!validation.valid) {
    return validation;
  }
  
  return this.progressionService.checkProgression(userId, validation.realm);
}

// Avoid: Nested conditionals, mixed concerns
```

### Environment Variables

**Key Variables:**

| Variable | Service | Description | Default |
|----------|---------|-------------|---------|
| `APP_PORT` | Gatekeeper | Public port | 8080 |
| `FLAG_ORACLE_PORT` | Flag Oracle | Internal port | 3001 |
| `SESSION_SECRET` | Gatekeeper | Session encryption key | (generate) |
| `*_FLAG` | Realms | Flag for each realm | See .env.example |
| `GRAFANA_PORT` | Grafana | UI port | 3200 |

**Secrets Management:**
- Never commit `.env` file
- Use `.env.example` as template
- Generate strong secrets for production
- Rotate secrets regularly

---

## Testing Strategy

### Test Pyramid

```
        /\
       /  \      E2E Tests (Playwright)
      /____\     - Full journey (10→1)
     /      \    - Isolation tests
    /________\   
   /          \  Integration Tests (Bash scripts)
  /____________\ - Per-realm exploit tests
 /              \
/________________\ Unit Tests (Jest)
                   - Services, utilities, validators
```

### Running Tests

**Unit Tests:**
```bash
# All unit tests
make test-unit

# Specific service
cd gatekeeper && npm test
cd flag-oracle && npm test

# With coverage
npm test -- --coverage
```

**Integration Tests:**
```bash
# All milestone tests
make test-integration

# Specific milestone
./scripts/test-m3-all.sh
./scripts/test-m4-all.sh
./scripts/test-m5-all.sh

# Specific realm
./scripts/test-niflheim.sh
./scripts/test-asgard.sh
```

**E2E Tests:**
```bash
# Full journey test
make test-e2e

# Or directly
./scripts/test-e2e-journey.sh

# With UI
npx playwright test --ui
```

**Security Tests:**
```bash
# Security validation
make test-security

# Individual tests
npm test -- tests/security/headers.spec.ts
npm test -- tests/security/rate-limiting.spec.ts
```

### Test Coverage Requirements

- **Gatekeeper**: ≥70% line coverage
- **Flag Oracle**: ≥70% line coverage
- **Realms**: Coverage for non-challenge code only
- **Critical paths**: 100% coverage (auth, progression, validation)

---

## Common Tasks

### Adding a New Realm

1. **Create realm directory:**
   ```bash
   cp -r realms/_template realms/new-realm
   cd realms/new-realm
   ```

2. **Update configuration:**
   - Edit `realms/new-realm/package.json`
   - Update realm name and description
   - Generate UUID for flag: `uuidgen`

3. **Add to docker-compose.yml:**
   ```yaml
   new-realm:
     build:
       context: ./realms/new-realm
     container_name: new-realm
     environment:
       - FLAG=${NEW_REALM_FLAG}
     networks:
       - new_realm_net
   
   networks:
     new_realm_net:
       driver: bridge
   ```

4. **Update gatekeeper config:**
   - Add realm to `gatekeeper/src/config/index.ts`
   - Add proxy route

5. **Update flag-oracle:**
   - Add flag to valid flags list
   - Update realm order in `flag-oracle/src/config/realm-order.ts`

6. **Test:**
   ```bash
   make up
   ./scripts/test-new-realm.sh
   ```

### Modifying Gatekeeper Logic

**Example: Adding a new route**

```typescript
// gatekeeper/src/routes/index.ts
router.get('/new-endpoint', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const result = await someService.doSomething(userId);
    res.json({ status: 'success', data: result });
  } catch (error) {
    logger.error('Error in new endpoint', { error, userId });
    res.status(500).json({ status: 'error', message: 'Internal error' });
  }
});
```

### Changing Flags

**Development:**
```bash
# Edit .env file
vim .env

# Update flag value
NIFLHEIM_FLAG=YGGDRASIL{NIFLHEIM:new-uuid-here}

# Restart services
docker-compose restart niflheim flag-oracle
```

**Production:**
- Use secrets management (e.g., Docker Secrets, Vault)
- Never commit real flags to git
- Document flag rotation procedure

### Debugging

**View Logs:**
```bash
# All services
make logs

# Specific service
docker-compose logs -f gatekeeper

# Grep for errors
docker-compose logs gatekeeper | grep ERROR

# Follow specific container
docker logs -f yggdrasil-gatekeeper
```

**Interactive Shell:**
```bash
# Access container shell
docker exec -it yggdrasil-gatekeeper sh

# Check environment
docker exec yggdrasil-gatekeeper env

# Run commands
docker exec yggdrasil-gatekeeper curl http://flag-oracle:3001/health
```

**Network Debugging:**
```bash
# Check networks
docker network ls

# Inspect network
docker network inspect yggdrasil_main

# Check connectivity
docker exec yggdrasil-gatekeeper ping niflheim
```

---

## Troubleshooting

### Common Errors

**Error: Port already in use**
```
Error: bind: address already in use
```
**Solution:**
```bash
# Find process using port
lsof -i :8080

# Kill process
kill -9 <PID>

# Or change port in .env
APP_PORT=8081
```

**Error: Cannot connect to flag-oracle**
```
Error: connect ECONNREFUSED flag-oracle:3001
```
**Solution:**
```bash
# Check flag-oracle is running
docker-compose ps flag-oracle

# Check logs
docker-compose logs flag-oracle

# Restart
docker-compose restart flag-oracle
```

**Error: Realm returns 403**
```
Error: Access forbidden to realm
```
**Solution:**
- Check progression state
- Verify previous flags submitted
- Check gatekeeper logs for progression level
- Ensure correct user session

**Error: Database connection failed**
```
Error: connect ECONNREFUSED postgres:5432
```
**Solution:**
```bash
# Check database is running
docker-compose ps asgard-db

# Check database logs
docker-compose logs asgard-db

# Restart database
docker-compose restart asgard-db

# Wait for health check
docker-compose ps | grep healthy
```

### Service Won't Start

**Check Docker:**
```bash
# Docker daemon running?
docker info

# Disk space?
df -h

# Memory available?
free -h
```

**Check Configuration:**
```bash
# Validate docker-compose
docker-compose config

# Check for syntax errors
docker-compose config | grep error
```

**Check Dependencies:**
```bash
# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Network Isolation Issues

**Problem:** Realm accessible directly

**Check:**
```bash
# Should fail (no host port mapping)
curl http://localhost:3000

# Gatekeeper should be only accessible service
curl http://localhost:8080
```

**Fix:**
- Remove `ports` from realm service in docker-compose.yml
- Ensure only gatekeeper exposes host port

### Performance Issues

**Symptoms:**
- Slow response times
- High CPU usage
- Memory exhaustion

**Diagnosis:**
```bash
# Check resource usage
docker stats

# Check logs for errors
docker-compose logs | grep -i error

# Check Prometheus metrics
open http://localhost:9090
```

**Solutions:**
- Increase Docker resources
- Optimize database queries
- Add caching
- Review log levels (reduce verbosity in dev)

---

## Additional Resources

- **API Reference**: See `.docs/workflows/QUICK_REFERENCE.md`
- **Realm Specifications**: See `.docs/realms/*.md`
- **Contributing**: See `.docs/CONTRIBUTING.md`
- **Milestone Documentation**: See `.docs/milestones/implementation/`

---

**Questions?** Open an issue or reach out to the team.