# Helheim (Realm 9)

**OWASP Category:** A09:2025 - Logging & Alerting Failures
**Difficulty:** Medium
**Tech Stack:** Node.js/Express, TypeScript, correlation rule engine
**Theme:** The Norse underworld — where every record of the dead is kept perfectly, and read by no one

## Overview

Helheim runs the **Níðhöggr SIEM**, the central log-correlation service that every
other realm forwards its security events to. The archive is complete. The records
are accurate. Secrets are redacted before write. Access to the console is
credential-gated.

And it has never raised an alert.

That is the whole realm. The 2025 revision renamed A09 from "Logging & Monitoring
Failures" to "Logging & **Alerting** Failures" specifically because *great logging
with no alerting is of minimal value in identifying security incidents*. Helheim is
built to make a player feel that sentence rather than read it.

**The flag is never stored anywhere.** It is emitted as the body of an alert, and
only after that alert has survived every stage of the pipeline. If nothing reaches
an operator, there is no flag.

## Vulnerability Description

### HEL-001 — Security events logged without alerting (CWE-778)

The alert pipeline runs in three stages:

```
rule match  →  severity filter  →  sink delivery
```

All three are broken, and **none of them produces an error**:

| Stage | Fault | Why it is silent |
|---|---|---|
| Rule match | `HEL-R007`, the only cross-realm correlation rule, is `enabled: false` — *"DISABLED 2025-11-04 pending tuning"* | A disabled rule produces no alert and no error |
| Severity filter | `minSeverity: CRITICAL`, while no rule in the catalogue emits above `HIGH` | Every match is discarded as configured behaviour |
| Sink delivery | `sink: "null"` — a decommissioned collector | Writes are accepted and dropped |

Any one of the three suppresses detection on its own. All three must be repaired.

Control-plane mutations — enabling a rule, retuning the pipeline — are applied
with no audit record and no notification. `GET /api/soc/audit` exists, is documented
as covering `rule.disable` and `pipeline.reconfigure`, and stays empty forever. An
attacker who switches off detection leaves exactly as much evidence as one who does
nothing.

### HEL-002 — Monitoring reported healthy without verification (CWE-223)

`GET /api/soc/pipeline/health` reports `alerting: "operational"`. It derives that
from the configuration being *parseable*. It never resolves the sink, never checks
the severity floor against what rules actually emit, never counts disabled rules,
and never delivers a test alert — `lastSelfTest` is permanently `null`.

Three broken stages, one green light. That is why nobody investigated for months.

## The buried incident

Seeded into ~1800 benign forwarded events is the **Fenrir intrusion**, correlation
ID `a7f3c1d8`, from host `10.13.37.42`:

| # | Realm | Event | Severity |
|---|---|---|---|
| 1 | niflheim | `pressure.regulate` — PRESSURE_OVERFLOW, exceptional condition unhandled | HIGH |
| 2 | niflheim | `door.emergency_unlock` — containment interlock fails open | HIGH |
| 3 | niflheim | `crashreport.generate` — diagnostics written with credentials in cleartext | MEDIUM |
| 4 | helheim | `session.login` — SOC console, same host, 7 minutes later | MEDIUM |
| 5 | helheim | `archive.export` — 41208 records egressed | HIGH |

Read one at a time, every event looks routine. Only the **sequence, joined on
`sourceIp` across two realms**, is an incident — which is exactly what no single
realm's log can show, and exactly what the disabled rule was written to catch.

Three decoys share one attribute with the intrusion but not the crossing: the same
host doing only benign work, an emergency unlock from a host that never appears
downstream, and an admin login from the operations subnet. Rules that key on a
single field match these; the correlation rule does not.

The archive is generated from a fixed seed, so it is byte-identical on every boot.

## Exploit Path

```bash
BASE=http://localhost:8080/realm/helheim
AUTH='Authorization: Basic YWRtaW46SWNlQm91bmQyMDI1'   # admin:IceBound2025
```

**1. Arrive from Niflheim.** The crash report at Niflheim names this service, leaks
the diagnostic credential, and cites correlation ID `a7f3c1d8`.

**2. Read the correlation log it points at:**

```bash
curl -H "$AUTH" "$BASE/admin/logs?file=niflheim_correlation.log"
```

Five records, two realms, and the disposition line: `NO ALERT GENERATED`.

**3. Watch the console disagree with reality:**

```bash
curl -H "$AUTH" "$BASE/api/soc/pipeline/health"
# → { "alerting": "operational", "lastSelfTest": null, ... }

curl -X POST -H "$AUTH" "$BASE/api/soc/pipeline/replay"
# → { "counters": { "delivered": 0, ... } }
```

**4. Diagnose stage by stage.** The replay reports honest per-stage drop counters
and diagnostics naming each fault.

**5. Repair all three stages:**

```bash
curl -X PATCH -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"enabled": true}' "$BASE/api/soc/rules/HEL-R007"

curl -X PUT -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"minSeverity": "HIGH", "sink": "soc-queue"}' "$BASE/api/soc/pipeline/config"
```

