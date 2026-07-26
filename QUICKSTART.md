# Quick Start Guide — Project Yggdrasil

**From zero to your first realm in about five minutes.**

---

## 1️⃣ First-Time Setup

```bash
# Clone the repository
git clone https://github.com/Kaademos/kademos-yggdrasil.git
cd kademos-yggdrasil

# One command: generate the environment, install dependencies, start everything
make yggdrasil
```

**That's it** — the platform is now running.

> **Prefer to do it in steps?** Run `make setup` (creates `.env`, installs dependencies) then `make up`.

---

## 2️⃣ Access the Platform

After startup you'll see:

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

Then:

1. **Open** http://localhost:8080/ — the Bifröst Gate landing page
2. **Click "INITIATE ASCENSION"** to begin the climb
3. **Register or log in** (create an account, or use the seeded test credentials)
4. **Start with Niflheim**, the entry realm (Realm 10)

The landing page renders the OWASP Top 10 as a vertical ascent — Asgard at the crown, Niflheim at the roots. Only Niflheim is unlocked to begin; each realm opens once you submit the previous realm's flag.

---

## 3️⃣ Verify Everything Works

```bash
make quick-test
```

```
🧪 Testing health endpoints...
✅ Gatekeeper health check passed
✅ Flag Oracle health check passed
🧪 Testing landing page...
✅ Landing page is accessible
🧪 Testing realms API...
✅ Realms API is accessible
```

See every URL — landing page, all ten realms, and (if enabled) the dashboards — with:

```bash
make urls
```

---

## 4️⃣ Everyday Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make up` / `make down` | Start / stop all services |
| `make restart` | Restart services |
| `make logs` | Tail live logs from all services |
| `make info` | Show service status |
| `make test` | Run unit + integration tests |
| `make clean` | Full cleanup (removes volumes) |

---

## 5️⃣ Try the API by Hand

```bash
# Landing page (HTML — contains "Bifröst")
curl http://localhost:8080/

# Health
curl http://localhost:8080/health      # {"status":"ok","service":"gatekeeper"}
curl http://localhost:3001/health      # {"status":"ok","service":"flag-oracle"}

# Realms list (with lock states)
curl http://localhost:8080/realms

# Submit a flag (session cookie required — grab one by logging in first)
curl -X POST http://localhost:8080/submit-flag \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"flag":"YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}"}'
```

---

## 6️⃣ Observability (Optional)

The monitoring stack is opt-in so the default startup stays fast. Enable it with:

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

| Tool | URL | Notes |
|------|-----|-------|
| **Grafana** | http://localhost:3200 | User `admin`; password in `.env` (`GRAFANA_ADMIN_PASSWORD`) |
| **Prometheus** | http://localhost:9090 | Metrics & alerting |
| **Loki** | http://localhost:3100 | Query via Grafana → Explore |

Service metrics are exposed at `http://localhost:8080/metrics` (Gatekeeper) and `http://localhost:3001/metrics` (Flag Oracle).

---

## 7️⃣ Development Loop

```bash
# Fast iteration with hot reload
make dev-gatekeeper       # gatekeeper backend + frontend
make dev-flag-oracle      # flag oracle

# Or rebuild the full stack after changes
make down && make up

# Tests
make test-unit            # gatekeeper + flag-oracle unit tests
make test-integration     # smoke + integration
make test-e2e             # full Niflheim → Asgard journey (services must be running)
make test-all             # everything
```

---

## 8️⃣ Troubleshooting

<details>
<summary><b>Services won't start</b></summary>

```bash
docker --version                 # is Docker running?
lsof -i :8080 && lsof -i :3001   # port conflicts?
make clean && make up            # clean slate
```
</details>

<details>
<summary><b><code>.env</code> missing or invalid</b></summary>

```bash
rm .env && make setup            # regenerate with fresh secrets
```
</details>

<details>
<summary><b>Can't reach the landing page</b></summary>

```bash
curl http://localhost:8080/health   # is the gatekeeper up?
make info                           # service status
make logs                           # inspect logs
```
</details>

<details>
<summary><b>Build fails</b></summary>

```bash
make clean
rm -rf gatekeeper/node_modules flag-oracle/node_modules
make setup && make up
```
</details>

---

## 9️⃣ Where to Go Next

- 📘 **[README.md](README.md)** — full project overview and architecture
- 🛠️ **[docs/guides/DEVELOPER.md](docs/guides/DEVELOPER.md)** — developer onboarding
- 🚀 **[docs/guides/OPERATOR_GUIDE.md](docs/guides/OPERATOR_GUIDE.md)** — production operations
- 📑 **[docs/workflows/QUICK_REFERENCE.md](docs/workflows/QUICK_REFERENCE.md)** — commands & API reference
- 🤝 **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to contribute
- 🗺️ **[docs/realms/](docs/realms/)** — per-realm vulnerability guides

---

## 🎯 The Journey Ahead

```
🌫️  Niflheim   (R10) — Cryo-Stasis Facility        ← you start here
☠️  Helheim    (R9)  — Níðhöggr SOC
⚙️  Svartalfheim (R8) — Underground Mine
❄️  Jotunheim  (R7)  — Ice Giant Stronghold
🔥  Muspelheim (R6)  — Fire Realm
⚒️  Nidavellir (R5)  — Dwarven Forge
🔐  Vanaheim   (R4)  — Merchant Realm
🌍  Midgard    (R3)  — Marketplace
✨  Alfheim    (R2)  — Cloud Realm
👑  Asgard     (R1)  — Golden Citadel             ← the final flag
```

**Each realm unlocks when you submit the previous realm's flag.**

---

<div align="center">

**🌳 The Bifröst Gate stands open. Your ascent begins. 🌳**

Happy hacking!

</div>
