# Changelog

All notable changes to Project Yggdrasil will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2026-07-26

> **Helheim rebuilt around alerting.** Realm 9 was labelled A09:2025 but taught
> sensitive-data-in-logs (CWE-532) and path traversal (CWE-778's neighbour, A01) —
> neither of which is the category. It now teaches the failure the 2025 rename
> exists to name: complete, accurate logging that alerts nobody. Also fixes a dead
> cross-realm pointer that broke Niflheim → Helheim progression. No changes to the
> gatekeeper API, flag oracle API, flag format, or the progression contract.

### Changed

- **Helheim (realm 9) rebuilt as the Níðhöggr SIEM** — the central log-correlation service the platform already referenced but never implemented. The realm now models an alert pipeline (`rule match → severity filter → sink delivery`) that is broken at three independent stages, none of which produces an error: the only cross-realm correlation rule ships disabled "pending tuning", the severity floor is set to `CRITICAL` while no rule emits above `HIGH`, and the alert sink points at a decommissioned collector that accepts writes and discards them. Each fault suppresses detection on its own; all three must be repaired.
- **The Helheim flag is no longer stored anywhere.** It is emitted as the body of a delivered alert and exists only once that alert has survived every pipeline stage — making detection, rather than extraction, the win condition. Integration tests pin the negative property: the flag is absent from the event archive, the log files, the rule catalogue, the pipeline config, and the alert store until a replay delivers it.
- **Helheim difficulty** raised from Easy (10 min) to Medium (25 min), and its manifest, hints, and README rewritten. The previous manifest described three mutually inconsistent realms: its `vulnerabilities` block documented log exposure, its `hints` described a client-trusted admin role that was never implemented, and the source implemented Basic auth plus path traversal.
- **`GET /temp_logs/*` now returns `410 Gone`** with an explanation rather than serving flag-bearing logs, so existing walkthroughs get a pointer instead of a dead end.
- **Helheim log records are redacted before write** (`redactSecrets` strips flags, authorization headers, and inline credentials). The logging in this realm is now deliberately *correct* — and the realm is still undetectable, which is the lesson.

### Added

- **Cross-realm correlation engine** (`detection-engine.ts`): declarative single-event and time-windowed correlation matchers, a severity filter, pluggable alert sinks (`null` / `console` / `soc-queue`), and per-stage drop counters. Delivered correlation alerts are widened from the matched trigger events to the full incident window, so an alert carries the whole chain rather than the three records that happened to fire it.
- **Seeded event archive**: ~1800 deterministically generated events (fixed seed, byte-identical across restarts) concealing the five-event "Fenrir" intrusion that crosses the Niflheim → Helheim trust boundary on a single source host, plus three decoys that each share one attribute with the intrusion but not the crossing.
- **Níðhöggr SOC console** (`/admin`) and SIEM API (`/api/soc/*`): event query with filters and paging, detection-rule catalogue and mutation, alert pipeline configuration, replay with honest stage diagnostics, delivered-alert retrieval, control-plane audit trail, and forwarded-event ingest.
- **Helheim test suite**: 87 tests (94.6% statements, 87% branches) covering the engine, the full player walk, API validation, and the negative flag-reachability properties.

### Fixed

- **Niflheim → Helheim progression was broken.** Niflheim's crash report directed players to `../sensitive/niflheim_correlation.log`, a file that existed nowhere in the repository, the Docker image, or any seed script — the chain terminated in a 404. The archive is now materialised at boot and the crash report points at the real artefact, citing correlation ID `a7f3c1d8`. Its "look for entries matching timestamp" hint, which used a live timestamp that could never match the archive, was replaced with the correlation ID.
- **Helheim's landing page was never served.** `index.html` lived in `src/public/`, but both the dev and production paths resolve `../public` — `GET /` fell through to the error handler in every environment. The file was moved to the served directory.
- **Stored XSS in the Helheim memorial forum**: submitted names and messages were rendered via unescaped `innerHTML`. Not a declared vulnerability for this realm, so it misled players and scanners alike; forum content is now escaped.
- **A bare `data/` rule in `.gitignore` silently excluded realm TypeScript sources** in any `src/data/` directory — the same failure mode as the `*.d.ts` bug fixed in 1.4.1, and it would have broken clean-clone builds again. Scoped negations added for `*/src/data/`; generated `dist/data` and `coverage/data` remain ignored.

### Category alignment

Two mechanics were removed from Helheim because they taught other realms' categories under an A09 label:

- **Flag written into a world-readable `error.log`** (CWE-532, sensitive data in logs) — this let a player finish realm 9 without ever touching alerting.
- **Local file inclusion via path traversal in `/admin/logs`**, whose own source comment read `VULNERABILITY: A01:2025 - Broken Access Control`. Access control belongs to Asgard. Filenames now resolve against a fixed allow-list.

Both were replaced by the failure that is genuinely A09: every event was logged, and nothing raised an alarm.

## [1.4.1] - 2026-07-21

> **Clean-clone build fix.** A fresh checkout of `v1.4.0` failed `make yggdrasil`
> at the gatekeeper build stage. Patch-only — no runtime or API changes.

### Fixed

- **`make yggdrasil` failed on a fresh clone of v1.4.0** with 19 `TS2339` errors across five files (`req.user`, `req.session.userId`, `req.session.username` had no types). The hand-written declaration `gatekeeper/src/types/express.d.ts` was silently excluded by the broad `*.d.ts` rule in `.gitignore`, so it was never committed — the build only succeeded on machines that already had the file on disk. The declaration is now committed, with a scoped `.gitignore` negation so hand-written ambient declarations aren't swept up by the build-output rule (generated `.d.ts` stay ignored). Reported and fixed by **@pcc402-art** in #14.

### Added

- **CI clean-clone typecheck**: the `lint` job now runs a full `tsc --noEmit` for both the gatekeeper and flag-oracle. Because CircleCI's `checkout` contains tracked files only, this reproduces a fresh clone and fails fast if a required source is gitignored or never committed — closing the gap that let the above bug ship.

## [1.4.0] - 2026-07-09

> **The Ascent — landing page redesign & documentation overhaul.** Reframes the
> landing page as a vertical climb of the World Tree and brings the docs in line
> with a public, marketing-ready repository. UI and copy changes only — no changes
> to realm vulnerabilities, flags, or the progression contract.

### Added

- **"The Ascent" landing page**: the realm map is now a vertical climb of the World Tree — Asgard at the crown, Niflheim at the roots — over new key-art, with a luminance-graded "data-sap" trunk connecting the realms.
- **Realm emblems**: each realm gained a distinct icon (👑 Asgard … 🌫️ Niflheim), served from realm metadata and reused across the UI.
- **New World Tree artwork**: optimized WebP hero, map backdrop, and README banner (converted from source key-art; each well under page-weight budget).
- **Frontend & documentation tests**: React component tests (jsdom + Testing Library) for the Hero and RealmMap, realm-metadata invariant tests (ten realms, 1:1 OWASP mapping, monotonic color ramp, asset existence), a `/realms` API integration test, a copy regression guard, and a Playwright landing-page suite — all wired into CI for local/CI parity.

### Changed

- **"Nine Realms" → "Ten Realms"** everywhere in the UI and messaging (the platform has always had ten realms); corrected in the hero, realm map, loading screen, leaderboard, Discord completion broadcast, and the realm-locked error page.
- **Realm color palette** recalibrated into a strict light-ascending ramp so brightness increases as the player climbs, reinforcing progress subconsciously.
- **Documentation overhaul**: `README.md`, `QUICKSTART.md`, `SECURITY.md`, and `CONTRIBUTING.md` rewritten for a public audience — accurate repository URLs and paths (`docs/`, not `.docs/`), corrected supported-version table, refreshed roadmap reflecting shipped leaderboard/hints/Discord features, and consistent `docker compose` usage.

### Fixed

- **Leaderboard & hints returned HTTP 500** (regression present since 1.3.0): the gatekeeper's `ProgressionClient` was constructed with the flag-oracle base URL string but its constructor expected the whole config object, so every request went to `undefined/…` and failed with "Invalid URL". The constructor now takes the base URL directly, restoring the "Hall of the Slain" leaderboard and "Mimir's Counsel" hints. Added a `ProgressionClient` unit test that pins URL construction.
- **Hints panel defaulted to the internal sample realm** (which has no hints), greeting visitors with an error. It now excludes the sample realm and defaults to the entry realm (Niflheim).
- **Lint & format debt** blocking a clean CI run: removed unused imports and unformatted files in the gatekeeper and flag-oracle (ESLint now passes with zero errors; Prettier clean).
- **Local/CI test parity**: the time-based rate-limit reset test is now opt-in via `RUN_TIME_BASED_TESTS` with an appropriate timeout (previously skipped in CI but unrunnable locally); the smoke test's sample-realm check now matches the "realms are accessible to everyone" model.

## [1.3.0] - 2026-06-25

> **Yggdrasil Gamification & Architecture Simplification** — adds a global leaderboard,
> progressive hints, and Discord broadcasts, while decoupling observability for faster
> local startup. Backward-compatible.

### Added

- **Global Leaderboard & Scoring Engine** (#6): escalating per-realm points (harder realms award more), a Redis sorted-set leaderboard with O(log n) ranking, `GET /leaderboard` on the flag oracle and gatekeeper (with privacy-masked `Seeker-XXXX` handles), and a "Hall of the Slain" leaderboard on the landing page.
- **Progressive Hints System** (#5): per-realm hints authored in each realm's `manifest.json` (single source of truth) and bundled into the oracle via `scripts/sync-hints.ts`. Revealing a hint applies a point penalty but **never blocks progression**. New `GET /hints/:realm` and `POST /hint` endpoints, gatekeeper proxy routes, and a "Mimir's Counsel" hint panel in the UI.
- **Discord Webhook Broadcasts** (#7): opt-in via `DISCORD_WEBHOOK_URL`. Successful flag captures, first-bloods, and full-platform completions are announced to a Discord channel. Fire-and-forget and non-blocking — a slow/broken webhook never affects flag submission.
- **Community**: Discord invite badge and "Join Our Community" section in `README.md`, plus invite links in `CONTRIBUTING.md`.
- **`make up-observability`**: convenience target to start the core stack plus the observability stack together.

### Changed

- **Observability is now opt-in** (#9): `prom-client` and `winston-loki` are lazy-loaded and gated behind `OBSERVABILITY_ENABLED` (default `false`), so neither is loaded on the default local path — reducing startup cost. Default `make up` no longer starts the Prometheus/Loki/Promtail/Grafana containers.
- **Auth middleware refactor** (#8): removed the unused legacy `optionalAuth` fallback and clarified the `requireAuth` (strict) vs `ensureSession` (anonymous-friendly) contracts.
- **Redis is now the primary progression store** when `REDIS_URL` is set; the file-based repository remains the local/dev fallback. `UserProgression` gained `score`, `completions`, and `hintsRevealed`.
- **`/csrf-token`** is now available to any session (previously auth-only), enabling anonymous players to perform CSRF-protected actions such as flag submission and hint reveals.

### Fixed

- **flag-oracle startup crash**: a missing or weak `FLAG_MASTER_SECRET` no longer crashes the service on boot — dynamic flag generation (`/generate`) is disabled gracefully instead.
- **Broken Redis repository wiring**: `FileBasedFlagRepository` is now exported/constructed correctly, making the Redis-primary path functional (was a compile/runtime break).
- **Missing Express type augmentation**: added `gatekeeper/src/types/express.d.ts` for `req.user` / session typing, resolving 18 pre-existing `tsc` errors that also broke the Docker backend build.
- **flag-oracle test setup**: Jest now loads the `reflect-metadata` polyfill, unblocking three suites that previously failed to run.

### Security

- The secret `DISCORD_WEBHOOK_URL` is kept out of all tracked files (lives only in the gitignored `.env`); only the public Discord invite link is published in docs.

## [1.2.0] - 2026-04-13

### Removed

- **Enterprise Edition Concept**: Removed `YGGDRASIL_EDITION` environment variable and all community/enterprise bifurcation from the codebase, documentation, and Makefile.
- **`requireAdmin` Middleware**: Deprecated enterprise admin panel middleware removed from `gatekeeper/src/middleware/auth.ts` and associated tests.
- **Bundled Observability Stack**: Loki, Promtail, Prometheus, and Grafana services removed from the default `docker-compose.yml`. Users no longer need to pull these images for basic usage.

### Added

- **`docker-compose.observability.yml`**: New optional compose file for users who want the observability stack. Start with: `docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d`

### Changed

- **Unified Startup Messages**: `make up` now shows a single, unified startup message (no edition-conditional output).
- **Documentation**: All docs updated to reflect observability as opt-in and removal of edition concept:
  - README.md: Removed Editions table, bifurcated verification blocks, and YGGDRASIL_EDITION config section
  - QUICKSTART.md: Unified verification output
  - DEVELOPER.md: Removed edition testing guidance
  - QUICK_REFERENCE.md: Updated commands and architecture diagrams
- **`.env.example`**: Removed `YGGDRASIL_EDITION` variable and edition configuration comments.

### Notes

- This is a **breaking change** for users who relied on `YGGDRASIL_EDITION=enterprise` to auto-start the observability stack. They should now use the compose override file instead.
- The `requireAuth`, `ensureSession`, and `optionalAuth` middleware functions remain unchanged.
- Observability config files (`config/loki/`, `config/prometheus/`, `config/grafana/`) are preserved for use with `docker-compose.observability.yml`.

## [1.1.0] - 2026-01-03

### Added

- **Single Command Startup**: New `make yggdrasil` command that runs both `make setup` and `make up` in one step, simplifying the onboarding experience for new users.
- **Edition Configuration**: New `YGGDRASIL_EDITION` environment variable to differentiate between Community and Enterprise editions.
  - `community` (default): Shows streamlined startup message with Landing Page, Health Check, and Quick Start steps 1-2.
  - `enterprise`: Shows full startup message including Login URL, Observability stack (Grafana, Prometheus, Loki), and all 3 Quick Start steps.

### Changed

- **Startup Messages**: The `make up` command now displays tiered startup messages based on the configured edition.
- **Documentation**: Updated all documentation files to reflect the new `make yggdrasil` command:
  - README.md
  - QUICKSTART.md
  - CONTRIBUTING.md
  - .docs/guides/DEVELOPER.md
  - .docs/workflows/CONFIGURATION_CHECKLIST.md
  - .docs/workflows/QUICK_REFERENCE.md
  - realms/niflheim/README.md

### Notes

- This is a backwards-compatible release. Existing users can continue using `make setup` followed by `make up`.
- The default edition is `community`, which provides a simplified experience for guest users.
- Enterprise users should set `YGGDRASIL_EDITION=enterprise` in their `.env` file to access full features.

---

## [1.0.0] - 2025-12-11

### Added

- Initial release of Project Yggdrasil
- 10 Norse mythology-themed realms aligned with OWASP Top 10:2025
- Gatekeeper control plane with session management and CSRF protection
- Flag Oracle for flag validation and progression tracking
- Observability stack (Prometheus, Loki, Grafana)
- Comprehensive testing suite (unit, integration, E2E, security)
- Full documentation including operator and developer guides
- Visual polish with professional themes across all realms
- Branded error pages with intentional leak preservation
- Mobile-responsive design (WCAG AA compliant)

### Realms

| Realm | Order | OWASP Category |
|-------|-------|----------------|
| Niflheim | 10 (Entry) | A10:2025 - Exceptional Conditions |
| Helheim | 9 | A09:2025 - Logging & Alerting Failures |
| Svartalfheim | 8 | A08:2025 - Software/Data Integrity |
| Jotunheim | 7 | A07:2025 - Authentication Failures |
| Muspelheim | 6 | A06:2025 - Insecure Design |
| Nidavellir | 5 | A05:2025 - Injection Vulnerabilities |
| Vanaheim | 4 | A04:2025 - Cryptographic Failures |
| Midgard | 3 | A03:2025 - Supply Chain Failures |
| Alfheim | 2 | A02:2025 - Security Misconfiguration |
| Asgard | 1 (Final) | A01:2025 - Broken Access Control |

---

[Unreleased]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Kaademos/kademos-yggdrasil/releases/tag/v1.0.0
