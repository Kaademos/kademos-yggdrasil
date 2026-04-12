# Secrets Management Guide (M8)

**Version:** 1.0.0  
**Last Updated:** 2025-12-13  
**Status:** Production-Ready

---

## Overview

Project Yggdrasil is a **vulnerable-by-design** security training platform. This creates unique challenges for secrets management:

1. **Intentional vulnerabilities** include weak passwords and exposed credentials
2. **Real secrets** (AWS keys, GitHub tokens, production credentials) must never be committed
3. **Challenge flags** should be environment-configured, not hard-coded

This document defines our secrets management strategy and tooling.

---

## Secrets Classification

### CRITICAL (Never Commit)
- **Private keys** (RSA, DSA, EC, PGP)
- **Cloud provider credentials** (AWS, GCP, Azure)
- **API tokens** (GitHub, NPM, OpenAI, Slack)
- **Production database credentials**
- **SSH keys**
- **TLS/SSL certificates**

### HIGH (Review Before Commit)
- **Real Yggdrasil flags** (format: `YGGDRASIL{REALM:uuid}`)
- **Strong passwords** (12+ characters)
- **API keys** (32+ characters)
- **Bearer tokens** (40+ characters)
- **Long JWT tokens**

### MEDIUM (Acceptable with Context)
- **Weak passwords** (intentional for challenges)
- **Example credentials** (clearly marked as fake)
- **Test tokens** (in test files only)
- **Development database URLs** (localhost only)

---

## Tools & Configuration

### 1. Enhanced Secrets Scanner

**Location:** `scripts/scan-secrets-enhanced.sh`

**Features:**
- Multi-level severity (CRITICAL, HIGH, MEDIUM)
- Comprehensive pattern library (AWS, GitHub, NPM, Docker, etc.)
- Colored output with context
- Configurable exit behavior

**Usage:**
```bash
# Run scan (exits 1 on CRITICAL/HIGH findings)
./scripts/scan-secrets-enhanced.sh

# Strict mode (also exits on MEDIUM findings)
EXIT_ON_MEDIUM=true ./scripts/scan-secrets-enhanced.sh

# CI mode (no colors)
CI=true ./scripts/scan-secrets-enhanced.sh

# Disable context lines
SHOW_CONTEXT=false ./scripts/scan-secrets-enhanced.sh
```

**Exit Codes:**
- `0` = Clean (or only MEDIUM with `EXIT_ON_MEDIUM=false`)
- `1` = CRITICAL or HIGH findings detected
- `2` = MEDIUM findings (only if `EXIT_ON_MEDIUM=true`)

### 2. Gitleaks Configuration

**Location:** `.gitleaks.toml`

**Features:**
- Production-grade secret detection
- Yggdrasil-specific allowlists
- Distinguishes intentional vulnerabilities from real leaks

**Usage:**
```bash
# Install Gitleaks
brew install gitleaks  # macOS
# OR
curl -sSfL https://raw.githubusercontent.com/gitleaks/gitleaks/master/scripts/install.sh | sh

# Scan repository
gitleaks detect --config .gitleaks.toml --verbose

# Scan uncommitted changes
gitleaks protect --config .gitleaks.toml --staged

# Scan specific commit
gitleaks detect --config .gitleaks.toml --log-opts="HEAD~1..HEAD"
```

**CI Integration:**
```yaml
# .circleci/config.yml
- run:
    name: Scan for secrets
    command: |
      curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.18.1/gitleaks_8.18.1_linux_x64.tar.gz | tar -xz
      ./gitleaks detect --config .gitleaks.toml --report-path gitleaks-report.json --exit-code 1
```

### 3. Hardened .gitignore

**Location:** `.gitignore`

**M8 Enhancements:**
- Comprehensive secrets patterns (`.pem`, `.key`, credentials files)
- Cloud provider config directories (`.aws/`, `.gcloud/`, `.azure/`)
- SSH and certificate files
- Backup and temporary files that might contain secrets

