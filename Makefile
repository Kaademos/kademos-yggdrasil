.PHONY: help setup up up-observability down restart clean logs validate-env install \
	dev-gatekeeper dev-flag-oracle info urls build-player build-instructor copy-stripper yggdrasil \
	test test-all test-lint test-unit test-realms test-manifests test-e2e-collect \
	test-integration test-e2e test-security test-attack-traces quick-test test-landing test-health test-realms-api

help:
	@echo "╔════════════════════════════════════════════════════════════════╗"
	@echo "║          Project Yggdrasil - Development Commands             ║"
	@echo "╚════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📦 Setup & Installation:"
	@echo "  make yggdrasil     - One command to setup and start everything"
	@echo "  make setup         - First-time setup (create .env, install deps)"
	@echo "  make rotate-flags  - Rotate all realm flags (invalidates captures)"
	@echo "  make install       - Install dependencies for all services"
	@echo ""
	@echo "🚀 Service Management:"
	@echo "  make up            - Build and start all services (observability off)"
	@echo "  make up-observability - Start all services + Prometheus/Loki/Grafana stack"
	@echo "  make down          - Stop all services"
	@echo "  make restart       - Restart all services"
	@echo "  make clean         - Stop services, remove volumes, clean artifacts"
	@echo "  make logs          - Tail logs from all services"
	@echo ""
	@echo "🏗️  Build Modes:"
	@echo "  make build-player      - Build player images (comments stripped)"
	@echo "  make build-instructor  - Build instructor images (comments retained)"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  make test          - Everything that needs no running platform (what CI gates on)"
	@echo "  make test-lint     - Lint, format and type check both services"
	@echo "  make test-unit     - Service unit tests (gatekeeper + flag-oracle)"
	@echo "  make test-realms   - All realm test suites"
	@echo "  make test-manifests   - Manifest validation + invariant tests"
	@echo "  make test-attack-traces - Validate attack trace format (non-blocking)"
	@echo "  make test-e2e-collect - Guard: Playwright must collect the full suite"
	@echo "  make test-integration - Integration scripts (needs 'make up')"
	@echo "  make test-e2e      - Full Playwright suite (needs 'make up')"
	@echo "  make test-security - Security validation (secrets, CI config)"
	@echo "  make test-all      - Complete suite (needs 'make up')"
	@echo ""
	@echo "🔧 Development:"
	@echo "  make dev-gatekeeper    - Run gatekeeper in dev mode"
	@echo "  make dev-flag-oracle   - Run flag-oracle in dev mode"
	@echo ""
	@echo "ℹ️  Information:"
	@echo "  make info          - Show service status and configuration"
	@echo "  make urls          - Show all accessible URLs"
	@echo "  make help          - Show this help message"
	@echo ""

setup: validate-env
	@echo "🎯 Setting up Project Yggdrasil for first-time use..."
	@echo ""
	@echo "📝 Step 1: Creating .env file..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "   ✅ Created .env from .env.example"; \
	else \
		echo "   ℹ️  .env already exists, keeping it"; \
	fi
	@echo ""
	@echo "🔑 Step 2: Filling in unset secrets..."
	@# Idempotent by construction: each sed only matches the .env.example
	@# placeholder, so an already-generated secret is left untouched. Run
	@# unconditionally so a hand-written or upgraded .env cannot keep a
	@# placeholder value forever.
	@SESSION_SECRET=$$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64); \
		JOTUNHEIM_SECRET=$$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64); \
		NIDAVELLIR_PASS=$$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | base64); \
		ASGARD_PASS=$$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | base64); \
		GRAFANA_PASS=$$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | base64); \
		sed -i.bak "s|SESSION_SECRET=<generate-strong-secret-for-production>|SESSION_SECRET=$$SESSION_SECRET|g" .env; \
		sed -i.bak "s|JOTUNHEIM_SESSION_SECRET=<generate-strong-secret-for-production>|JOTUNHEIM_SESSION_SECRET=$$JOTUNHEIM_SECRET|g" .env; \
		sed -i.bak "s|NIDAVELLIR_DB_PASSWORD=<generate-strong-password-for-production>|NIDAVELLIR_DB_PASSWORD=$$NIDAVELLIR_PASS|g" .env; \
		sed -i.bak "s|ASGARD_DB_PASSWORD=<generate-strong-password-for-production>|ASGARD_DB_PASSWORD=$$ASGARD_PASS|g" .env; \
		sed -i.bak "s|GRAFANA_ADMIN_PASSWORD=<generate-strong-password-for-production>|GRAFANA_ADMIN_PASSWORD=$$GRAFANA_PASS|g" .env; \
		rm -f .env.bak
	@echo "   ✅ Secrets present"
	@echo ""
	@echo "🔐 Step 3: Generating deployment flags..."
	@bash scripts/generate-flags.sh
	@echo ""
	@echo "📦 Step 4: Installing dependencies..."
	@$(MAKE) install
	@echo ""
	@echo "✅ Setup complete! You can now run 'make up' to start the platform."
	@echo ""

