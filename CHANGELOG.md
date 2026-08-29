# Changelog

All notable changes to Project Yggdrasil will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-08-29

> **Flags become deployment secrets.** Every realm flag was reachable in this
> repository — as fallbacks in realm config, as a hardcoded default set in the Flag
> Oracle, and as literals in two SQL seeds — and because every `*_FLAG` in `.env`
> shipped empty, those published values were the ones actually in play. Flags are now
> generated per install, realms refuse to start without one, and CI fails if a literal
> reappears. **Upgrading requires operator action — see Migration below.**

### Security

- **Realm flags are no longer present in the repository.** They were exposed in three
  independent places: a `process.env.FLAG || 'YGGDRASIL{…}'` fallback in all ten realm
  configs plus `_template` and `sample-realm`; a hardcoded `defaultFlags` array in
  `FileBasedFlagRepository.getValidFlags()` that was the Oracle's entire accepted set;
  and literal values in `realms/nidavellir/init-db.sql` and `realms/asgard/init-db.sql`,
  which are what those two realms actually serve. Every value has been removed from
  source, seeds, documentation and test fixtures.
- **Realms fail closed.** `loadConfig()` throws when `FLAG` is unset, in every realm and
  in the Java realm's `application.properties`. There is no default to fall back to.
- **Flags are generated per deployment.** `scripts/generate-flags.sh` creates a unique
  flag per realm and a 64-character `FLAG_MASTER_SECRET`, written only to the gitignored
  `.env`. `make setup` runs it; `make rotate-flags` rotates everything.
- **The Oracle sources its valid-flag set from the environment.** New
  `flag-oracle/src/config/realm-flags.ts` builds it from `<REALM>_FLAG` joined to
  `REALM_ORDER`, with no built-in defaults — an unconfigured realm has no valid flag
  rather than a public one. This also fixes a latent bug: Vanaheim, Midgard, Alfheim and
  Asgard were missing from the hardcoded set entirely and could never be captured.
- **`no-committed-flags` CI job** fails the build if a `YGGDRASIL{…}` literal reappears
  in application source, so the fallback pattern cannot return unnoticed.
- **Published rules of engagement** for hosted instances: `/.well-known/security.txt`
  (RFC 9116, environment-driven), an in-app scope banner shown only on non-local origins,
  and a "Hosted Instances — Rules of Engagement" section in `SECURITY.md` naming transit
  providers, other players and denial-of-service as out of scope.

### Added

- **GitHub Codespaces support** (`.devcontainer/`) — docker-in-docker, flag generation on
  create, stack start on every resume, port 8080 forwarded. Play in a browser with nothing
  installed locally, on the player's own quota. Practice only; see Notes.
- **`no-committed-flags` CircleCI job**, gating `build-and-integration`, plus two new
  assertions in that job: the flag seeded into Nidavellir's database must match the one
  generated into `.env`, and a realm image must refuse to boot with `FLAG` unset. CI stays
  entirely on CircleCI.
