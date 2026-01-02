# Quick Reference Guide
## Project Yggdrasil

Essential commands, API endpoints, and configuration reference.

---

## Table of Contents

1. [Common Commands](#common-commands)
2. [Docker Compose](#docker-compose)
3. [API Endpoints](#api-endpoints)
4. [Environment Variables](#environment-variables)
5. [Port Reference](#port-reference)
6. [Flag Format](#flag-format)
7. [Useful URLs](#useful-urls)

---

## Common Commands

### Make Targets

```bash
# Start platform
make up

# Stop platform
make down

# View logs
make logs

# Clean everything (including volumes)
make clean

# Run all tests
make test

# Unit tests only
make test-unit

# Integration tests
make test-integration

# E2E tests
make test-e2e

# Security tests
make test-security

# Install dependencies
make install
```

### Docker Compose

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View service status
docker-compose ps

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f gatekeeper

# Restart service
docker-compose restart gatekeeper

# Rebuild service
docker-compose up -d --build gatekeeper

# Execute command in container
docker exec -it yggdrasil-gatekeeper sh

# Check configuration
docker-compose config

# View resource usage
docker stats
```

### Testing

```bash
# Individual realm tests
./scripts/test-niflheim.sh
./scripts/test-helheim.sh
./scripts/test-asgard.sh

# Milestone test suites
./scripts/test-m3-all.sh
./scripts/test-m4-all.sh
./scripts/test-m5-all.sh

# E2E journey
./scripts/test-e2e-journey.sh

# Smoke test
./scripts/smoke-test.sh
```

---

## API Endpoints

### Gatekeeper (Port 8080)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |
| GET | `/metrics` | Prometheus metrics | No |
| POST | `/login` | User login | No |
| POST | `/logout` | User logout | Yes |
| GET | `/realms` | List accessible realms | Yes |
| POST | `/submit-flag` | Submit a flag | Yes |
| GET | `/progress` | Get user progression | Yes |
| GET | `/realm/:name/*` | Proxy to realm | Yes (progression-gated) |

### Flag Oracle (Port 3001)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |
| GET | `/metrics` | Prometheus metrics | No |
| POST | `/validate` | Validate flag | No (internal) |
| GET | `/progress/:userId` | Get user progression | No (internal) |

### Example Requests

**Login:**
```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

**Submit Flag:**
```bash
curl -X POST http://localhost:8080/submit-flag \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"flag":"YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}"}'
```

**Get Progression:**
```bash
curl http://localhost:8080/progress \
  -H "Cookie: session=..."
```

---

## Environment Variables

### Core Platform

| Variable | Service | Description | Default | Example |
|----------|---------|-------------|---------|---------|
| `NODE_ENV` | All | Environment | `development` | `production` |
| `APP_PORT` | Gatekeeper | Public port | `8080` | `443` |
| `FLAG_ORACLE_PORT` | Flag Oracle | Internal port | `3001` | `3001` |
| `SESSION_SECRET` | Gatekeeper | Session encryption | *required* | `hex-string` |
| `BCRYPT_ROUNDS` | Gatekeeper | Password hashing | `10` | `12` |

### Observability

| Variable | Service | Description | Default |
|----------|---------|-------------|---------|
| `LOKI_PORT` | Loki | Loki API port | `3100` |
| `PROMETHEUS_PORT` | Prometheus | Prometheus UI | `9090` |
| `GRAFANA_PORT` | Grafana | Grafana UI | `3200` |
| `GRAFANA_ADMIN_USER` | Grafana | Admin username | `admin` |
| `GRAFANA_ADMIN_PASSWORD` | Grafana | Admin password | `admin` |

### Realm Flags

| Variable | Realm | Example Value |
|----------|-------|---------------|
| `NIFLHEIM_FLAG` | Realm 10 | `YGGDRASIL{NIFLHEIM:ba6cd20a-...}` |
| `HELHEIM_FLAG` | Realm 9 | `YGGDRASIL{HELHEIM:e1a93eab-...}` |
| `SVARTALFHEIM_FLAG` | Realm 8 | `YGGDRASIL{SVARTALFHEIM:77c7df6c-...}` |
| `JOTUNHEIM_FLAG` | Realm 7 | `YGGDRASIL{JOTUNHEIM:522fb48d-...}` |
| `MUSPELHEIM_FLAG` | Realm 6 | `YGGDRASIL{MUSPELHEIM:b1aea18f-...}` |
| `NIDAVELLIR_FLAG` | Realm 5 | `YGGDRASIL{NIDAVELLIR:969cb870-...}` |
| `VANAHEIM_FLAG` | Realm 4 | `YGGDRASIL{VANAHEIM:72dfb48c-...}` |
| `MIDGARD_FLAG` | Realm 3 | `YGGDRASIL{MIDGARD:771082af-...}` |
| `ALFHEIM_FLAG` | Realm 2 | `YGGDRASIL{ALFHEIM:df463c99-...}` |
| `ASGARD_FLAG` | Realm 1 | `YGGDRASIL{ASGARD:81892ad5-...}` |

### Generating Secrets

```bash
# Session secrets
openssl rand -hex 32

# Database passwords
openssl rand -base64 24

# UUIDs for flags
uuidgen
```

---

## Port Reference

| Port | Service | Access | Description |
|------|---------|--------|-------------|
| 8080 | Gatekeeper | Public | Main entry point |
| 3001 | Flag Oracle | Internal | Flag validation |
| 3100 | Loki | Public (dev) | Log aggregation |
| 3200 | Grafana | Public (dev) | Visualization |
| 6379 | Redis | Internal | Session/cache store |
| 9090 | Prometheus | Public (dev) | Metrics storage |
| 5432 | PostgreSQL (Asgard) | Internal | Asgard database |
| 5432 | PostgreSQL (Nidavellir) | Internal | Nidavellir database |

**Note:** Only Gatekeeper (8080) and Observability stack (3100, 3200, 9090) should be exposed to host. All realm services are internal-only.

---

## Flag Format

### Structure

```
YGGDRASIL{REALM_NAME:UUID}
```

### Components

- **Prefix:** `YGGDRASIL{`
- **Realm Name:** Uppercase realm name
- **Separator:** `:`
- **UUID:** UUID v4 format (lowercase)
- **Suffix:** `}`

### Examples

```
YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}
YGGDRASIL{ASGARD:81892ad5-e169-4165-89fe-ab25348325e0}
```

### Regex Validation

```javascript
/^YGGDRASIL\{([A-Z_]+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}$/i
```

---

## Useful URLs

### Application

- **Gatekeeper:** http://localhost:8080
- **Login:** http://localhost:8080/login
- **Realms List:** http://localhost:8080/realms
- **Niflheim:** http://localhost:8080/realm/niflheim/
- **Asgard:** http://localhost:8080/realm/asgard/

### Observability

- **Grafana:** http://localhost:3200 (admin/admin)
- **Prometheus:** http://localhost:9090
- **Loki:** http://localhost:3100
- **Gatekeeper Metrics:** http://localhost:8080/metrics
- **Flag Oracle Metrics:** http://localhost:3001/metrics

### Grafana Dashboards

- **Logs:** http://localhost:3200/explore (select Loki datasource)
- **Metrics:** http://localhost:3200/explore (select Prometheus datasource)

---

## Progression Flow

### Realm Order (10 → 1)

```
10. Niflheim (First)     → ALWAYS ACCESSIBLE
 9. Helheim              → Unlock with Niflheim flag
 8. Svartalfheim         → Unlock with Helheim flag
 7. Jotunheim            → Unlock with Svartalfheim flag
 6. Muspelheim           → Unlock with Jotunheim flag
 5. Nidavellir           → Unlock with Muspelheim flag
 4. Vanaheim             → Unlock with Nidavellir flag
 3. Midgard              → Unlock with Vanaheim flag
 2. Alfheim              → Unlock with Midgard flag
 1. Asgard (Final)       → Unlock with Alfheim flag
```

### Checking Progression

```bash
# Via API
curl http://localhost:8080/progress \
  -H "Cookie: session=..."

# Via Grafana (Loki)
{service="flag-oracle"} |= "progression_update" | json

# Via Prometheus
user_progression_level
```

---

## Log Query Examples

### Loki (LogQL)

```logql
# All gatekeeper logs
{service="gatekeeper"}

# Failed logins
{service="gatekeeper"} |= "login_failure"

# Flag validations
{service="flag-oracle"} |= "flag_validation"

# Errors only
{service=~"gatekeeper|flag-oracle"} |= "error"

# Rate limit violations
{service="gatekeeper"} |= "rate_limit_exceeded" | json | line_format "{{.ip}}"
```

### Prometheus (PromQL)

```promql
# Request rate (last 5 minutes)
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active sessions
active_sessions

# Flag submissions by result
rate(flag_submissions_total[5m])
```

---

## Troubleshooting Quick Checks

```bash
# All services running?
docker-compose ps

# Any errors in logs?
docker-compose logs | grep -i error

# Disk space OK?
df -h

# Memory OK?
free -h

# Network connectivity?
docker network inspect yggdrasil_main

# Service accessible?
curl http://localhost:8080/health

# Database connected?
docker-compose logs asgard | grep "connected to database"
```

---

## Configuration Files

| File | Description |
|------|-------------|
| `.env` | Environment variables (not in git) |
| `.env.example` | Environment template |
| `docker-compose.yml` | Service orchestration |
| `config/loki/loki-config.yaml` | Loki configuration |
| `config/promtail/promtail-config.yaml` | Promtail configuration |
| `config/prometheus/prometheus.yml` | Prometheus configuration |
| `config/prometheus/alerts/*.yml` | Alert rules |
| `config/grafana/provisioning/` | Grafana provisioning |
| `Makefile` | Convenient commands |
| `playwright.config.ts` | E2E test configuration |

---

## Network Architecture

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ port 8080
       v
┌──────────────────┐
│   Gatekeeper     │
└─────┬────────────┘
      │
      ├──────> Flag Oracle (yggdrasil_main)
      ├──────> Redis (yggdrasil_main)
      ├──────> Loki/Prometheus/Grafana (yggdrasil_main)
      ├──────> Niflheim (niflheim_net)
      ├──────> Helheim (helheim_net)
      ├──────> ... (each realm on own network)
      └──────> Asgard (asgard_net)
```

**Key Points:**
- Only Gatekeeper attached to all networks
- Realms isolated from each other
- Observability on main network only

---
 
**For Detailed Docs:** See `.docs/DEVELOPER_ONBOARDING.md` and `.docs/workflows/OPERATOR_GUIDE.md`