rotate-flags:
	@echo "🔄 Rotating every realm flag and the master secret..."
	@echo ""
	@echo "   ⚠️  This invalidates every captured flag and all stored progression."
	@printf "   Continue? [y/N] " && read ans && [ "$$ans" = "y" ] || (echo "   Aborted."; exit 1)
	@bash scripts/generate-flags.sh --force
	@echo ""
	@echo "♻️  Recreating services so they pick up the new values..."
	@# The realm databases are unpersisted, so recreating the containers is all
	@# it takes for their seeds to re-run against the new flags. Nothing to
	@# delete by hand, and no volume names to get wrong.
	docker compose up -d --force-recreate
	@echo ""
	@echo "✅ Flags rotated. Players must re-capture every realm."
	@echo ""

validate-env:
	@echo "🔍 Validating environment..."
	@command -v docker >/dev/null 2>&1 || (echo "❌ Error: Docker not installed. Please install Docker first." && exit 1)
	@command -v docker compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || (echo "❌ Error: docker compose not installed" && exit 1)
	@echo "   ✅ Docker installed"
	@# Fail closed rather than copying .env.example: that file ships with empty
	@# flags, and realms now refuse to start without one. A confusing crash loop
	@# is a worse outcome than a clear instruction here.
	@if [ ! -f .env ]; then \
		echo "   ❌ .env not found. Run 'make setup' to create it and generate flags."; \
		exit 1; \
	fi
	@bash scripts/verify-env.sh
	@echo ""

up: validate-env
	@echo "🚀 Building and starting all services..."
	@echo ""
	docker compose up --build -d
	@echo ""
	@echo "⏳ Waiting for services to become healthy..."
	@sleep 15
	@echo ""
	@docker compose ps
	@echo ""
	@echo "════════════════════════════════════════════════════════════════"
	@echo "✅ Project Yggdrasil is running!"
	@echo "════════════════════════════════════════════════════════════════"
	@echo ""
	@echo "🌐 Landing Page:  http://localhost:8080/"
	@echo "🏥 Health Check:  http://localhost:8080/health"
	@echo ""
	@echo "💡 Quick Start:"
	@echo "   1. Visit http://localhost:8080/ to see the landing page"
	@echo "   2. Click 'INITIATE ASCENSION' to begin"
	@echo ""
	@echo "📖 Run 'make urls' to see all available endpoints"
	@echo "════════════════════════════════════════════════════════════════"
	@echo ""

up-observability: validate-env
	@echo "🚀 Starting all services WITH the observability stack..."
	@echo "   (Prometheus, Loki, Promtail, Grafana — slower startup)"
	@echo ""
	@echo "   Step 1: core services (creates yggdrasil_main network)..."
	OBSERVABILITY_ENABLED=true docker compose up --build -d
	@echo "   Step 2: observability stack (attaches to yggdrasil_main)..."
	docker compose -f docker-compose.observability.yml up -d
	@echo ""
	@echo "✅ Yggdrasil + observability running. Grafana: http://localhost:3200"

