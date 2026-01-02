# Midgard Package Registry (Verdaccio)

This directory contains the Verdaccio npm registry configuration for Midgard realm's supply chain challenge.

## Structure

```
registry/
├── config.yaml          # Verdaccio configuration
├── htpasswd             # User authentication (weak credentials)
└── README.md            # This file
```

## Configuration

**Registry URL:** `http://verdaccio:4873` (internal Docker network)

**Authentication:**
- Username: `midgard-ci`
- Password: `BuildSecret2025`
- INSTRUCTOR NOTE: Intentionally weak for challenge

## Pre-Seeded Packages

### Private Packages (@midgard/*)
- `@midgard/ui-kit@1.0.0` - Legitimate internal UI components
- `@midgard/core@1.5.0` - Core utilities

### Public Packages (Malicious)
- `midgard-ui-kit@1.0.1` - TYPOSQUAT of @midgard/ui-kit (higher version)
- `midgard-utils-v2@1.0.0` - Generic malicious package

## Vulnerability

**OWASP A03:2025 - Software Supply Chain Failures**

The registry configuration allows dependency confusion attacks:
1. Public registry is checked via proxy (npmjs uplink)
2. Unscoped package names can shadow scoped private packages
3. Higher version numbers on public packages take precedence
4. No validation of package sources during build

## Docker Integration

The Verdaccio service is defined in `docker-compose.yml`:
- Container: `midgard-registry`
- Network: `midgard_net` (shared with midgard realm)
- Volume: `verdaccio_storage` (persistent package storage)
- Health check: Pings `/-/ping` endpoint

## Usage

**Start registry:**
```bash
docker-compose up -d verdaccio
```

**Check health:**
```bash
curl http://localhost:4873/-/ping
```

**Publish package (from within realm):**
```bash
npm publish --registry http://verdaccio:4873
```

**Install package:**
```bash
npm install midgard-ui-kit --registry http://verdaccio:4873
```

## Security Notes

- Authentication file uses bcrypt hashing
- Weak password intentionally used for challenge
- All packages accessible for exploration (educational)
- Postinstall scripts execute in sandboxed environment

## Troubleshooting

**Registry not accessible:**
- Check `docker-compose logs verdaccio`
- Verify `midgard_net` network exists
- Confirm health check passing

**Package not found:**
- Packages must be pre-seeded or published
- Check `verdaccio_storage` volume contents
- Verify uplink configuration for npmjs proxy

---

**For Instructors:**
This registry demonstrates realistic npm dependency confusion. The malicious packages contain postinstall scripts that exfiltrate environment variables (including the FLAG) to build artifacts.
