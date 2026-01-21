# Environment Configuration Guide

## Overview

Project Yggdrasil uses environment variables for configuration management. This guide explains the .env file structure, how to set it up, and best practices.

---

## Quick Setup

### Automatic (Recommended)

```bash
make setup
```

This command automatically:
1. Creates `.env` from `.env.example`
2. Generates secure secrets using `openssl`
3. Replaces all placeholder values
4. Installs dependencies

### Manual

```bash
# 1. Copy template
cp .env.example .env

# 2. Generate secrets
openssl rand -hex 32  # Use for SESSION_SECRET, JOTUNHEIM_SESSION_SECRET
openssl rand -hex 16  # Use for database passwords, Grafana password

# 3. Edit .env and replace <generate-strong-secret-for-production>

# 4. Verify configuration
./scripts/verify-env.sh
```

---

## Environment Variables Reference

### Application Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PORT` | `8080` | Gatekeeper HTTP port |
| `NODE_ENV` | `development` | Environment mode |

### Flag Oracle

| Variable | Default | Description |
|----------|---------|-------------|
| `FLAG_ORACLE_URL` | `http://flag-oracle:3001` | Internal URL to flag oracle |
| `FLAG_ORACLE_PORT` | `3001` | Flag oracle HTTP port |
| `DATA_PATH` | `/data` | Persistence path in container |

### Redis (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |

Falls back to file-based storage if Redis unavailable.

### Security

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | ✅ Yes | Gatekeeper session encryption key (64 hex chars) |
| `JOTUNHEIM_SESSION_SECRET` | ✅ Yes | Jotunheim realm session key (64 hex chars) |
| `NIDAVELLIR_DB_PASSWORD` | ✅ Yes | PostgreSQL password for Nidavellir |
| `ASGARD_DB_PASSWORD` | ✅ Yes | PostgreSQL password for Asgard |
| `GRAFANA_ADMIN_PASSWORD` | ✅ Yes | Grafana admin user password |

**Security Best Practices:**
- Use `openssl rand -hex 32` for session secrets
- Use `openssl rand -hex 16` for database passwords
- Never commit `.env` to version control
- Rotate secrets for each deployment environment

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Flag validation rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `10` | Max flag submissions per window |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `300000` | Auth rate limit window (ms) |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | `5` | Max login attempts per window |

### Realm Flags

All flags follow the format: `YGGDRASIL{REALM:UUID}`

| Variable | Example |
|----------|---------|
| `SAMPLE_REALM_FLAG` | `YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}` |
| `NIFLHEIM_FLAG` | `YGGDRASIL{NIFLHEIM:ba6cd20a-...}` |
| `HELHEIM_FLAG` | `YGGDRASIL{HELHEIM:e1a93eab-...}` |
| `SVARTALFHEIM_FLAG` | `YGGDRASIL{SVARTALFHEIM:77c7df6c-...}` |
| `JOTUNHEIM_FLAG` | `YGGDRASIL{JOTUNHEIM:522fb48d-...}` |
| `MUSPELHEIM_FLAG` | `YGGDRASIL{MUSPELHEIM:b1aea18f-...}` |
| `NIDAVELLIR_FLAG` | `YGGDRASIL{NIDAVELLIR:969cb870-...}` |
| `VANAHEIM_FLAG` | `YGGDRASIL{VANAHEIM:72dfb48c-...}` |
| `MIDGARD_FLAG` | `YGGDRASIL{MIDGARD:771082af-...}` |
| `ALFHEIM_FLAG` | `YGGDRASIL{ALFHEIM:df463c99-...}` |
| `ASGARD_FLAG` | `YGGDRASIL{ASGARD:81892ad5-...}` |

**Note:** Flags are defined in `.env.example` with full UUIDs. Use these for development/testing.

### Observability Stack

| Variable | Default | Description |
|----------|---------|-------------|
| `LOKI_PORT` | `3100` | Loki log aggregation port |
| `PROMETHEUS_PORT` | `9090` | Prometheus metrics port |
| `GRAFANA_PORT` | `3200` | Grafana dashboard port |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin username |

### Optional Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGIN` | (none) | CORS allowed origin for production |
| `BCRYPT_ROUNDS` | `10` | Bcrypt hashing cost factor |

---

## Verification

### Using the Verification Script

```bash
./scripts/verify-env.sh
```

**Expected Output:**
```
🔍 Verifying .env configuration...

✅ .env file exists
✅ All 16 required variables are set
✅ No placeholder values found

🎉 .env configuration is valid!
```

### Manual Verification