restart:
	@echo "🔄 Restarting all services..."
	docker compose restart
	@echo "✅ Services restarted"

# Build modes for comment stripping
copy-stripper:
	@echo "📋 Copying comment stripper to all realms..."
	@for realm in realms/*/; do \
		if [ -f "$$realm/Dockerfile" ]; then \
			cp scripts/strip-comments.js "$$realm/strip-comments.js"; \
			echo "   ✅ Copied to $$realm"; \
		fi; \
	done

build-player: copy-stripper
	@echo "🎮 Building PLAYER images (comments stripped)..."
	@BUILD_MODE=player docker compose build
	@echo ""
	@echo "✅ Player build complete!"
	@echo "   All instructor comments have been stripped from realm images"
	@echo "   Run 'make up' to start with player images"

build-instructor:
	@echo "👨‍🏫 Building INSTRUCTOR images (comments retained)..."
	@BUILD_MODE=instructor docker compose build
	@echo ""
	@echo "✅ Instructor build complete!"
	@echo "   All instructor comments and hints have been retained"
	@echo "   Run 'make up' to start with instructor images"

down:
	@echo "🛑 Stopping all services..."
	docker compose down
	@echo "✅ Services stopped"

clean:
	@echo "🧹 Cleaning up..."
	docker compose down -v
	@echo "📦 Removing build artifacts..."
	@find . -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -name "dist" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@echo "✅ Cleanup complete"

logs:
	docker compose logs -f

install:
	@echo "📦 Installing dependencies..."
	@echo "   Installing gatekeeper dependencies..."
	@cd gatekeeper && npm install --silent
	@echo "   Installing flag-oracle dependencies..."
	@cd flag-oracle && npm install --silent
	@echo "   Installing sample-realm dependencies..."
	@cd realms/sample-realm && npm install --silent
	@echo "✅ Dependencies installed for all services"

info:
	@echo "╔════════════════════════════════════════════════════════════════╗"
	@echo "║              Project Yggdrasil - System Info                  ║"
	@echo "╚════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📊 Service Status:"
	@docker compose ps
	@echo ""
	@echo "💾 Docker Resources:"
	@echo "Volumes:"
	@docker volume ls | grep yggdrasil || echo "No volumes found"
	@echo ""
	@echo "🌐 Networks:"
	@docker network ls | grep yggdrasil || echo "No networks found"
	@echo ""

urls:
	@echo "╔════════════════════════════════════════════════════════════════╗"
	@echo "║           Project Yggdrasil - Available URLs                  ║"
	@echo "╚════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "🌟 Main Application:"
	@echo "   Landing Page:      http://localhost:8080/"
	@echo "   Login:             http://localhost:8080/login"
	@echo "   Logout:            http://localhost:8080/logout"
	@echo "   Health Check:      http://localhost:8080/health"
	@echo "   Realms List:       http://localhost:8080/realms"
	@echo ""
	@echo "🎯 Realm Access (requires authentication):"
	@echo "   Sample Realm:      http://localhost:8080/realms/sample/"
	@echo "   Niflheim (R10):    http://localhost:8080/realms/niflheim/"
	@echo "   Helheim (R9):      http://localhost:8080/realms/helheim/"
	@echo "   Svartalfheim (R8): http://localhost:8080/realms/svartalfheim/"
	@echo "   Jotunheim (R7):    http://localhost:8080/realms/jotunheim/"
	@echo "   Muspelheim (R6):   http://localhost:8080/realms/muspelheim/"
	@echo "   Nidavellir (R5):   http://localhost:8080/realms/nidavellir/"
	@echo "   Vanaheim (R4):     http://localhost:8080/realms/vanaheim/"
	@echo "   Midgard (R3):      http://localhost:8080/realms/midgard/"
	@echo "   Alfheim (R2):      http://localhost:8080/realms/alfheim/"
	@echo "   Asgard (R1):       http://localhost:8080/realms/asgard/"
	@echo ""
	@echo "📊 Observability Stack:"
	@echo "   Grafana:           http://localhost:3200"
	@echo "                      (username: admin, password: check .env)"
	@echo "   Prometheus:        http://localhost:9090"
	@echo "   Loki:              http://localhost:3100"
	@echo "   Gatekeeper Metrics: http://localhost:8080/metrics"
	@echo "   Flag Oracle Metrics: http://localhost:3001/metrics"
	@echo ""
	@echo "🔧 Internal APIs (Docker network only):"
	@echo "   Flag Oracle:       http://flag-oracle:3001"
	@echo "   Redis:             redis://redis:6379"
	@echo ""
	@echo "💡 Tip: Use 'curl http://localhost:8080/health' to check if services are ready"
	@echo ""

# ======================================================================
# TEST SUITES — single source of truth
#
# .circleci/config.yml invokes these targets directly and defines no test
# commands of its own. Anything added here runs in CI; anything CI needs
# must live here. Never duplicate a test command in the CI config — that
# is how the two drifted apart before (realm suites ran in neither, and
# Playwright collected zero tests for months without CI noticing).
# ======================================================================

# Extra flags passed through to jest, e.g. `make test-unit JEST_FLAGS=--coverage`.
JEST_FLAGS ?=

# Realm packages with jest suites.
#   svartalfheim - Java/maven, no jest
#   sample-realm - no test script
#   _shared      - not a package
TESTED_REALMS := _template alfheim asgard helheim jotunheim midgard \
                 muspelheim nidavellir niflheim vanaheim

# Asgard's recon and full-chain suites read realms/asgard/public/.git/*, a
# fixture that CANNOT be committed — git refuses to index any path containing a
# `.git` component — and that nothing generates at build or run time. Asgard's
# other 122 tests gate normally. Remove this skip once the fixture is generated.
ASGARD_SKIP := --testPathIgnorePatterns tests/integration/recon.test.ts tests/e2e/complete-exploit-chain.test.ts

# Playwright specs that may legitimately fail without a fully seeded platform.
# Non-blocking in CI *and* locally — one list, one policy, declared once here
# rather than as scattered `|| echo` in the CI config.
E2E_SOFT_SPECS := tests/integration/attack-trace-generation.spec.ts \
                  tests/e2e/journey/full-journey.spec.ts

test-lint:
	@echo "🔍 Linting, formatting and type checking..."
	@cd gatekeeper && npm run lint
	@cd flag-oracle && npm run lint
	@cd gatekeeper && npx prettier --check "src/**/*.ts"
	@cd flag-oracle && npx prettier --check "src/**/*.ts"
	@cd gatekeeper && npx tsc --noEmit
	@cd flag-oracle && npx tsc --noEmit
	@echo "✅ Lint, format and types clean!"

