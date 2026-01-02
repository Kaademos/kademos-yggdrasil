# ASVS Compliance Matrix
## Project Yggdrasil Security Controls

**Application Security Verification Standard (ASVS) Version:** 5.0  
**Compliance Level Target:** Level 2 (for non-challenge areas) 

---

## Overview

Project Yggdrasil is a **vulnerable-by-design** training platform. This document maps ASVS controls to platform components, explicitly documenting where vulnerabilities are intentional vs. where security controls are enforced.

**Key Principle:** Vulnerabilities are intentional in challenge paths only. All supporting infrastructure (auth, logging, control plane) follows ASVS guidelines.

---

## V1: Architecture, Design and Threat Modeling

| Control | Requirement | Status | Implementation | Notes |
|---------|-------------|--------|----------------|-------|
| V1.1.1 | Component separation | ✅ | Realm isolation via Docker networks | Realms cannot communicate |
| V1.1.2 | Component inventory | ✅ | Documented in AGENTS.md | All services cataloged |
| V1.2.1 | Output encoding | ✅ | JSON responses, template escaping | Non-challenge paths only |
| V1.2.3 | XSS prevention | ✅ | CSP headers, output encoding | Gatekeeper enforces |
| V1.2.4 | SQL injection prevention | ⚠️ Partial | Parameterized where not intentional | Challenge paths vulnerable |
| V1.3.6 | SSRF prevention | ⚠️ Partial | Asgard intentionally vulnerable | Challenge only |
| V1.5.2 | Safe deserialization | ⚠️ Partial | Svartalfheim intentionally vulnerable | Challenge only |

---

## V2: Authentication

| Control | Requirement | Status | Implementation | Location |
|---------|-------------|--------|----------------|----------|
| V2.1.1 | Input validation | ✅ | Username/password validated | `gatekeeper/src/middleware/validation.ts` |
| V2.1.3 | Business logic limits | ✅ | Progression enforced | `flag-oracle/src/services/progression.ts` |
| V2.2.1 | Positive validation | ✅ | Allowlist of valid inputs | Throughout |
| V2.2.3 | Context validation | ✅ | Progression checked before flag accept | `flag-oracle/src/services/progression-validator.ts` |
| V2.3.1 | Step order enforcement | ✅ | Sequential realm unlock | `flag-oracle/src/config/realm-order.ts` |
| V2.3.2 | Business rules enforced | ✅ | Cannot skip realms | Flag Oracle enforces |
| V2.3.3 | Atomic operations | ✅ | Progression updates are transactional | Redis/File operations |
| V2.4.1 | Rate limiting | ✅ | Login, flag submission rate limited | `gatekeeper/src/middleware/rate-limit.ts` |
| V2.4.2 | Anti-automation | ✅ | Rate limits on sensitive endpoints | Multiple services |
| V2.7.1 | Bcrypt for passwords | ✅ | Bcrypt with 10+ rounds | `gatekeeper/src/services/auth-service.ts` |

**Non-Compliant (Intentional):**
- Jotunheim: Session fixation (A07 challenge)

---

## V3: Session Management

| Control | Requirement | Status | Implementation | Location |
|---------|-------------|--------|----------------|----------|
| V3.2.1 | Secure session cookies | ✅ | HttpOnly, Secure (in prod), SameSite | `gatekeeper/src/middleware/session.ts` |
| V3.2.3 | Session regeneration | ✅ | On login | `gatekeeper/src/routes/auth.ts:45` |
| V3.3.1 | HttpOnly flag | ✅ | All session cookies | Session middleware |
| V3.3.2 | SameSite attribute | ✅ | SameSite=Lax | Session middleware |
| V3.3.3 | __Host- prefix | ⚠️ Partial | Not used (complexity vs. benefit) | - |
| V3.3.4 | Secure flag | ⚠️ Partial | Development: false, Production: should be true | Environment-dependent |
| V3.4.1 | HSTS header | ⚠️ Partial | Configured but requires HTTPS | `gatekeeper/src/middleware/security-headers.ts` |
| V3.4.2 | CORS configuration | ✅ | Configured allowlist | `gatekeeper/src/middleware/cors-config.ts` |
| V3.4.3 | CSP header | ✅ | Restrictive policy | Security headers middleware |
| V3.4.4 | X-Content-Type-Options | ✅ | nosniff | Security headers middleware |
| V3.4.5 | Referrer-Policy | ✅ | Configured | Security headers middleware |
| V3.4.6 | Frame-ancestors | ✅ | In CSP | Security headers middleware |
| V3.5.1 | CSRF protection | ✅ | On state-changing operations | `gatekeeper/src/middleware/csrf.ts` |

**Non-Compliant (Intentional):**
- Jotunheim: No session regeneration on login (A07 challenge)

