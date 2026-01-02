# M8 Operator Runbook

**Version:** 1.0.0  
**Last Updated:** 2025-12-13  
**For:** Project Yggdrasil Operators & DevOps

---

## Purpose

This runbook provides step-by-step operational procedures for using Milestone 8 (M8) tools in day-to-day development and deployment of Project Yggdrasil. It covers common tasks, troubleshooting, and best practices.

**Target Audience:**
- DevOps engineers deploying Yggdrasil
- Platform operators managing the environment
- Developers contributing to the codebase
- Security team members auditing the platform

---

## Table of Contents

1. [Pre-Flight Checks](#pre-flight-checks)
2. [Daily Development Workflow](#daily-development-workflow)
3. [Building & Deploying](#building--deploying)
4. [Security Operations](#security-operations)
5. [CI/CD Operations](#cicd-operations)
6. [Troubleshooting](#troubleshooting)
7. [Emergency Procedures](#emergency-procedures)
8. [Reference](#reference)

---

## Pre-Flight Checks

### Before Starting Work

Run these checks to ensure your environment is M8-compliant:

```bash
# 1. Verify all core services have zero lint errors
cd /path/to/project_yggdrasil
cd gatekeeper && npm run lint
cd ../flag-oracle && npm run lint

# Expected: 0 errors (warnings acceptable)
# If errors found: Fix before proceeding

# 2. Verify all tests pass
cd gatekeeper && npm test
cd ../flag-oracle && npm test

# Expected: 76/76 gatekeeper, 88/88 flag-oracle
# If failures: Investigate before making changes

# 3. Scan for secrets
cd /path/to/project_yggdrasil
./scripts/scan-secrets-enhanced.sh

# Expected: Only documented false positives
# If new CRITICAL/HIGH: Do not proceed, investigate

# 4. Validate CI configuration
./scripts/validate-circleci.sh

# Expected: 0 violations (warnings acceptable)
# If violations: Fix .circleci/config.yml

# 5. Check Docker environment
docker --version
docker-compose --version
make --version

# Minimum: Docker 20.10+, Compose 2.0+, Make 4.0+
```

**Green Light Criteria:**
- ✅ Zero lint errors
- ✅ All tests passing
- ✅ No new secrets detected
- ✅ CI policy compliant
- ✅ Docker environment ready

---

## Daily Development Workflow

### Standard Development Cycle

**1. Start New Feature/Fix**
```bash
# Create feature branch
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Verify clean starting state
npm test  # In both gatekeeper and flag-oracle
```

**2. Make Changes**
```bash
# Edit files as needed
# ... your development work ...

# Check lint frequently
cd gatekeeper && npm run lint
cd flag-oracle && npm run lint

# Run tests frequently
npm test
```

**3. Pre-Commit Validation**
```bash
# Run full validation suite
cd /path/to/project_yggdrasil

# Lint check
cd gatekeeper && npm run lint && cd ..
cd flag-oracle && npm run lint && cd ..

# Test check
cd gatekeeper && npm test && cd ..
cd flag-oracle && npm test && cd ..

# Secrets scan
./scripts/scan-secrets-enhanced.sh

# CI policy check (if you modified .circleci/config.yml)
./scripts/validate-circleci.sh

# All checks must pass before committing
```

**4. Commit**
```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: your feature description"

# If commit fails pre-commit hooks, fix and retry
```

**5. Push & Create PR**
```bash
# Push to remote
git push origin feature/your-feature-name

# Create PR on GitHub
# CI will automatically run:
# - Lint (must pass)
# - Tests (must pass)
# - Security scan (must pass)
# - CI policy validation (must pass)
```

**6. After PR Approval**
```bash
# Merge via GitHub UI (squash & merge recommended)

# Update local main
git checkout main
git pull origin main

# Delete feature branch
git branch -d feature/your-feature-name
```

---

## Building & Deploying

### Building Player vs Instructor Images

**Player Build (Comments Stripped)**

For production deployment or player-facing environments:

```bash
# Step 1: Copy comment stripper to all realms
make copy-stripper

# Step 2: Build player images
make build-player

# Step 3: Verify images built
docker images | grep yggdrasil

# Step 4: Start platform
docker-compose up -d

# Step 5: Verify health
curl http://localhost:8080/health
curl http://localhost:3001/health  # Won't work (internal), use gatekeeper

# Step 6: Verify comments stripped (optional)
docker exec niflheim cat /app/dist/index.js | grep -i "VULNERABLE"
# Expected: No matches
```

**Instructor Build (Comments Retained)**

For development or instructor-facing environments:

```bash
# Build instructor images
make build-instructor

# Start platform
docker-compose up -d

# Verify comments retained (optional)
docker exec niflheim cat /app/src/index.ts | grep -i "VULNERABLE"
# Expected: Comments present
```

### Building Specific Realm

```bash
# Navigate to realm
cd realms/niflheim

# Copy stripper if not present
cp ../../scripts/strip-comments.js .

# Build player mode
docker build --build-arg BUILD_MODE=player -t niflheim:player .

# Build instructor mode
docker build --build-arg BUILD_MODE=instructor -t niflheim:instructor .

# Verify
docker images | grep niflheim
```

### Full Platform Deployment

```bash
# 1. Ensure .env is configured
cp .env.example .env
# Edit .env with production values

# 2. Generate secrets
openssl rand -hex 32  # For FLAG_MASTER_SECRET
openssl rand -hex 32  # For SESSION_SECRET
# Add to .env

# 3. Build player images
make copy-stripper
make build-player

# 4. Start all services
docker-compose up -d

# 5. Wait for healthy status
sleep 30
docker-compose ps

# 6. Verify core services
curl http://localhost:8080/health  # Gatekeeper
# Expected: {"status":"ok","service":"gatekeeper"}

# 7. Verify progression system
# Test flag submission through gatekeeper

# 8. Check logs
docker-compose logs -f gatekeeper
docker-compose logs -f flag-oracle
```

---

## Security Operations

### Running Security Scans

**Enhanced Secrets Scanner**

```bash
# Standard scan (exits 1 on CRITICAL/HIGH)
./scripts/scan-secrets-enhanced.sh

# Strict mode (also exits on MEDIUM)
EXIT_ON_MEDIUM=true ./scripts/scan-secrets-enhanced.sh

# Hide context lines (faster)
SHOW_CONTEXT=false ./scripts/scan-secrets-enhanced.sh

# CI mode (no colors)
CI=true ./scripts/scan-secrets-enhanced.sh
```

**Interpreting Results:**
```
🔴 CRITICAL findings: Block build, investigate immediately
🟠 HIGH findings: Block build, review required
🟡 MEDIUM findings: Warning only (unless EXIT_ON_MEDIUM=true)

Expected false positives:
- AWS Access Key AKIAIOSFODNN7EXAMPLE (Alfheim)
- Weak passwords in Jotunheim (challenge)
- Flags in .env (configuration)
```

**Gitleaks Scan**

```bash
# Install Gitleaks (if not already)
brew install gitleaks  # macOS
# OR
curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.18.1/gitleaks_8.18.1_linux_x64.tar.gz | tar -xz

# Scan repository
gitleaks detect --config .gitleaks.toml --verbose

# Scan uncommitted changes
gitleaks protect --config .gitleaks.toml --staged

# Scan specific commit range
gitleaks detect --config .gitleaks.toml --log-opts="main..feature-branch"

# Generate report
gitleaks detect --config .gitleaks.toml --report-path gitleaks-report.json
```

### Handling Secret Detection

**If Scanner Finds Real Secret:**

1. **DO NOT COMMIT** - Stop immediately

2. **Verify it's a real secret** (not false positive)
   ```bash
   # Check documented false positives
   grep -A 5 "Known False Positives" .docs/SECRETS-MANAGEMENT.md
   ```

3. **If real secret:**
   - Remove from code immediately
   - Use environment variable instead
   - Document why it was there (if accident)

4. **If already committed:**
   - See [Emergency Procedures](#emergency-procedures) below

### Regular Security Audits

**Weekly:**
```bash
# Full secrets scan
./scripts/scan-secrets-enhanced.sh > weekly-scan-$(date +%Y%m%d).log

# Gitleaks scan
gitleaks detect --config .gitleaks.toml --report-path weekly-gitleaks-$(date +%Y%m%d).json

# Review findings
cat weekly-scan-$(date +%Y%m%d).log
cat weekly-gitleaks-$(date +%Y%m%d).json
```

**Monthly:**
```bash
# Check for updates to patterns
# Review .docs/SECRETS-MANAGEMENT.md
# Update scanner if new pattern types discovered
```

**Quarterly:**
```bash
# Full security audit
# Review all documented false positives
# Update .gitleaks.toml allowlists
# Test incident response procedures
```

---

## CI/CD Operations

### Validating CI Configuration

**Before Modifying .circleci/config.yml:**

```bash
# Run validator
./scripts/validate-circleci.sh

# Expected output:
# Policies Checked: 10
# Violations:       0
# Warnings:         2 (acceptable)

# If violations found, fix before committing
```

**After Modifying:**

```bash
# Validate again
./scripts/validate-circleci.sh

# Check YAML syntax (if yq installed)
yq eval '.' .circleci/config.yml > /dev/null

# OR use CircleCI CLI
circleci config validate
```

**The 10 Policies:**
1. ✅ No third-party orbs (security)
2. ✅ Required jobs (lint, test)
3. ✅ Lint covers core services
4. ✅ Tests actually run
5. ✅ Security scanning present
6. ⚠️ Branch restrictions (recommended)
7. ✅ Job dependencies configured
8. ✅ CircleCI images (cimg/*)
9. ℹ️ YAML syntax valid
10. ✅ Fail-fast enabled

### CI Pipeline Monitoring

**Check Pipeline Status:**
```bash
# Via CircleCI CLI (if installed)
circleci follow

# Via GitHub (if using GitHub Actions)
gh run list

# Via web UI
# Go to CircleCI dashboard or GitHub Actions tab
```

**Investigating CI Failures:**

**Lint Failure:**
```bash
# Reproduce locally
cd gatekeeper && npm run lint
cd flag-oracle && npm run lint

# Fix errors, commit, push
```

**Test Failure:**
```bash
# Reproduce locally
cd gatekeeper && npm test
cd flag-oracle && npm test

# Debug specific test
npm test -- --testNamePattern="test name"

# Fix, commit, push
```

**Security Scan Failure:**
```bash
# Reproduce locally
./scripts/scan-secrets-enhanced.sh

# If new CRITICAL/HIGH finding:
# - Review finding
# - If false positive: Add to .gitleaks.toml allowlist
# - If real secret: Remove, use environment variable
# - Document in .docs/SECRETS-MANAGEMENT.md
```

**CI Policy Failure:**
```bash
# Reproduce locally
./scripts/validate-circleci.sh

# Fix violations in .circleci/config.yml
# - Remove orbs if present
# - Add missing jobs
# - Fix job dependencies
# - Update docker images to cimg/*
```

---

## Troubleshooting

### Common Issues

**Issue 1: Lint Errors After Pull**

```bash
# Symptom: npm run lint fails after git pull

# Diagnosis:
cd gatekeeper && npm run lint
# Read error messages

# Solution:
# 1. Check if it's a known issue
git log --oneline -10

# 2. If you introduced error:
# Fix the code

# 3. If error from main branch:
# Report to team, should not happen (M8 prevents this)
```

**Issue 2: Tests Failing Locally But Passing in CI**

```bash
# Symptom: CI green, local tests fail

# Diagnosis:
# 1. Check Node.js version
node --version
# Expected: 20.x

# 2. Check dependencies
npm ci  # Fresh install

# 3. Clear caches
rm -rf node_modules
npm cache clean --force
npm ci

# 4. Re-run tests
npm test
```

**Issue 3: Secrets Scanner False Positive**

```bash
# Symptom: Scanner reports false positive

# Diagnosis:
./scripts/scan-secrets-enhanced.sh
# Review finding

# Solution:
# 1. Verify it's truly false positive
# 2. Add to documented false positives
# Edit .docs/SECRETS-MANAGEMENT.md

# 3. Add to Gitleaks allowlist
# Edit .gitleaks.toml:
[[rules.allowlist]]
description = "Your justification"
regexes = ['''pattern-to-allow''']
paths = ['''path/to/file''']

# 4. Test
gitleaks detect --config .gitleaks.toml --verbose
```

**Issue 4: Comment Stripper Not Working**

```bash
# Symptom: Comments still in player build

# Diagnosis:
# 1. Check if stripper deployed
ls -la realms/*/strip-comments.js

# 2. Check if BUILD_MODE set
docker inspect yggdrasil-niflheim | grep BUILD_MODE

# Solution:
# 1. Deploy stripper
make copy-stripper

# 2. Rebuild with correct mode
make build-player

# 3. Verify
docker exec niflheim ls -la /app/strip-comments.js
```

**Issue 5: CI Policy Validator Warnings**

```bash
# Symptom: Validator shows warnings

# Diagnosis:
./scripts/validate-circleci.sh
# Read warning messages

# Common warnings:
# - "No npm test command" (false positive, tests run with --coverage)
# - "No branch filters" (partially addressed)

# Solution:
# Warnings don't fail build, but can be addressed:

# For npm test warning:
# Update validator regex (low priority)

# For branch filter warning:
# Add more granular filters to .circleci/config.yml
```

### Performance Issues

**Build Too Slow:**

```bash
# Diagnosis:
time docker-compose build

# Solutions:
# 1. Use layer caching
docker-compose build --no-cache  # Rebuild fresh

# 2. Check network
docker system df  # Check disk usage
docker system prune  # Clean up

# 3. Optimize Dockerfiles
# Use multi-stage builds
# Copy only necessary files
```

**Tests Taking Too Long:**

```bash
# Diagnosis:
time npm test

# Solutions:
# 1. Run specific test suite
npm test -- --testPathPattern="flag-service"

# 2. Parallel execution (already enabled in Jest)

# 3. Skip slow tests in dev
npm test -- --testPathIgnorePatterns="e2e"
```

---

## Emergency Procedures

### Real Secret Committed to Repository

**IMMEDIATE ACTIONS:**

**Step 1: Rotate the secret (Priority 1)**
```bash
# AWS Keys:
# Go to AWS IAM Console → Delete compromised key → Generate new key

# GitHub Tokens:
# Go to Settings → Developer settings → Revoke token

# NPM Tokens:
# Go to npmjs.com → Access Tokens → Revoke

# Database Passwords:
# Update in database, restart services

# Document what was rotated and when
```

**Step 2: Remove from Git history (Priority 2)**
```bash
# Using git-filter-repo (recommended)
pip install git-filter-repo

# Remove specific file from history
git filter-repo --path path/to/secret.yml --invert-paths

# OR remove specific pattern from all files
git filter-repo --replace-text <(echo "SECRET_VALUE==>REDACTED")

# ALTERNATIVE: Using BFG Repo-Cleaner
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
java -jar bfg-1.14.0.jar --delete-files secret.yml
java -jar bfg-1.14.0.jar --replace-text replacements.txt

# Finalize
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

**Step 3: Force push (Coordinate with team)**
```bash
# WARNING: This rewrites history for everyone

# Notify team first
# Then force push:
git push origin --force --all
git push origin --force --tags

# Team members must re-clone or:
git fetch origin
git reset --hard origin/main
```

**Step 4: Document incident**
```bash
# Create incident report
cat > .docs/security-incidents/$(date +%Y%m%d)-secret-leak.md << 'EOF'
# Security Incident Report

**Date:** $(date)
**Type:** Secret Leak
**Severity:** HIGH/CRITICAL

## What Happened
[Description]

## Secret Exposed
[Type of secret, never include actual value]

## Actions Taken
1. Rotated secret at [time]
2. Removed from Git history
3. Force pushed to remote
4. Notified team

## Root Cause
[Why it happened]

## Prevention
[What we're doing to prevent this]
EOF
```

**Step 5: Update scanner patterns**
```bash
# Add pattern to prevent recurrence
# Edit scripts/scan-secrets-enhanced.sh or .gitleaks.toml

# Test new pattern
./scripts/scan-secrets-enhanced.sh
gitleaks detect --config .gitleaks.toml
```

### CI Pipeline Broken

**Step 1: Assess impact**
```bash
# Check what's broken
# Look at CI logs

# Is it blocking all PRs? (CRITICAL)
# OR just one branch? (HIGH)
```

**Step 2: Quick fix or revert**
```bash
# If recent change broke it:
git revert <commit-hash>
git push origin main

# If quick fix available:
# Make fix, test locally, push directly to main (emergency only)
```

**Step 3: Notify team**
```bash
# Post in team channel:
# "CI broken on main, investigating"
# "Reverted commit X, CI should recover in 5 min"
# "Fixed, all clear"
```

### Platform Down in Production

**Step 1: Check service health**
```bash
docker-compose ps
docker-compose logs --tail=100

# Identify which service is down
```

**Step 2: Quick restart**
```bash
# Restart specific service
docker-compose restart gatekeeper

# OR restart all
docker-compose restart

# OR full restart
docker-compose down
docker-compose up -d
```

**Step 3: Verify recovery**
```bash
curl http://localhost:8080/health
docker-compose logs -f
```

**Step 4: Root cause analysis**
```bash
# Check logs for errors
docker-compose logs gatekeeper > gatekeeper-crash.log
grep -i "error\|exception\|fatal" gatekeeper-crash.log

# Document incident
# Post-mortem in .docs/incidents/
```

---

## Reference

### Quick Command Reference

```bash
# Linting
cd gatekeeper && npm run lint
cd flag-oracle && npm run lint

# Testing
cd gatekeeper && npm test
cd flag-oracle && npm test

# Secrets Scanning
./scripts/scan-secrets-enhanced.sh
gitleaks detect --config .gitleaks.toml

# CI Validation
./scripts/validate-circleci.sh

# Comment Stripping
make copy-stripper
make build-player
make build-instructor
node scripts/strip-comments.js src/ output/
node scripts/strip-comments.js --validate output/

# Docker Operations
docker-compose up -d
docker-compose ps
docker-compose logs -f service-name
docker-compose restart service-name
docker-compose down
docker-compose build
make build-player
make build-instructor

# Flag Generation (via API)
curl -X POST http://localhost:3001/generate \
  -H "Content-Type: application/json" \
  -d '{"userId":"user1","realmId":"NIFLHEIM"}'
```

### File Locations

```
M8 Scripts:
  scripts/strip-comments.js
  scripts/scan-secrets-enhanced.sh
  scripts/validate-circleci.sh

M8 Configuration:
  .gitleaks.toml
  .gitignore (M8 hardened)
  .circleci/config.yml (M8 enhanced)

M8 Documentation:
  .docs/milestones/M8-IMPLEMENTATION.md
  .docs/SECRETS-MANAGEMENT.md
  .docs/CI-POLICY.md
  .docs/M8-OPERATOR-RUNBOOK.md (this file)
  AGENTS.md (M8 section)

FlagService:
  flag-oracle/src/services/flag-service.ts
  flag-oracle/tests/flag-service.test.ts

Integration Tests:
  tests/integration/test-comment-stripping.sh
  tests/integration/test-flag-generation.sh
```

### Exit Codes

```
secrets scanner:
  0 = No CRITICAL/HIGH (or only MEDIUM with EXIT_ON_MEDIUM=false)
  1 = CRITICAL or HIGH detected
  2 = MEDIUM detected (only if EXIT_ON_MEDIUM=true)

CI validator:
  0 = Compliant (warnings acceptable)
  1 = Policy violations
  2 = Config file not found

comment stripper:
  0 = Success
  1 = Error (file not found, invalid input, etc.)

validation mode:
  0 = No comments found (clean)
  1 = Comments detected (violations)
```

### Contact & Support

**For M8-specific questions:**
- Check this runbook first
- Review M8-IMPLEMENTATION.md for technical details
- Review SECRETS-MANAGEMENT.md for secrets guidance
- Review CI-POLICY.md for CI questions
- Check AGENTS.md for development conventions

**For incidents:**
- Follow emergency procedures above
- Document in .docs/security-incidents/
- Notify team immediately

**For improvements:**
- Open GitHub issue
- Tag with "M8" label
- Reference this runbook

---

## Changelog

### v1.0.0 - 2025-12-13 (Initial Release)

**Added:**
- Complete M8 operational procedures
- Daily development workflow
- Build & deployment procedures
- Security operations guide
- CI/CD operations
- Troubleshooting section
- Emergency procedures
- Quick reference

---

**Document Status:** Production-ready  
**Maintained By:** Project Yggdrasil Team  
**Review Cycle:** Quarterly (or after major M8 changes)
