# Quick Start Guide - Project Yggdrasil

**Get up and running in 5 minutes!**

---

## For New Developers

### 1️⃣ First Time Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd project_yggdrasil

# Single command to setup AND start everything
make yggdrasil
```

**That's it!** The platform is now running.

> **Note:** This single command handles environment generation, dependency installation, and startup.
> 
> **Alternative:** You can also run `make setup` then `make up` separately if you prefer.

---

## 2️⃣ Access the Platform

After startup, you'll see:

**Community Edition (default):**
```
════════════════════════════════════════════════════════════════
✅ Project Yggdrasil is running!
════════════════════════════════════════════════════════════════

🌐 Landing Page:  http://localhost:8080/
🏥 Health Check:  http://localhost:8080/health

💡 Quick Start:
   1. Visit http://localhost:8080/ to see the landing page
   2. Click 'INITIATE ASCENSION' to begin
════════════════════════════════════════════════════════════════
```

> **Enterprise Edition:** Set `YGGDRASIL_EDITION=enterprise` in `.env` to see additional features like Login page and Observability stack URLs.

### Try It Out

1. **Open your browser**: http://localhost:8080/
2. **See the cinematic landing page**: The Bifröst Gate
3. **Click "INITIATE ASCENSION"**: Begin your journey
4. **Register/Login**: Create an account or use test credentials
5. **Start with Niflheim**: The entry realm (Realm 10)

---

## 3️⃣ Verify Everything Works

```bash
# Quick health check
make quick-test

# Expected output:
# 🧪 Testing health endpoints...
# ✅ Gatekeeper health check passed
# ✅ Flag Oracle health check passed
# 🧪 Testing landing page...
# ✅ Landing page is accessible
# 🧪 Testing realms API...
# ✅ Realms API is accessible
```

---

## 4️⃣ Explore All URLs

```bash
make urls
```

This shows:
- Landing page
- All 10 realm URLs
- Observability dashboards (Grafana, Prometheus, Loki)
- Metrics endpoints

---

## 5️⃣ Useful Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make yggdrasil` | One command to setup AND start everything |
| `make up` | Start all services |
| `make down` | Stop all services |
| `make logs` | View live logs |
| `make restart` | Restart services |
| `make test` | Run unit + integration tests |
| `make info` | Show service status |
| `make clean` | Full cleanup (removes volumes) |

---

## 6️⃣ Manual Testing Guide

### Test Landing Page
```bash
curl http://localhost:8080/
# Should return HTML with "Bifröst" in it
```

### Test Health Endpoints
```bash
curl http://localhost:8080/health
# {"status":"ok","service":"gatekeeper"}

curl http://localhost:3001/health
# {"status":"ok","service":"flag-oracle"}
```

### Test Realms API
```bash
curl http://localhost:8080/realms
# Returns list of all realms with lock states
```

### Test a Realm (requires authentication)
```bash
# First, register/login via browser at http://localhost:8080/login
# Then access a realm
curl http://localhost:8080/realms/sample/ -b cookies.txt
```

### Submit a Flag
```bash
# Sample realm flag (for testing)
curl -X POST http://localhost:8080/submit-flag \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"flag":"YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}"}'
```

---

## 7️⃣ Observability

### Grafana Dashboards
- **URL**: http://localhost:3200
- **Username**: `admin`
- **Password**: Check your `.env` file (`GRAFANA_ADMIN_PASSWORD`)

### Prometheus Metrics
- **Gatekeeper**: http://localhost:8080/metrics
- **Flag Oracle**: http://localhost:3001/metrics
- **Prometheus UI**: http://localhost:9090

### Loki Logs
- **Endpoint**: http://localhost:3100
- **Query via Grafana**: Go to Grafana → Explore → Select Loki datasource

---

## 8️⃣ Development Workflow

### Make Code Changes

```bash
# Edit code in gatekeeper/src/ or flag-oracle/src/

# Rebuild and restart
make down
make up

# Or for faster iteration (dev mode)
make dev-gatekeeper  # Run gatekeeper with hot reload
```

### Run Tests

```bash
# Unit tests only
make test-unit

# Integration tests
make test-integration

# E2E journey tests (full 10→1 progression)
make test-e2e

# All tests
make test-all
```

### Check Logs

```bash
# All services
make logs

# Specific service
docker-compose logs -f gatekeeper
docker-compose logs -f flag-oracle
docker-compose logs -f niflheim
```

---

## 9️⃣ Troubleshooting

### Services won't start
```bash
# Check Docker is running
docker --version

# Check for port conflicts
lsof -i :8080
lsof -i :3001

# Clean and restart
make clean
make up
```

### .env missing or invalid
```bash
# Regenerate .env with fresh secrets
rm .env
make setup
```

### Can't access landing page
```bash
# Check if gatekeeper is healthy
curl http://localhost:8080/health

# Check service status
make info
docker-compose ps

# View logs
make logs
```

### Build fails
```bash
# Clean everything and rebuild
make clean
rm -rf gatekeeper/node_modules flag-oracle/node_modules
make setup
make up
```

---

## 🔟 Next Steps

1. **Read the Full README**: [README.md](README.md)
2. **Explore Documentation**: [.docs/](.docs/)
   - Developer onboarding
   - Operator guide
   - Per-realm documentation
3. **Understand the Architecture**: [README.md#architecture](README.md#-architecture)
4. **Try the First Challenge**: Start with Niflheim (Realm 10)
5. **Check the Codebase**: Explore `gatekeeper/`, `flag-oracle/`, `realms/`

---

## 📚 Key Documentation

- **[README.md](README.md)** - Complete project overview
- **[.docs/OPERATOR_GUIDE.md](.docs/OPERATOR_GUIDE.md)** - Production operations guide (967 lines)
- **[.docs/DEVELOPER_ONBOARDING.md](.docs/DEVELOPER_ONBOARDING.md)** - Detailed dev guide
- **[.docs/workflows/QUICK_REFERENCE.md](.docs/workflows/QUICK_REFERENCE.md)** - Commands & API reference
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - How to contribute

---

## 🎯 The Journey Ahead

```
Start: Niflheim (Realm 10) - Cryo-Stasis Facility
  ↓
Helheim (Realm 9) - Memorial Forum
  ↓
Svartalfheim (Realm 8) - Dwarven Forge
  ↓
... (7 more realms)
  ↓
End: Asgard (Realm 1) - Golden Citadel
```

**Each realm unlocks after submitting the previous realm's flag!**

---

<div align="center">

**🌳 The Bifröst Gate stands open. Your ascent begins. 🌳**

Happy hacking!

</div>
