# CI/CD Policy (M8)

**Version:** 1.0.0  
**Last Updated:** 2025-12-13  
**Status:** Enforced

---

## Overview

Project Yggdrasil enforces strict CI/CD policies to maintain code quality, security, and stability. This document defines our CI/CD standards and enforcement mechanisms introduced in Milestone 8 (M8).

**Core Principles:**
1. **Main branch must always be green** - No broken builds on main
2. **All tests must pass** - No exceptions for test failures
3. **Security first** - Automated secret scanning and lint checks
4. **No third-party orbs** - Security policy for CircleCI
5. **Fast feedback** - CI runs complete in <10 minutes

---

## Policy Enforcement

### Automated Validation

**Tool:** `scripts/validate-circleci.sh`

**Usage:**
```bash
# Validate CircleCI configuration
./scripts/validate-circleci.sh

# In CI pipeline
- run:
    name: Validate CI configuration
    command: ./scripts/validate-circleci.sh
```

**Exit Codes:**
- `0` = Policy compliant (with or without warnings)
- `1` = Policy violations detected (build fails)
- `2` = Configuration file not found

---

## The 10 Policies

### Policy 1: No Third-Party Orbs ⚠️ CRITICAL

**Rule:** CircleCI configuration must not use third-party orbs.

**Rationale:**
- Third-party orbs introduce supply chain risk
- Orbs can access repository secrets
- Difficult to audit external code
- Version pinning doesn't guarantee immutability

**Compliant:**
```yaml
# ✅ No orbs section
version: 2.1
jobs:
  test:
    docker:
      - image: cimg/node:20.10
```

**Violation:**
```yaml
# ❌ Using third-party orb
orbs:
  slack: circleci/slack@4.1.0

jobs:
  notify:
    steps:
      - slack/notify
```

**Exceptions:** None. Use inline CircleCI commands instead.

---

### Policy 2: Required Jobs ✅ REQUIRED

**Rule:** CI pipeline must include `lint` and `test` jobs.

**Required Jobs:**
- **lint** - Run ESLint/TSLint on gatekeeper and flag-oracle
- **test** - Run unit and integration tests

**Recommended Jobs:**
- **security-scan** - Run secrets scanning and vulnerability checks
- **build** - Verify Docker images build successfully
- **e2e** - Run end-to-end journey tests (optional, can be separate workflow)

**Compliant:**
```yaml
jobs:
  lint:
    docker:
      - image: cimg/node:20.10
    steps:
      - checkout
      - run: npm ci
      - run: npm run lint

  test:
    docker:
      - image: cimg/node:20.10
    steps:
      - checkout
      - run: npm ci
      - run: npm test
```

---

### Policy 3: Lint Job Configuration ✅ REQUIRED

**Rule:** Lint job must check both `gatekeeper` and `flag-oracle` services.

**Why:** These are our core TypeScript services that must maintain zero lint errors (Phase 1 achievement).

**Compliant:**
```yaml
lint:
  steps:
    - run:
        name: Lint gatekeeper
        command: cd gatekeeper && npm ci && npm run lint
    - run:
        name: Lint flag-oracle
        command: cd flag-oracle && npm ci && npm run lint
```

**Current Status:** ✅ Enforced in `.circleci/config.yml`

---

### Policy 4: Test Execution ✅ REQUIRED

**Rule:** Test job must execute actual tests, not just pass trivially.

**Why:** Ensure tests run and pass before merge.

**Compliant:**
```yaml
test:
  steps:
    - run:
        name: Run tests
        command: npm test
    - run:
        name: Run integration tests
        command: npm run test:integration
```

**Violation:**
```yaml
# ❌ No actual test execution
test:
  steps:
    - run: echo "Tests would run here"
```

**Current Status:** ⚠️ Warning - Ensure `npm test` is present

---

### Policy 5: Security Scanning ✅ REQUIRED

**Rule:** Pipeline must include automated security scanning.

**Required Scans:**
- **Secrets scanning** - `./scripts/scan-secrets-enhanced.sh` or Gitleaks
- **Dependency audit** - `npm audit` (can be non-blocking for dev deps)

**Recommended:**
- **Container scanning** - Scan Docker images for vulnerabilities
- **SAST** - Static application security testing

**Compliant:**
```yaml
security-scan:
  steps:
    - run:
        name: Scan for secrets
        command: ./scripts/scan-secrets-enhanced.sh
    - run:
        name: Audit dependencies
        command: npm audit --audit-level=high
```

**Current Status:** ✅ Security scanning configured

---

### Policy 6: Branch Restrictions ⚠️ RECOMMENDED

**Rule:** Workflows should use branch filters to protect main branch.

