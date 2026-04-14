.PHONY: help setup up down restart clean logs test validate-env install dev-gatekeeper dev-flag-oracle info urls build-player build-instructor copy-stripper yggdrasil

help:
	@echo "╔════════════════════════════════════════════════════════════════╗"
	@echo "║          Project Yggdrasil - Development Commands             ║"
	@echo "╚════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📦 Setup & Installation:"
	@echo "  make yggdrasil     - One command to setup and start everything"
	@echo "  make setup         - First-time setup (create .env, install deps)"
	@echo "  make install       - Install dependencies for all services"
	@echo ""
	@echo "🚀 Service Management:"
	@echo "  make up            - Build and start all services"
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
	@echo "  make test          - Run all core tests (unit + integration)"
	@echo "  make test-unit     - Run unit tests only"
	@echo "  make test-integration - Run integration tests"
	@echo "  make test-e2e      - Run E2E journey tests"
	@echo "  make test-security - Run security validation tests"
	@echo "  make test-all      - Run complete test suite"
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
		echo "   📝 Generating secrets..."; \
		SESSION_SECRET=$$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64); \
		JOTUNHEIM_SECRET=$$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64); \
		NIDAVELLIR_PASS=$$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | base64); \
		ASGARD_PASS=$$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | base64); \
		GRAFANA_PASS=$$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | base64); \
		sed -i.bak "s|SESSION_SECRET=<generate-strong-secret-for-production>|SESSION_SECRET=$$SESSION_SECRET|g" .env; \
		sed -i.bak "s|JOTUNHEIM_SESSION_SECRET=<generate-strong-secret-for-production>|JOTUNHEIM_SESSION_SECRET=$$JOTUNHEIM_SECRET|g" .env; \
		sed -i.bak "s|NIDAVELLIR_DB_PASSWORD=<generate-strong-password-for-production>|NIDAVELLIR_DB_PASSWORD=$$NIDAVELLIR_PASS|g" .env; \
		sed -i.bak "s|ASGARD_DB_PASSWORD=<generate-strong-password-for-production>|ASGARD_DB_PASSWORD=$$ASGARD_PASS|g" .env; \
		sed -i.bak "s|GRAFANA_ADMIN_PASSWORD=<generate-strong-password-for-production>|GRAFANA_ADMIN_PASSWORD=$$GRAFANA_PASS|g" .env; \
		rm -f .env.bak; \
		echo "   ✅ Generated secure secrets"; \
	else \
		echo "   ℹ️  .env already exists, skipping creation"; \
	fi
	@echo ""
	@echo "📦 Step 2: Installing dependencies..."
	@$(MAKE) install
	@echo ""
	@echo "✅ Setup complete! You can now run 'make up' to start the platform."
	@echo ""

validate-env:
	@echo "🔍 Validating environment..."
	@command -v docker >/dev/null 2>&1 || (echo "❌ Error: Docker not installed. Please install Docker first." && exit 1)
	@command -v docker compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || (echo "❌ Error: docker compose not installed" && exit 1)
	@echo "   ✅ Docker installed"
	@if [ ! -f .env ]; then \
		echo "   ⚠️  .env not found. Run 'make setup' to create it."; \
		echo "   ℹ️  Copying from .env.example for now..."; \
		cp .env.example .env; \
	fi
	@echo "   ✅ Environment file ready"
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

test-unit:
	@echo "🧪 Running unit tests..."
	@echo "Testing flag-oracle..."
	@cd flag-oracle && npm test
	@echo ""
	@echo "Testing gatekeeper..."
	@cd gatekeeper && npm test
	@echo "✅ Unit tests passed!"

test-integration:
	@echo "🔗 Running integration tests..."
	@./scripts/smoke-test.sh
	@./scripts/test-m3-all.sh
	@./scripts/test-m4-all.sh
	@./scripts/test-m5-all.sh
	@echo "✅ Integration tests passed!"

test-e2e:
	@echo "🎭 Running E2E tests..."
	@./scripts/test-e2e-journey.sh
	@echo "✅ E2E tests passed!"

test-security:
	@echo "🔒 Running security tests..."
	@npx playwright test tests/security/
	@./scripts/scan-secrets.sh
	@echo "✅ Security tests passed!"

test: test-unit test-integration
	@echo "✅ All core tests passed!"

test-all: test-unit test-integration test-e2e test-security
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