- **`make rotate-flags`** — regenerates every flag and recreates services in one step.
- **Community health files**: `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, with
  security-specific standards), pull request template, `CODEOWNERS`, and Dependabot
  configuration scoped to the control plane and toolchain.

### Changed

- **Realm databases are no longer persisted.** Nidavellir and Asgard never write to their
  databases — they are read-only challenge fixtures — and the named volumes caused two
  bugs: Postgres only runs `docker-entrypoint-initdb.d` on an empty data directory, so a
  stale volume kept serving the previous deployment's flag after rotation, and injected
  player state outlived the session. Their seeds are now `init-db.sql.template` files with
  a `__REALM_FLAG__` placeholder, substituted at container init by
  `realms/_shared/init-db-with-flag.sh`.
- **CircleCI runs on feature branches.** Every job was filtered to `main` and `develop`
  only, so a pull request received no CI until after it had already been merged. The
  filters now also match the conventional branch prefixes from `CONTRIBUTING.md`.
- **`build-and-integration` generates flags instead of copying `.env.example`.** The
  example ships with empty flags and realms now fail closed, so the old `cp` would have
  broken the job; it runs `make setup`.
- **`make setup` generates secrets idempotently.** It previously only did so when `.env`
  was absent, so a hand-written or upgraded `.env` kept its placeholders forever.
- **`make validate-env` fails closed** instead of silently copying `.env.example`, and now
  runs `scripts/verify-env.sh` — which was present in the repository but never invoked by
  anything, and which now treats an empty value as missing rather than only flagging
  placeholders.
- **CORS-adjacent deployment configuration**: `SECURITY_CONTACT` and `PUBLIC_ORIGIN`
  drive `security.txt` without a rebuild.

### Fixed

- **Alfheim's test suite hung rather than exiting.** `IMDSService` starts an hourly
  cleanup `setInterval` in its constructor that nothing cleared, leaving an open handle
  after the last assertion. The interval is now `unref()`ed — matching the existing
  convention in `SessionStore.startCleanup()` — and the suite destroys the service in
  `afterEach`. Runtime went from a 120s+ hang to 1.1s.
- **`auth-rate-limiter` failed under parallel load.** Two cases raced a 100ms window with
  a real 150ms sleep; a sleep is a lower bound, and so is the scheduling delay before the
  assertion. Both now move the clock with `jest.advanceTimersByTime`. 157ms to 4ms.
- **Postgres healthchecks reported healthy mid-seed.** `pg_isready` probed the unix
  socket, which is available during `initdb` while the server is still running init
  scripts. Both realm databases now probe over TCP, which `initdb` deliberately does not
  expose until seeding completes.
- **`make test-lint` was failing on `main`** — a Prettier violation in
  `gatekeeper/src/repositories/user-repository.ts`.

### Removed

- `.github/workflows/.c.md` — a complete CI workflow saved with a `.md` extension to
  disable it. Its secret-scan and integration coverage already exists in CircleCI, which
  remains the only CI system for this project.
- `realms/nidavellir/src/public/index.html.old` — an orphaned build artefact.
- The `nidavellir_db_data` and `asgard_db_data` volumes.

### Migration

Upgrading from 1.6.x **requires operator action**. An existing deployment will refuse to
start until flags exist.

```bash
git pull && git checkout v2.0.0
make setup            # generates a flag per realm + FLAG_MASTER_SECRET into .env
docker compose down
docker volume rm yggdrasil_nidavellir_db_data yggdrasil_asgard_db_data   # now unused
make up
```

- Back up `FLAG_MASTER_SECRET` from `.env`. Losing it invalidates every per-user flag the
  Oracle has ever issued.
- **All existing player progression stops validating**, because every flag value changes.
  Communicate this before upgrading a shared instance.
- Any deployment that hand-wrote `data/flags.json` keeps working: it is still read when no
  `<REALM>_FLAG` variables are configured.

### Notes

- **The old flag values remain in git history deliberately.** They are dead — flags are
  now generated per deployment — and rewriting history would break every fork and open
  pull request while not actually deleting anything, since GitHub retains unreachable
  objects and forks keep their own copies. The response to a leaked credential is to
  rotate it and make the leak class impossible; both are done. Reasoning is recorded in
  `docs/guides/SECRETS-MANAGEMENT.md`. A full history audit found no live credentials —
  the `AKIAIOSFODNN7EXAMPLE` string in Alfheim is AWS's own published documentation
  example key, used as fixture data.
- **Codespaces play is unranked practice.** A player who runs the stack also runs the
  Gatekeeper, so no score originating on player-controlled compute can be trusted. Ranked
  play requires a hosted instance.
- Dependabot is deliberately **not** pointed at `realms/`: those packages are pinned to
  vulnerable versions on purpose, and Midgard's supply-chain challenge depends on specific
  compromised package versions. Realm dependencies are updated by hand, as content changes.


## [1.6.0] - 2026-07-27

> **Server-side achievement system.** Named, earned markers derived from a
> player's capture history — speed, skill, and progress — evaluated on capture and
> exposed via the progression API. Backend only; badge rendering in the leaderboard
> UI follows separately. Contributed by **@Radityaaa27** in #22.

### Added

- **Achievement system** (#18): six achievements across three groups — `SWIFT` and `RAGNAROK_RUN` (speed), `UNAIDED` and `SIGHTLESS` (skill), `FIRST_BLOOD` and `ASCENDANT` (progress). Definitions live in a declarative table of predicates over the completion history, so adding an achievement is a data change rather than new branching logic.
- **`GET /achievements/:userId`** on the flag oracle, returning a user's earned markers.
- **`EarnedAchievement[]` persisted on `UserProgression`**, de-duplicated by `(id, realm)` so an award can never be granted twice. `normaliseProgression` defaults the field, so records written before this release deserialise unchanged.
- **Backfill routine** (`npm run backfill:achievements`) for progression records that predate the system. Realm-scoped awards are dated to that realm's own `completedAt` and global ones to the final scored completion, so backfilled markers line up with when the player actually earned them. Safe to run repeatedly — a second pass awards nothing.
- **`AchievementService` test suite**: 36 tests covering every predicate, both scope filters, the on-capture path, backfill dating, first-blood attribution, and idempotency.

### Fixed

- **First blood was never recorded unless Discord was enabled.** `recordRealmCapture()` — the global single-writer signal for "has any player taken this realm yet" — was called inside `broadcastCapture()`, behind the broadcaster's `isEnabled()` check. Discord is opt-in and off by default, so on a default deployment the signal never fired. It is now resolved once in the capture path and passed to both the broadcaster and the achievement evaluator. Found and fixed by **@Radityaaa27** while implementing #18.

### Security

- Achievement inputs are entirely server-derived: `completedAt` is server-set, `hintsUsed` is server-counted, and first blood comes from the repository's single-writer signal. No achievement can be earned from a client-supplied value, and the on-capture award timestamp is taken from the server clock rather than any completion payload. Pinned by test.

### Notes

- `SWIFT_WINDOW_MS` (15 min) and `RAGNAROK_WINDOW_MS` (6 h) are calibrated against the per-realm estimates in `docs/instructor/README.md` — 30–90 minutes per realm and 8–10 hours for a full ascent — so each badge means "notably faster than expected" rather than "finished at all".
- Achievement evaluation is wrapped so a failure cannot break flag submission; a capture still succeeds if awarding throws.

### CI/local test parity

The CI config and the Makefile had drifted into describing two different test
suites. Both now run the same set, because the Makefile is the only place a test
command is defined and CI invokes its targets.

- **Ten realm packages — 472 tests — ran in neither CI nor any make target.** Realm regressions were completely invisible to the pipeline. `make test-realms` now runs all ten and CI calls it.
- **Two Playwright specs ran nowhere**: `tests/e2e/journey/isolation.spec.ts` and `tests/scanner-benchmark/manifest-accuracy.spec.ts`. CI named five specs explicitly, so any spec not on that list was silently skipped forever. `make test-e2e` now runs the **whole** suite rather than a hand-maintained file list.
- **`make test-e2e-collect`**, on its own CI step, runs the suite unqualified and asserts it still collects at least 100 tests across 6 files. This is the guard that was missing: the collection break above exits non-zero, but nothing ever invoked the suite without a path filter, so it hid for months. Verified against both failure modes — a Jest-style file under `tests/`, and a `testMatch` that matches nothing.
- **New Makefile targets**, each the single definition of a suite: `test-lint`, `test-unit`, `test-realms`, `test-manifests`, `test-attack-traces`, `test-e2e-collect`, `test-e2e`, `test-integration`, `test-security`. `make test` is everything that needs no running platform (~34s); `make test-all` adds the suites that need `make up`.
- **The soft-fail list lives in one place.** Previously CI marked two specs non-blocking with inline `|| echo` while the Makefile had no equivalent, so local runs and CI applied different policies. `E2E_SOFT_SPECS` in the Makefile now drives both, via a `PW_SKIP` hook in `playwright.config.ts`.
- **CI no longer invokes a test runner directly** — no `npm test`, `npx playwright test`, `npx tsc`, `prettier` or `jest` anywhere in `.circleci/config.yml`. It also drops the `chmod +x` preamble on every script, because the executable bits are now correct in git (22 of 29 scripts were committed mode 100644).
- **Policy 11 in `scripts/validate-circleci.sh`** enforces this going forward: CI must not call a runner directly, every `make` target CI names must exist, and every suite target must be reached by CI. Verified it catches drift in both directions.
- **Coverage is still collected** — `make test-unit JEST_FLAGS=--coverage` in CI keeps one command definition with a coverage knob, rather than a forked invocation.
- Also folded into shared targets so they run identically in both places: `create-all-manifests.sh`, `validate-attack-traces.sh`, `test-e2e-journey.sh`, `verify-realms.sh`, `validate-circleci.sh`, `scan-secrets-enhanced.sh` and the m3/m4/m5 suites — several of which previously ran on only one side. Removed a redundant CI step that ran flag-oracle's `attack-trace-integration` suite a second time, and a duplicate `smoke-test.sh` invocation.

### Fixed — test suites that could not have gated anything

Wiring the realm suites into CI required them to actually pass, which surfaced four separate defects:

- **`realms/vanaheim` had a test that failed ~40% of runs** and contradicted its own realm. `should generate different tokens for different userIds` asserted that two tokens never share a value — but Vanaheim *is* A04 Cryptographic Failures, its PRNG is an LCG with deliberately poor mixing, and colliding tokens are the vulnerability being taught. Split into a deterministic assertion (the userId always shifts the seed) and a format check, with the collision behaviour documented rather than asserted against. 8/8 clean runs after.
- **`realms/alfheim/tests/unit/imds-service.test.ts` did not compile** (`TS18047: 'paths' is possibly 'null'`), so the whole suite was skipped. Fixing it brought alfheim from 51 to **70** passing tests.
- **`realms/_template`'s config test asserted `nodeEnv === 'development'`** while jest sets `NODE_ENV=test`. The realms had already been corrected to accept either; the template had drifted behind them.
- **`realms/asgard`'s recon and full-chain suites** read `realms/asgard/public/.git/*` — a fixture that **cannot exist in the repository**, because git refuses to index any path containing a `.git` component (`git add` exits 0 and stages nothing), and nothing generates it at build or run time. Asgard's other **122** tests now gate; the two fixture-dependent suites are skipped via `ASGARD_SKIP` in the Makefile with the reason recorded. The fixture needs generating — same class of defect as the dead Niflheim correlation log fixed above.

### Fixed — secret scanner was failing on every run

`scripts/scan-secrets-enhanced.sh` exited 1 on a clean checkout of `main`, which failed the `security` CI job and therefore blocked `build-and-integration` (it declares `requires: security`).

The cause was a shell-globbing bug. `EXCLUDE_PATTERN` was a space-separated string iterated **unquoted**, so `*.md` was pathname-expanded by the shell against the repo root before reaching grep. The loop therefore excluded exactly five files — `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `QUICKSTART.md`, `SECURITY.md` — while every `docs/**/*.md` was still scanned, despite the comment reading "exclude all markdown for documentation". The flag-format examples in `docs/guides/DEVELOPER.md` and `docs/workflows/QUICK_REFERENCE.md` then tripped the HIGH gate. Exclusions are now arrays expanded quoted, so globs reach grep intact. Confirmed the scanner still detects a planted AWS key (CRITICAL, exit 1) rather than having been blinded.

### Maintenance

- **Migrated every TypeScript project off the deprecated `moduleResolution: "node"` (node10)**, which TypeScript 7.0 will stop supporting. All 14 backend `tsconfig.json` files now use `module`/`moduleResolution: "node16"`; the frontend already used `"bundler"` and is unchanged. Emitted JavaScript was diffed before and after and is byte-identical, so this is a configuration change with no runtime effect. Note that `"typescript": "^5.3.3"` currently resolves to 5.9.3, which rejects the `ignoreDeprecations: "6.0"` escape hatch — migrating was the only fix that does not break the build.
- **Fixed the `sync-hints` script**, which passed `--compiler-options '{"module":"commonjs"}'` and began failing with `TS5110` once `moduleResolution` moved to `node16`. The override now specifies both options consistently.
- **The Playwright suite was collecting zero tests.** `playwright.config.ts` set `testDir: './tests'` with no `testMatch`, and Playwright's default matches `*.test.ts` as well as `*.spec.ts`. `tests/manifests/manifest-validator.test.ts` is a Jest file, so it threw `ReferenceError: describe is not defined` during collection and collapsed the whole run to `Total: 0 tests in 0 files`. The failure exits non-zero; it went unnoticed because **every CI step named an explicit spec path**, so nothing ever invoked the suite unqualified. `testMatch: '**/*.spec.ts'` now pins the convention the repo already follows, and a dedicated CI step runs the suite unqualified so the same class of break cannot hide again. Bare `npx playwright test` collects **142 tests across 8 files**.
- **Removed the placeholder `webServer` block** from `playwright.config.ts`. Its command was an `echo`, so with the platform down Playwright aborted every run with "Process from config.webServer exited early" — including suites needing no server at all. The platform is started out of band (`make up`, or `docker-compose up -d` in CI); suites that need it now fail with a plain connection error while the rest still run.
- **Converted the orphaned manifest test into a running Playwright spec.** It was a Jest file in a repo with no root Jest config, no root Jest dependency, and no CI or Makefile reference — it had never run. Roughly half its assertions were tautological (`expect(0).toBeGreaterThanOrEqual(0)`, literals matched against their own regexes); those are now pointed at the real manifests, so they assert genuine invariants: ten realms, unique names and levels, full A01–A10 coverage, realm name matching its directory, and well-formed CWE/CVSS/endpoint data everywhere. 19 tests, wired into the existing `validate-manifests` CI job. No browser or running platform required.
- **Fixed `realms/_template`'s lockfile**, which recorded 4 devDependencies against the 12 in `package.json` — `npm ci` failed with `EUSAGE`, so the template realm could not be bootstrapped the documented way.
- **Corrected a structurally wrong mock** in `gatekeeper/tests/realms-route.integration.test.ts`: `realmGate` was mocked as an object with a `checkAccess` method, but `createRealmGate` returns a factory called as `realmGate(realmName)`. The mock only survived because that test passes zero realms, leaving the gate unreachable. Surfaced once the parameter was typed.
- **Cleared all gatekeeper lint warnings** (26 → 0) with the same approach used in flag-oracle: real types for injected config, `RequestHandler` for middleware parameters typed to what the function actually uses, narrowed error handling (`upstreamStatus` / `errorMessage` helpers instead of `catch (error: any)`), a declared shape for the captured response body, and the removal of a now-redundant `req.session as any` cast — `src/types/express.d.ts` has declared `SessionData.userId` since 1.4.1.
- **Cleared all flag-oracle lint warnings** (8 → 0), without weakening any rule:
  - `container.resolve<any>('Config')` and `FlagService`'s `config: any` now use real types. `FlagConfig` was widened to accept both `masterSecret` (used by tests constructing the service directly) and `flagMasterSecret` (supplied by the DI container), which the constructor already read from either.
  - `sanitizeForLogging` moved from `any → any` to an overloaded `Record<string, unknown>` / `unknown` signature, so callers that spread the result keep their types without a cast.
  - The four `no-console` warnings in `services/logger.ts` are scoped disables with a stated reason: that class emits structured JSON lines to stdout as its transport for container log collection, alongside winston. It is not stray debug output, so silencing beat rewriting it.

### Documentation

- **Corrected two miscategorisations repeated across the summary tables.** `README.md`, `QUICKSTART.md`, `SECURITY.md`, `docs/SCANNER-BENCHMARKING.md`, `docs/instructor/README.md`, `docs/guides/OPERATOR_GUIDE.md`, `docs/workflows/ASVS_COMPLIANCE.md`, and `realms/_shared/ERROR-HANDLING-README.md` described Helheim as "Memorial Forum — LFI" / "exposed logs" — stale as of 1.5.0 — and described **Niflheim as SSRF**. Niflheim has never contained an SSRF: it has no proxy and no user-controlled outbound request. `docs/realms/10-niflheim.md` has always documented it correctly as an unhandled exceptional condition; the error existed only in the summary tables, which is where readers form their mental model of the tree.

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

[Unreleased]: https://github.com/Kaademos/kademos-yggdrasil/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.6.0...v2.0.0
[1.6.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Kaademos/kademos-yggdrasil/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Kaademos/kademos-yggdrasil/releases/tag/v1.0.0