```bash
# Check all flags are set
grep "FLAG=" .env | wc -l
# Expected: 11 (sample + 10 realms)

# Check for placeholder values
grep "<generate-strong" .env
# Expected: No output (all replaced)

# Test configuration loads
cd gatekeeper && npm run build
cd ../flag-oracle && npm run build
```

---

## Development vs Production

### Development (.env)

```bash
# Development uses friendly, predictable values
SESSION_SECRET=bbdf8a584b25229038eaf5fd659bdffe92ef47de5a7b4dea0313a3430081968f
NIDAVELLIR_DB_PASSWORD=dev-nidavellir-db-password-change-in-prod
GRAFANA_ADMIN_PASSWORD=dev-grafana-admin-password-change-in-prod
```

**Characteristics:**
- Predictable secrets for testing
- Same flags across team members
- Verbose password hints
- Fast bcrypt rounds (10)

### Production (.env.production)

```bash
# Production uses strong, unique secrets
SESSION_SECRET=$(openssl rand -hex 32)
NIDAVELLIR_DB_PASSWORD=$(openssl rand -hex 16)
GRAFANA_ADMIN_PASSWORD=$(openssl rand -hex 20)
```

**Characteristics:**
- Cryptographically secure random secrets
- Unique per deployment
- No hints in values
- Higher bcrypt rounds (12+)
- Loaded via CI/CD secrets management

---

## Troubleshooting

### Issue: "SESSION_SECRET must be at least 32 characters"

**Cause:** SESSION_SECRET not set or too short

**Fix:**
```bash
# Generate new secret
openssl rand -hex 32

# Update .env
SESSION_SECRET=<paste-generated-value>
```

### Issue: "Database connection failed"

**Cause:** Database password mismatch

**Fix:**
```bash
# Verify password set
grep "DB_PASSWORD" .env

# Restart services to reload env
make restart
```

### Issue: "Grafana login failed"

**Cause:** Wrong Grafana password

**Fix:**
```bash
# Check password in .env
grep "GRAFANA_ADMIN_PASSWORD" .env

# Use this password at http://localhost:3200
```

### Issue: "Flag validation failed"

**Cause:** Flag mismatch between .env and actual submission

**Fix:**
```bash
# Check flag format
grep "NIFLHEIM_FLAG" .env
# Should be: YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}

# Verify flag-oracle loaded it
curl http://localhost:3001/health
```

---

## Security Considerations

### What to Commit

✅ **DO Commit:**
- `.env.example` (template with placeholders)
- `scripts/verify-env.sh` (verification script)
- Documentation about environment variables

❌ **DO NOT Commit:**
- `.env` (actual secrets)
- `.env.local`, `.env.*.local` (environment-specific)
- Any file containing real passwords or keys

### Secrets Rotation

**When to Rotate:**
- Before production deployment
- After team member departure
- After suspected compromise
- Every 90 days (best practice)

**How to Rotate:**
```bash
# 1. Generate new secrets
openssl rand -hex 32 > new_session_secret.txt
openssl rand -hex 16 > new_db_password.txt

# 2. Update .env
# (Replace SESSION_SECRET and DB passwords)

# 3. Restart services
make restart

# 4. Securely delete temp files
shred -u new_session_secret.txt new_db_password.txt
```

### Multi-Environment Setup

```
project/
├── .env                    # Local development (gitignored)
├── .env.example            # Template (committed)
├── .env.production         # Production (never committed, CI/CD only)
└── .env.staging            # Staging (never committed, CI/CD only)
```

---

## Advanced Configuration

### Using Docker Secrets (Production)

For production deployments, use Docker secrets instead of .env:

```yaml
# docker-compose.prod.yml
services:
  gatekeeper:
    secrets:
      - session_secret
      - db_password
    environment:
      SESSION_SECRET_FILE: /run/secrets/session_secret

secrets:
  session_secret:
    external: true
  db_password:
    external: true
```

### Using External Secret Management

```bash
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id yggdrasil/session-secret

# HashiCorp Vault
vault kv get secret/yggdrasil/session-secret

# Kubernetes Secrets
kubectl get secret yggdrasil-secrets -o jsonpath='{.data.session-secret}'
```

---

## Reference Files

- [.env.example](../.env.example) - Template
- [.gitignore](../.gitignore) - Ignored files (includes .env)
- [Makefile](../Makefile) - `make setup` automation
- [scripts/verify-env.sh](../scripts/verify-env.sh) - Verification script

---

## Related Documentation

- [Quick Start Guide](../QUICKSTART.md)
- [Developer Onboarding](DEVELOPER_ONBOARDING.md)
- [Security Best Practices](ASVS_COMPLIANCE.md)
- [Operator Guide](OPERATOR_GUIDE.md)