**6. Replay. The alert delivers the flag:**

```bash
curl -X POST -H "$AUTH" "$BASE/api/soc/pipeline/replay"
```

The `HEL-R007` alert carries the reconstructed incident — widened from the three
trigger events to all five correlated records — and the flag.

## Endpoints

### Public

| Endpoint | Notes |
|---|---|
| `GET /` | Memorial forum |
| `GET /health` | Liveness |
| `GET /api/memorials` | Forum records |
| `POST /api/memorial` | Forum submission; failures are logged and forwarded, never alerted |
| `GET /api/system-status` | **Vulnerable (HEL-002)** — claims monitoring enabled, hard-codes zero alerts |
| `GET /temp_logs/*` | `410 Gone` — retired, see below |

### SOC console (requires the Niflheim credential)

| Endpoint | Notes |
|---|---|
| `GET /admin` | Console UI |
| `GET /admin/logs` | Archive listing |
| `GET /admin/logs?file=<name>` | Allow-listed archive read |
| `GET /api/soc/events` | Query the archive (`source`, `action`, `severity`, `sourceIp`, `actor`, `outcome`, `q`, `limit`, `offset`) |
| `GET /api/soc/events/:id` | Single event |
| `GET /api/soc/rules` | Detection catalogue |
| `PATCH /api/soc/rules/:id` | **Vulnerable (HEL-001)** — unaudited, unalerted |
| `GET /api/soc/pipeline/config` | Pipeline state |
| `PUT /api/soc/pipeline/config` | **Vulnerable (HEL-001)** — unaudited, unalerted |
| `GET /api/soc/pipeline/health` | **Vulnerable (HEL-002)** — unverified green light |
| `POST /api/soc/pipeline/replay` | Evaluate archive; delivers alerts |
| `GET /api/soc/alerts` | Delivered alerts |
| `GET /api/soc/audit` | **Vulnerable (HEL-001)** — permanently empty |
| `POST /api/soc/ingest` | Forwarded event intake |

## What this realm deliberately does *not* teach

Two things were removed in the v2.0.0 rewrite because they taught other realms'
categories under an A09 label:

- **Flag in a world-readable log file (CWE-532).** The old `/temp_logs/error.log`
  wrote the flag into every stack trace. That is sensitive-data-in-logs, and it let
  a player finish the realm without ever touching alerting. Records are now redacted
  before write (`redactSecrets`), and the endpoint answers `410 Gone` with an
  explanation rather than 404, so older walkthroughs get a pointer instead of a dead
  end.

- **LFI via path traversal in the log viewer.** The old `/admin/logs` joined user
  input onto a base path with a comment noting the missing check. That is A01 Broken
  Access Control — Asgard's category. Filenames now resolve against a fixed
  allow-list, so `../` is not expressible.

Both were replaced by the failure that is genuinely A09: the events were all there,
and nothing raised an alarm.

## Realm chaining

**Unlocked by:** Niflheim (A10) — its crash report supplies the console URL, the
diagnostic credential, and correlation ID `a7f3c1d8`.
**Unlocks:** Svartalfheim (A08)

Before v2.0.0 the Niflheim crash report directed players to
`../sensitive/niflheim_correlation.log`, a file that existed nowhere in the
repository, the Docker image, or any seed script. The chain terminated in a 404.
The archive is now materialised at boot by `seedLogArchive()` and the crash report
points at the real artefact.

## Remediation

- Alert on security-relevant events; do not merely record them.
- Verify the alert path end to end with synthetic detections on a schedule. Never
  infer alerting health from configuration validity.
- Treat detection rules and alert routing as privileged configuration: authorise,
  audit, and alert on every change.
- Alarm on the *absence* of expected alerts. A channel silent for months is a fault,
  not good news.
- Correlate across service boundaries. Per-service logs cannot show a chain that
  crosses between them.

## Development

```bash
npm install
npm run dev        # ts-node, port 3000
npm test           # 87 tests
npm run test:coverage
npm run lint
```

`createApp(config)` is exported from `src/index.ts` so integration tests can drive
the realm without binding a port.

## Structure

```
realms/helheim/
├── src/
│   ├── config/index.ts              # realm config incl. SOC credential
│   ├── data/event-archive.ts        # deterministic archive + Fenrir chain
│   ├── middleware/soc-auth.ts       # console gate
│   ├── routes/
│   │   ├── admin.ts                 # allow-listed archive viewer
│   │   ├── memorial.ts              # forum + redacting logger
│   │   └── soc.ts                   # SIEM API
│   └── services/
│       ├── detection-engine.ts      # rules, filter, sink, replay
│       ├── log-archive.ts           # materialises niflheim_correlation.log
│       └── soc-state.ts             # runtime state; the missing audit trail
├── public/
│   ├── index.html                   # memorial forum
│   └── soc.html                     # Níðhöggr console
└── tests/
    ├── integration/exploit.test.ts  # full player walk + negative flag routes
    ├── integration/soc-api.test.ts  # API surface & validation
    └── unit/detection-engine.test.ts
```