**Why:** Ensure only approved branches trigger deployments or expensive operations.

**Compliant:**
```yaml
workflows:
  version: 2
  main:
    jobs:
      - lint
      - test
      - security-scan
      - deploy:
          requires:
            - lint
            - test
            - security-scan
          filters:
            branches:
              only: main
```

**Current Status:** ⚠️ Warning - No branch filters detected

**Recommendation:** Add filters to deployment jobs, keep tests running on all branches.

---

### Policy 7: Workflow Dependencies ✅ REQUIRED

**Rule:** Workflows must define job dependencies with `requires`.

**Why:** Ensure lint and tests pass before running expensive operations.

**Compliant:**
```yaml
workflows:
  version: 2
  main:
    jobs:
      - lint
      - test
      - build:
          requires:
            - lint
            - test
      - deploy:
          requires:
            - build
```

**Violation:**
```yaml
# ❌ No dependencies, all jobs run in parallel
workflows:
  version: 2
  main:
    jobs:
      - lint
      - test
      - deploy  # Should require lint + test
```

**Current Status:** ✅ Job dependencies configured

---

### Policy 8: Docker Image Security ✅ RECOMMENDED

**Rule:** Use CircleCI convenience images (`cimg/*`) when possible.

**Why:**
- Maintained by CircleCI team
- Better layer caching
- Security patches applied regularly
- Faster builds

**Compliant:**
```yaml
# ✅ CircleCI convenience image
docker:
  - image: cimg/node:20.10
  - image: cimg/postgres:15.0
```

**Acceptable:**
```yaml
# ✅ Official Docker images (but slower)
docker:
  - image: node:20-alpine
  - image: postgres:15
```

**Warning:**
```yaml
# ⚠️ Unverified third-party image
docker:
  - image: someuser/custom-node:latest
```

**Current Status:** ✅ Using CircleCI convenience images

---

### Policy 9: YAML Syntax Validation ℹ️ INFO

**Rule:** CircleCI configuration should be valid YAML.

**Why:** Catch syntax errors before pushing.

**Validation:**
```bash
# Install yq
brew install yq  # macOS
# OR
wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -O yq

# Validate syntax
yq eval '.' .circleci/config.yml > /dev/null
```

**CircleCI CLI:**
```bash
# Install CircleCI CLI
curl -fLSs https://raw.githubusercontent.com/CircleCI-Public/circleci-cli/master/install.sh | bash

# Validate config
circleci config validate
```

**Current Status:** ℹ️ yq not installed, manual validation recommended

---

### Policy 10: Fail-Fast Configuration ✅ RECOMMENDED

**Rule:** Shell scripts in CI should use `set -euo pipefail`.

**Why:**
- `set -e` - Exit on any command failure
- `set -u` - Exit on undefined variable
- `set -o pipefail` - Fail if any command in pipeline fails

**Compliant:**
```yaml
- run:
    name: Run checks
    command: |
      set -euo pipefail
      npm run lint
      npm run test
      npm run build
```

**Current Status:** ✅ Fail-fast enabled in scripts

---

## Branch Protection

### GitHub Branch Protection Rules

**For `main` branch:**

1. **Require pull request reviews**
   - At least 1 approval required
   - Dismiss stale reviews on new commits

2. **Require status checks to pass**
   - `lint` - Must pass
   - `test` - Must pass
   - `security-scan` - Must pass
   - Require branches to be up to date

3. **Require conversation resolution**
   - All comments must be resolved before merge

4. **Restrict who can push**
   - Only maintainers can push directly
   - All others must use pull requests

5. **Do not allow force pushes**
   - Prevents history rewriting

6. **Do not allow deletions**
   - Prevents accidental branch deletion

**Configuration via GitHub UI:**
```
Repository → Settings → Branches → Add rule

Branch name pattern: main

✅ Require a pull request before merging
   ✅ Require approvals: 1
   ✅ Dismiss stale pull request approvals when new commits are pushed

✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   Status checks:
     - lint
     - test
     - security-scan

✅ Require conversation resolution before merging

✅ Restrict who can push to matching branches
   - Add: maintainers team

✅ Do not allow bypassing the above settings

✅ Restrict pushes that create matching branches

❌ Allow force pushes (disabled)
❌ Allow deletions (disabled)
```

---

## CI Performance Standards

### Target Metrics

| Metric | Target | Max Acceptable |
|--------|--------|----------------|
| Total pipeline time | < 5 min | 10 min |
| Lint job | < 2 min | 3 min |
| Unit tests | < 3 min | 5 min |
| Security scan | < 1 min | 2 min |
| Docker build | < 3 min | 5 min |