test-unit:
	@echo "🧪 Running service unit tests..."
	@echo "Testing flag-oracle..."
	@cd flag-oracle && npm test -- $(JEST_FLAGS)
	@echo ""
	@echo "Testing gatekeeper..."
	@cd gatekeeper && npm test -- $(JEST_FLAGS)
	@echo "✅ Service unit tests passed!"

test-realms:
	@echo "🌍 Running realm test suites..."
	@set -e; for realm in $(TESTED_REALMS); do \
		echo ""; echo "── $$realm ──"; \
		if [ "$$realm" = "asgard" ]; then \
			( cd realms/$$realm && npm test -- $(ASGARD_SKIP) ); \
		else \
			( cd realms/$$realm && npm test ); \
		fi; \
	done
	@echo ""
	@echo "✅ Realm test suites passed!"

test-manifests:
	@echo "📋 Validating realm manifests..."
	@bash ./scripts/create-all-manifests.sh
	@cd flag-oracle && node_modules/.bin/ts-node --compiler-options '{"module":"node16","moduleResolution":"node16","esModuleInterop":true,"types":["node"]}' ../scripts/validate-manifests.ts
	@npx playwright test tests/manifests/ --reporter=list
	@echo "✅ Manifests valid!"

# Attack-trace format check. Non-blocking when no traces exist yet, which is the
# normal state on a fresh checkout.
test-attack-traces:
	@echo "🧾 Validating attack trace format..."
	@bash ./scripts/validate-attack-traces.sh \
		|| echo "⚠️  No attack traces found (expected on a fresh build)"