---

## Known False Positives

### Intentional Vulnerabilities (Allowlisted)

1. **AWS Example Key in Alfheim**
   - **Finding:** `AKIAIOSFODNN7EXAMPLE`
   - **Status:** ✅ Safe - This is AWS's official documentation example
   - **Location:** `realms/alfheim/src/services/storage-service.ts`
   - **Reason:** Used to demonstrate S3 API exploitation

2. **Weak Passwords in Jotunheim**
   - **Finding:** `frostwall123`, `icethrone2024`
   - **Status:** ✅ Intentional - Part of auth bypass challenge
   - **Location:** `realms/jotunheim/src/services/auth-service.ts`
   - **Reason:** Players must exploit weak authentication

3. **Flags in .env File**
   - **Finding:** `YGGDRASIL{REALM:uuid}` patterns
   - **Status:** ✅ Expected - Flags are environment-configured
   - **Location:** `.env`
   - **Reason:** Flags should be in environment, not hard-coded

4. **Database Credentials in docker-compose.yml**
   - **Finding:** `POSTGRES_PASSWORD=asgard_secure_pass`
   - **Status:** ✅ Acceptable - Local development only
   - **Location:** `docker-compose.yml`
   - **Reason:** Development environment, not production

5. **Bearer Tokens in Vanaheim Docs**
   - **Finding:** `Bearer VAN-A1B2C3D4E5F60123`
   - **Status:** ✅ Safe - Example token in documentation
   - **Location:** `realms/vanaheim/README.md`
   - **Reason:** Documentation example

---

## Best Practices

### For Developers