### Optimization Strategies

1. **Dependency Caching**
   ```yaml
   - restore_cache:
       keys:
         - v1-dependencies-{{ checksum "package-lock.json" }}
         - v1-dependencies-
   ```

2. **Parallelization**
   ```yaml
   workflows:
     version: 2
     main:
       jobs:
         - lint          # Run in parallel
         - test          # Run in parallel
         - security-scan # Run in parallel
         - build:
             requires:
               - lint
               - test
               - security-scan
   ```

3. **Resource Classes**
   ```yaml
   # For faster builds
   resource_class: medium+  # 3 vCPUs, 6GB RAM
   ```

4. **Smart Test Execution**
   - Run unit tests on every commit
   - Run integration tests on PR only
   - Run E2E tests on main branch or nightly

---

## Workflow Examples

### Standard PR Workflow

```yaml
workflows:
  version: 2
  pr-checks:
    jobs:
      - lint:
          filters:
            branches:
              ignore: main
      
      - test:
          filters:
            branches:
              ignore: main
      
      - security-scan:
          filters:
            branches:
              ignore: main
      
      - build:
          requires:
            - lint
            - test
            - security-scan
          filters:
            branches:
              ignore: main
```

### Main Branch Workflow

```yaml
workflows:
  version: 2
  main-deploy:
    jobs:
      - lint:
          filters:
            branches:
              only: main
      
      - test:
          filters:
            branches:
              only: main
      
      - security-scan:
          filters:
            branches:
              only: main
      
      - build:
          requires:
            - lint
            - test
            - security-scan
          filters:
            branches:
              only: main
      
      - e2e:
          requires:
            - build
          filters:
            branches:
              only: main
      
      - deploy:
          requires:
            - e2e
          filters:
            branches:
              only: main
```

---

## Policy Violations & Remediation

### Common Violations

**1. Third-Party Orbs**
```yaml
# ❌ VIOLATION
orbs:
  codecov: codecov/codecov@3.2.0

# ✅ FIX: Use direct commands
- run:
    name: Upload coverage
    command: |
      curl -Os https://uploader.codecov.io/latest/linux/codecov
      chmod +x codecov
      ./codecov
```

**2. Missing Required Jobs**
```yaml
# ❌ VIOLATION: No lint job
jobs:
  test:
    steps: ...

# ✅ FIX: Add lint job
jobs:
  lint:
    steps: ...
  test:
    steps: ...
```

**3. No Job Dependencies**
```yaml
# ❌ VIOLATION: Deploy without requirements
workflows:
  main:
    jobs:
      - deploy

# ✅ FIX: Add requirements
workflows:
  main:
    jobs:
      - lint
      - test
      - deploy:
          requires:
            - lint
            - test
```

---

## Enforcement Timeline

### M8 (Current)
- ✅ Policy documentation created
- ✅ Validation script implemented
- ✅ Existing config audited
- ⏳ Branch protection rules (manual setup required)

### M9 (Next)
- Add CI validation job to pipeline
- Create pre-commit hook for config validation
- Document exception process

### M10 (Future)
- Automated policy enforcement in CI
- Dashboard for CI metrics
- Weekly policy compliance reports

---

## Exception Process

### Requesting an Exception

If you need to violate a policy:

1. **Create an issue** with:
   - Policy being violated
   - Justification for exception
   - Duration of exception (temporary or permanent)
   - Mitigation measures

2. **Get approval** from:
   - Tech lead (for temporary exceptions)
   - Security team (for security-related policies)
   - All maintainers (for permanent exceptions)

3. **Document the exception** in this file under "Active Exceptions"

4. **Add allowlist** to `validate-circleci.sh` if needed

### Active Exceptions

*None currently*

---

## Monitoring & Reporting

### Weekly CI Health Report

Generate weekly report:
```bash
# Placeholder for future automation
./scripts/ci-health-report.sh --week $(date +%V)
```

**Metrics to Track:**
- Average pipeline duration
- Test pass rate
- Policy compliance rate
- Security scan findings
- Failed builds on main (target: 0)

---

## References

- [CircleCI Best Practices](https://circleci.com/docs/2.0/best-practices/)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [M8 Secrets Management Guide](.docs/SECRETS-MANAGEMENT.md)
- [M8 Implementation Plan](.docs/milestones/M8-IMPLEMENTATION.md)

---

## Support

For questions about CI policies:
1. Check this document first
2. Review `.circleci/config.yml` for examples
3. Run `./scripts/validate-circleci.sh` to check compliance
4. Consult the tech lead for clarification

**Remember:** These policies exist to maintain quality and security. If a policy is blocking legitimate work, use the exception process rather than working around it.