# Guards against a collection break hiding an entire suite. Needs no platform.
test-e2e-collect:
	@./scripts/check-e2e-collection.sh 100 6

test-integration:
	@echo "🔗 Running integration tests..."
	@bash ./scripts/smoke-test.sh
	@bash ./scripts/test-m3-all.sh
	@bash ./scripts/test-m4-all.sh
	@bash ./scripts/test-m5-all.sh
	@bash ./scripts/test-e2e-journey.sh
	@echo "-- realm vulnerability regression checks (non-blocking) --"
	@if [ -f ./scripts/verify-realms.sh ]; then \
		bash ./scripts/verify-realms.sh \
			|| echo "⚠️  Realm regression checks failed (non-blocking)"; \
	else \
		echo "   scripts/verify-realms.sh not present — skipping"; \
	fi
	@echo "✅ Integration tests passed!"

# Runs the WHOLE Playwright suite rather than a hand-maintained file list, so
# a new spec is picked up automatically instead of silently never running.
# Requires the platform to be up (`make up`).
test-e2e: test-e2e-collect
	@echo "🎭 Running E2E suite (blocking)..."
	@PW_SKIP="$$(echo $(E2E_SOFT_SPECS) | tr ' ' ',')" npx playwright test --reporter=list
	@echo ""
	@echo "🎭 Running E2E suite (non-blocking)..."
	@npx playwright test $(E2E_SOFT_SPECS) --reporter=list \
		|| echo "⚠️  Non-blocking E2E suites reported failures (see above)"
	@echo "✅ E2E suite complete!"

test-security:
	@echo "🔒 Running security validation..."
	@./scripts/validate-circleci.sh
	@./scripts/scan-secrets-enhanced.sh
	@echo "✅ Security validation passed!"

# Everything that needs no running platform. This is what CI gates on.
test: test-lint test-unit test-realms test-manifests test-attack-traces test-e2e-collect
	@echo "🎉 All platform-independent tests passed!"

# Everything, including suites that need `make up` first.
test-all: test test-integration test-e2e test-security
	@echo "🎉 All tests passed!"

dev-gatekeeper:
	cd gatekeeper && npm run dev

dev-flag-oracle:
	cd flag-oracle && npm run dev

dev-sample-realm:
	cd realms/sample-realm && npm run dev

# Quick test commands for manual testing
test-landing:
	@echo "🧪 Testing landing page..."
	@curl -s http://localhost:8080/ | grep -q "Bifröst" && echo "✅ Landing page is accessible" || echo "❌ Landing page failed"

test-health:
	@echo "🧪 Testing health endpoints..."
	@curl -s http://localhost:8080/health | grep -q "ok" && echo "✅ Gatekeeper health check passed" || echo "❌ Gatekeeper health check failed"
	@curl -s http://localhost:3001/health | grep -q "ok" && echo "✅ Flag Oracle health check passed" || echo "❌ Flag Oracle health check failed"

test-realms-api:
	@echo "🧪 Testing realms API..."
	@curl -s http://localhost:8080/realms | grep -q "realms" && echo "✅ Realms API is accessible" || echo "❌ Realms API failed"

quick-test: test-health test-landing test-realms-api
	@echo ""
	@echo "✅ Quick tests completed!"

yggdrasil: setup up
	@echo ""
	@echo "🌳 Yggdrasil is ready!"