---

## V4: Access Control

| Control | Requirement | Status | Implementation | Location |
|---------|-------------|--------|----------------|----------|
| V4.1.1 | Access control enforced | ✅ | Progression gating | `gatekeeper/src/middleware/realm-gate.ts` |
| V4.1.2 | Attribute/feature-based | ✅ | Realm level checked | Realm gate middleware |
| V4.1.3 | Deny by default | ✅ | 403 for locked realms | Gatekeeper |
| V4.1.5 | Access violations logged | ✅ | 403s logged | Logging middleware |
| V4.2.1 | Sensitive data access control | ⚠️ Partial | Asgard IDOR intentional | Challenge vs non-challenge |
| V4.3.1 | Administrative interfaces protected | ✅ | No admin interface exposed | N/A |

**Non-Compliant (Intentional):**
- Asgard: IDOR vulnerability (A01 challenge)

---

## V5: Input Validation

| Control | Requirement | Status | Implementation | Location |
|---------|-------------|--------|----------------|----------|
| V5.1.1 | HTTP response splitting prevented | ✅ | Framework handles | Express default |
| V5.1.3 | URL validation | ⚠️ Partial | Asgard SSRF intentional | Challenge only |
| V5.1.4 | Header injection prevented | ✅ | Framework handles | Express default |
| V5.2.1 | Validation whitelist | ✅ | Flag format, userId format | `flag-oracle/src/services/flag-validator.ts` |
| V5.2.2 | Structured data validation | ✅ | JSON schema validation | Input validators |
| V5.3.1 | Output encoding | ✅ | JSON auto-encoding | Express default |
| V5.3.4 | Parameterized queries | ⚠️ Partial | Except challenge SQLi | Asgard, Nidavellir vulnerable |
| V5.3.8 | SQL injection prevention | ⚠️ Partial | Non-challenge code uses params | Challenge paths vulnerable |

**Non-Compliant (Intentional):**
- Asgard: SQL injection (A01 challenge)
- Nidavellir: SQL injection (A05 challenge)
- Niflheim: Incomplete range validation (A10 challenge)

---

## V7: Error Handling and Logging

| Control | Requirement | Status | Implementation | Location |
|---------|-------------|--------|----------------|----------|
| V7.1.1 | Generic error messages | ✅ | No details leaked to users | Throughout |
| V7.1.2 | Exception handling | ⚠️ Partial | Niflheim intentionally leaks | Challenge only |
| V7.2.1 | Sensitive data not logged | ✅ | PII scrubbing in logger | `gatekeeper/src/utils/logger.ts` |
| V7.3.1 | Security events logged | ✅ | Login, flag submission, 403s | Logging middleware |
| V7.3.2 | Log integrity | ⚠️ Partial | No tamper protection | Loki provides some |
| V7.3.3 | Log data sanitized | ✅ | Sensitive fields redacted | `sanitizeForLogging()` |
| V7.4.1 | Error messages don't leak | ⚠️ Partial | Niflheim intentional | Challenge only |
| V7.4.3 | Exceptions handled securely | ⚠️ Partial | Niflheim intentional | Challenge only |

**Non-Compliant (Intentional):**
- Niflheim: Exception reveals flag (A10 challenge)
- Helheim: Logs exposed publicly (A09 challenge)

---

## V8: Data Protection

| Control | Requirement | Status | Implementation | Location |
|---------|-------------|--------|----------------|----------|
| V8.1.6 | Cached responses have headers | ✅ | Cache-Control set | Security headers |
| V8.2.1 | Recent browser versions | ✅ | Modern browser target | No legacy support |
| V8.2.2 | Sensitive data not cached | ✅ | Cache-Control: no-store | On sensitive endpoints |
| V8.2.3 | Browser storage not used | ✅ | Server-side sessions only | Gatekeeper |
| V8.3.4 | Encryption in transit | ⚠️ Partial | Development: HTTP, Prod: should use HTTPS | Environment-dependent |

---

## V9: Communication

| Control | Requirement | Status | Implementation | Location |
|---------|-------------|--------|----------------|----------|
| V9.1.1 | TLS for sensitive data | ⚠️ Partial | Development: no TLS | Should use in production |
| V9.1.2 | Latest TLS version | ⚠️ Partial | Depends on reverse proxy | External concern |
| V9.1.3 | Strong cipher suites | ⚠️ Partial | Depends on reverse proxy | External concern |
| V9.2.1 | Server certificates validated | ✅ | Node.js default | N/A |

**Note:** TLS termination expected at load balancer/reverse proxy in production.

---

## V10: Malicious Code

