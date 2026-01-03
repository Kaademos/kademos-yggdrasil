# Changelog

All notable changes to Project Yggdrasil will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/your-org/project_yggdrasil/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/your-org/project_yggdrasil/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/your-org/project_yggdrasil/releases/tag/v1.0.0