**DO:**
- ✅ Use `.env` files for configuration (they're gitignored)
- ✅ Use `<generate-strong-secret>` placeholders in `.env.example`
- ✅ Mark intentional vulnerabilities with comments: `// VULNERABLE: weak password for challenge`
- ✅ Use environment variables for flags: `process.env.REALM_FLAG`
- ✅ Document false positives in this file
- ✅ Run `./scripts/scan-secrets-enhanced.sh` before committing

**DON'T:**
- ❌ Commit real API tokens (GitHub, AWS, OpenAI, etc.)
- ❌ Commit private keys (`.pem`, `.key`, `id_rsa`, etc.)
- ❌ Hard-code flags in source code
- ❌ Commit production credentials
- ❌ Use real passwords in examples

### For Challenge Design

When creating new challenges with weak credentials:

```typescript
// ✅ GOOD: Clearly marked as intentional
// VULNERABLE: Weak password for brute force challenge
const DEFAULT_ADMIN_PASSWORD = 'admin123';

// ✅ GOOD: Environment-driven flag
const REALM_FLAG = process.env.ALFHEIM_FLAG || 'YGGDRASIL{ALFHEIM:placeholder}';

// ❌ BAD: Hard-coded real flag
const FLAG = 'YGGDRASIL{ALFHEIM:a1b2c3d4-...}';  // Scanner will catch this

// ❌ BAD: No indication this is intentional
const password = 'weakpass123';  // Looks like a mistake
```

### For CI/CD

**Pre-commit Hook (Recommended):**
```bash
# .git/hooks/pre-commit
#!/bin/bash
./scripts/scan-secrets-enhanced.sh
if [ $? -ne 0 ]; then
  echo "❌ Secrets detected! Commit blocked."
  echo "   Review findings above or override with: git commit --no-verify"
  exit 1
fi
```

**CircleCI Integration:**
```yaml
jobs:
  security-scan:
    docker:
      - image: cimg/base:stable
    steps:
      - checkout
      - run:
          name: Scan for secrets
          command: ./scripts/scan-secrets-enhanced.sh
      - run:
          name: Run Gitleaks
          command: |
            curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.18.1/gitleaks_8.18.1_linux_x64.tar.gz | tar -xz
            ./gitleaks detect --config .gitleaks.toml --exit-code 1
```

---

## Incident Response

### If Real Secrets Are Committed

**Immediate Actions:**

1. **Rotate the secret immediately**
   - AWS: Deactivate key in IAM console
   - GitHub: Revoke token in Settings → Developer settings
   - NPM: Revoke token in Access Tokens page

2. **Remove from Git history**
   ```bash
   # Using git filter-repo (recommended)
   git filter-repo --path-glob '*secrets.yml' --invert-paths

   # OR using BFG Repo-Cleaner
   bfg --delete-files secrets.yml
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

3. **Force push to remote** (coordinate with team)
   ```bash
   git push origin --force --all
   git push origin --force --tags
   ```

4. **Document in security log**
   - What was exposed
   - How it was discovered
   - Remediation taken
   - Prevention measures added

5. **Update this document** with the new pattern to catch

### Prevention Checklist

Before each commit:
- [ ] Run `./scripts/scan-secrets-enhanced.sh`
- [ ] Review `git diff --cached` for sensitive data
- [ ] Verify no new `.env` files (except `.env.example`)
- [ ] Check that flags use environment variables
- [ ] Confirm test credentials are clearly marked

---

## Pattern Reference

### CRITICAL Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `AKIA[0-9A-Z]{16}` | AWS Access Key | `AKIAIOSFODNN7EXAMPLE` |
| `-----BEGIN.*PRIVATE KEY-----` | Private Key | RSA/DSA/EC keys |
| `ghp_[A-Za-z0-9]{36}` | GitHub PAT | `ghp_abc123...` |
| `npm_[A-Za-z0-9]{36}` | NPM Token | `npm_xyz789...` |
| `sk-[A-Za-z0-9]{48}` | OpenAI Key | `sk-proj-...` |

### HIGH Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `YGGDRASIL\{[A-Z_]+:uuid\}` | Real Flag | `YGGDRASIL{ASGARD:...}` |
| `password.*['\"][^'\"]{12,}['\"]` | Strong Password | 12+ character passwords |
| `api[_-]?key.*['\"][A-Za-z0-9]{32,}['\"]` | API Key | 32+ character keys |
| `Bearer [A-Za-z0-9\-._~+/]{40,}` | Long Bearer Token | OAuth/JWT tokens |

### MEDIUM Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `password.*['\"][^'\"]{8,11}['\"]` | Short Password | 8-11 character passwords |
| `TODO.*password` | TODO Comment | Code comments about passwords |
| `admin.*123` | Weak Admin Cred | Common weak patterns |

---

## Maintenance

### Adding New Patterns

When you discover a new type of secret that should be caught:

1. **Update `scripts/scan-secrets-enhanced.sh`**
   ```bash
   # Add to appropriate severity array
   ["new-pattern-regex"]="Description of secret type"
   ```

2. **Update `.gitleaks.toml`**
   ```toml
   [[rules]]
   id = "new-secret-type"
   description = "New Secret Type"
   regex = '''pattern-here'''
   tags = ["category", "severity"]
   ```

3. **Document in this file** (Pattern Reference section)

4. **Test the pattern**
   ```bash
   # Create test file with pattern
   echo "new-secret-here" > /tmp/test-secret.txt
   
   # Verify scanner catches it
   ./scripts/scan-secrets-enhanced.sh
   ```

### Reviewing False Positives

If scanner reports false positives:

1. **Verify it's actually safe** (not a real secret)
2. **Update allowlists** in `.gitleaks.toml`
3. **Document in "Known False Positives"** section above
4. **Consider if pattern is too broad** and needs refinement

---

## References

- [Gitleaks Documentation](https://github.com/gitleaks/gitleaks)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [AWS: What to Do If You Inadvertently Expose a Secret](https://aws.amazon.com/premiumsupport/knowledge-center/delete-keys-secrets/)

---

## Support

For questions about secrets management:
1. Check this document first
2. Review `.gitleaks.toml` configuration
3. Check CI logs for specific findings
4. Consult the security team

**Remember:** When in doubt, treat it as a real secret and rotate it.