| Control | Requirement | Status | Implementation | Location |
|---------|-------------|--------|----------------|----------|
| V10.2.1 | Dependency vulnerability scanning | ⚠️ Partial | `npm audit` available | Not automated yet |
| V10.2.2 | Components from trusted sources | ✅ | npm registry only | package-lock.json |
| V10.2.3 | Package integrity | ✅ | npm lock files | package-lock.json |
| V10.3.1 | Deployment from trusted source | ✅ | Git repository | CI/CD |

**Non-Compliant (Intentional):**
- Midgard: Dependency confusion (A03 challenge)

---

## V12: Files and Resources

| Control | Requirement | Status | Implementation | Location |
|---------|-------------|--------|----------------|----------|
| V12.1.1 | File upload validation | N/A | No file uploads | - |
| V12.3.1 | File inclusion prevented | ✅ | No dynamic file inclusion | Static serving only |
| V12.6.1 | SSRF prevention | ⚠️ Partial | Asgard intentional | Challenge only |

**Non-Compliant (Intentional):**
- Asgard: SSRF via Odin-View (A01 challenge)
- Alfheim: Cloud misconfiguration (A02 challenge)

---

## V14: Configuration

| Control | Requirement | Status | Implementation | Location |
|---------|-------------|--------|----------------|----------|
| V14.1.1 | Secure build pipeline | ⚠️ Partial | CI/CD in progress | M6 Phase 6 |
| V14.1.3 | Dependency security | ⚠️ Partial | npm audit available | Should automate |
| V14.2.1 | Security headers | ✅ | Comprehensive headers | Security headers middleware |
| V14.3.2 | Debug mode disabled | ⚠️ Partial | Environment-dependent | NODE_ENV |
| V14.4.1 | HTTP response headers | ✅ | Security headers set | Middleware |
| V14.5.1 | Unused HTTP methods disabled | ✅ | Only required methods | Route definitions |

---

## Summary by Service

### Gatekeeper (Control Plane)

**Compliance Level:** ~90% (Level 2)

**Compliant:**
- Authentication & session management
- Access control & progression gating
- Security headers
- Rate limiting
- CSRF protection
- Logging & monitoring

**Gaps:**
- TLS (development only)
- Some advanced headers (__Host- prefix)

### Flag Oracle (Control Plane)

**Compliance Level:** ~85% (Level 2)

**Compliant:**
- Input validation
- Business logic enforcement
- Atomic operations
- Logging

**Gaps:**
- TLS (development only)
- Log integrity protection

### Realms (Challenge Components)

**Compliance Level:** Intentionally LOW (by design)

Each realm implements specific vulnerabilities as documented. Non-challenge code paths are compliant where practical.

**Realm-Specific Deviations:**
- Niflheim (A10): Exception handling
- Helheim (A09): Log exposure
- Svartalfheim (A08): Deserialization
- Jotunheim (A07): Session fixation
- Muspelheim (A06): Business logic
- Nidavellir (A05): SQL injection
- Vanaheim (A04): Weak crypto
- Midgard (A03): Supply chain
- Alfheim (A02): Misconfiguration
- Asgard (A01): Access control, SQLi, SSRF

---

## Remediation Roadmap (if deploying securely)

**For Production Deployment:**

1. **TLS Everywhere** (High Priority)
   - Terminate TLS at load balancer
   - Enforce HTTPS redirects
   - Enable HSTS with long max-age

2. **Secrets Management** (High Priority)
   - Migrate to Vault or similar
   - Rotate all secrets
   - Use Docker Secrets

3. **Monitoring & Alerting** (High Priority)
   - Configure AlertManager
   - Set up PagerDuty/OpsGenie
   - Automated incident response

4. **Dependency Management** (Medium Priority)
   - Automate `npm audit` in CI
   - Dependabot or Renovate
   - Weekly security reviews

5. **Enhanced Logging** (Medium Priority)
   - Log integrity/signing
   - Longer retention (compliance)
   - SIEM integration

6. **Network Hardening** (Medium Priority)
   - Network policies in Kubernetes
   - Firewall rules
   - VPC isolation

---

## Testing & Validation

**Automated:**
- Security headers: `npm test -- tests/security/headers.spec.ts`
- Rate limiting: `npm test -- tests/security/rate-limiting.spec.ts`
- Secrets scan: `./scripts/scan-secrets.sh`

**Manual:**
- Penetration testing (intentional vulnerabilities)
- Security audit (non-challenge code)
- Code review against ASVS checklist

---

## References

- [ASVS 4.0 PDF](https://github.com/OWASP/ASVS/blob/master/4.0/OWASP%20Application%20Security%20Verification%20Standard%204.0-en.pdf)
- [OWASP Top 10 2025](https://owasp.org/www-project-top-ten/)
- [Project Documentation](./)

---
