# Security Policy

## ⚠️ Important Context
**Project Yggdrasil is a "Vulnerable-by-Design" training platform.**

The `realms/` directory contains intentional security flaws (SQL Injection, SSRF, RCE, etc.) for educational purposes. **Please do not report exploits found within the Realms** unless they allow an attacker to escape the container environment or compromise the host machine (Gatekeeper/Control Plane).

## Supported Versions

| Version | Supported          | Notes |
| ------- | ------------------ | ----- |
| 1.0.x   | :white_check_mark: | Current Release Candidates |
| < 1.0   | :x:                | Deprecated |

## Reporting a Vulnerability

We take the security of our **Control Plane (Gatekeeper)** and **Flag Oracle** seriously. If you discover a vulnerability in the platform infrastructure (not the challenge realms), please follow these steps:

1. **Do not open a public GitHub Issue.**
2. Send an email to **kirumachi@proton.me** with the subject line `[SECURITY] Yggdrasil Vulnerability Report`.
3. Include a Proof of Concept (PoC) or detailed steps to reproduce.

### Scope

| In Scope (Report These) | Out of Scope (Do Not Report) |
| ----------------------- | ---------------------------- |
| `gatekeeper/` (Authentication, Session Mgmt) | `realms/niflheim` (Intentional SSRF) |
| `flag-oracle/` (Validation Logic) | `realms/asgard` (Intentional SQLi) |
| `docker-compose.yml` (Host Configuration) | Any other Realm exploits |
| GitHub Action Workflows | |

## Safe Harbor
We support safe harbor for security researchers who:
- Act in good faith to identify and report vulnerabilities.
- Do not exploit the vulnerability beyond what is needed to prove its existence.
- Do not exfiltrate user data.

We will acknowledge receipt of your report within 48 hours.