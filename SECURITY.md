# Security Policy

## ⚠️ Important Context

**Project Yggdrasil is a "vulnerable-by-design" training platform.**

The [`realms/`](realms/) directory contains **intentional** security flaws — SQL injection, SSRF, insecure deserialization, RCE, and more. These are the educational content of the platform, not defects.

**Please do not report vulnerabilities found inside the Realms** unless they let an attacker **escape the container** or **compromise the host** or the **control plane** (Gatekeeper / Flag Oracle). Everything else in a realm is working as designed.

## Supported Versions

Security fixes are applied to the latest minor release. Please upgrade before reporting.

| Version | Supported          | Notes                       |
| ------- | ------------------ | --------------------------- |
| 1.4.x   | :white_check_mark: | Current release             |
| 1.3.x   | :white_check_mark: | Previous minor (critical fixes only) |
| < 1.3   | :x:                | Unsupported                 |

## Reporting a Vulnerability

We take the security of the **control plane** — the Gatekeeper and Flag Oracle — seriously. If you discover a vulnerability in the platform infrastructure (not a challenge realm):

1. **Do not open a public GitHub issue.**
2. Email **kirumachi@proton.me** with the subject line `[SECURITY] Yggdrasil Vulnerability Report`.
3. Include a proof of concept or detailed reproduction steps, the affected version, and the potential impact.

We will acknowledge your report within **48 hours** and keep you updated as we investigate and remediate.

### Scope

| ✅ In scope (please report)                       | ❌ Out of scope (by design)                     |
| ------------------------------------------------- | ----------------------------------------------- |
| `gatekeeper/` — authentication, sessions, CSRF, proxy | Intentional realm vulnerabilities (e.g. Niflheim SSRF, Asgard SQLi) |
| `flag-oracle/` — validation & scoring logic       | Flag values or exploit write-ups                |
| Container escape or host compromise from a realm  | Missing rate limits *inside* a challenge         |
| `docker-compose*.yml` — host/network configuration | Self-XSS or issues requiring a pre-compromised host |
| CI/CD workflow configuration                      | Findings only reachable with `NODE_ENV` set to a non-production value |

If you're unsure whether something is in scope, email us and ask — we'd rather hear about it.

## Safe Harbor

We support safe harbor for security researchers who:

- Act in good faith to identify and report vulnerabilities.
- Do not exploit a vulnerability beyond what is necessary to demonstrate it.
- Do not access, modify, or exfiltrate data that isn't theirs.
- Give us reasonable time to remediate before any public disclosure.

Acting in accordance with this policy, we will not pursue or support legal action against you, and we're happy to credit you in the release notes once a fix ships (unless you prefer to remain anonymous).

---

*Thank you for helping keep Project Yggdrasil and its community safe.*
