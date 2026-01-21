# Yggdrasil Platform Operator Guide

**Version:** 2.0  
**Last Updated:** 2025-12-13  
**M13:** Immersion & Final Polish

---

## Table of Contents

1. [Introduction](#introduction)
2. [Platform Architecture](#platform-architecture)
3. [Installation & Setup](#installation--setup)
4. [Starting the Platform](#starting-the-platform)
5. [User Management](#user-management)
6. [Progression & Flag Management](#progression--flag-management)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Troubleshooting](#troubleshooting)
9. [Security Operations](#security-operations)
10. [Backup & Recovery](#backup--recovery)
11. [Performance Tuning](#performance-tuning)
12. [Incident Response](#incident-response)

---

## Introduction

### Purpose

This guide provides comprehensive operational procedures for running and maintaining the Yggdrasil cybersecurity training platform. It is intended for:
- Platform administrators
- Security instructors
- DevOps engineers
- System operators

### Prerequisites

**Required Knowledge:**
- Docker & Docker Compose
- Basic Linux system administration
- Basic networking concepts
- Basic SQL (for progression database)

**System Requirements:**
- Docker 20.10+ with Docker Compose v2
- 8GB+ RAM (16GB recommended)
- 40GB+ disk space
- Linux, macOS, or Windows with WSL2

---

## Platform Architecture

### Overview

Yggdrasil consists of 12 Docker containers:

**Control Plane:**
1. `yggdrasil-gatekeeper` - Central ingress, routing, progression enforcement
2. `flag-oracle` - Flag validation and progression state persistence

**Realm Services (10 total):**
3. `asgard` - Realm 1: HR portal (SQLi, IDOR)
4. `alfheim` - Realm 2: Cloud storage (SSRF → IMDS → S3)
5. `midgard` - Realm 3: Package registry (supply chain)
6. `vanaheim` - Realm 4: Merchant platform (weak PRNG)
7. `nidavellir` - Realm 5: Forge/mining (SQLi)
8. `muspelheim` - Realm 6: Trading platform (race condition)
9. `jotunheim` - Realm 7: Portal system (session fixation)
10. `svartalfheim` - Realm 8: Forge system (deserialization)
11. `helheim` - Realm 9: Memorial/admin (LFI)
12. `niflheim` - Realm 10: SCADA system (SSRF, crash reports)

**Supporting Services:**
- `asgard-db` - PostgreSQL for Asgard realm
- Additional DBs as needed per realm

### Network Architecture

```
┌──────────────────────────────────────────────────┐
│  yggdrasil_main network (gatekeeper + flag-oracle) │
└──────────────────────────────────────────────────┘
                      │
                      │ (gatekeeper attached to ALL networks)
                      │
    ┌─────────────────┴─────────────────┬──────────────...
    │                 │                 │
┌───▼────┐     ┌─────▼──────┐    ┌────▼──────┐
│asgard  │     │ alfheim_net│    │midgard_net│ ...
│_net    │     └────────────┘    └───────────┘
└────────┘

```

**Key Points:**
- Each realm has its own isolated Docker network
- Gatekeeper is the ONLY service attached to all networks
- Realms cannot communicate directly with each other
- Flag-oracle is only accessible via gatekeeper

---

## Installation & Setup

### Initial Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/project_yggdrasil.git
cd project_yggdrasil

# 2. Copy environment template
cp .env.example .env

# 3. Generate flag values (if needed)
./scripts/generate-flags.sh

# 4. Build all services
docker-compose build

# 5. Start the platform
docker-compose up -d

# 6. Verify all services are running
docker-compose ps

# 7. Check logs for errors
docker-compose logs --tail=50
```

### Environment Configuration

Edit `.env` in the project root:

```bash
# Global Configuration
YGGDRASIL_PORT=3000
NODE_ENV=production

# Flag Oracle
FLAG_ORACLE_PORT=4000
PROGRESSION_STORE=redis  # or 'file'

# Security
SESSION_SECRET=<generate-strong-secret>
JWT_SECRET=<generate-strong-secret>

# Per-Realm Flags (in docker-compose.yml)
# Each realm's flag is set in its service environment block
```

**Important:** Never commit `.env` to version control. Use `.env.example` for templates.

### Generating Secrets

```bash
# Generate secure random secrets
openssl rand -base64 32

# Generate UUIDs for flags
uuidgen
```

---

## Starting the Platform

### Normal Startup

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Expected output: All services should show "Up" status
```

### Startup Order

Docker Compose handles dependencies automatically, but the internal startup sequence is:

1. **Database services** (if any) - `asgard-db`, etc.
2. **Flag Oracle** - Progression state service
3. **Realm services** - All 10 realm containers
4. **Gatekeeper** - Waits for flag-oracle and realms

### Verification

```bash
# 1. Check all containers are running
docker-compose ps | grep -v "Up"  # Should return nothing

# 2. Test gatekeeper health
curl http://localhost:3000/health

# 3. Test flag-oracle health
curl http://localhost:3000/api/flag-oracle/health

# 4. Test first realm (Asgard) accessibility
curl -I http://localhost:3000/realm/asgard
```

### Selective Startup

```bash
# Start only specific services
docker-compose up -d gatekeeper flag-oracle asgard

# Start all except one realm
docker-compose up -d $(docker-compose config --services | grep -v helheim)
```

---

## User Management

### User Registration

**Manual Registration (Development):**

```bash
# Using gatekeeper API
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "student1",
    "password": "SecurePass123!",
    "email": "student1@example.com"
  }'
```

**Bulk Registration:**

```bash
# Create users from CSV
./scripts/bulk-register-users.sh users.csv

# CSV format:
# username,email,password
# student1,student1@example.com,pass1
# student2,student2@example.com,pass2
```

### User Roles

Yggdrasil supports three roles:

1. **Student** - Normal user, progression-based access
2. **Instructor** - Can view all realms, manage flags
3. **Admin** - Full platform access, user management

**Setting roles:**

```bash
# Via flag-oracle API
curl -X POST http://localhost:3000/api/admin/set-role \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "role": "instructor"
  }'
```

### Password Reset

```bash
# Reset user password
curl -X POST http://localhost:3000/api/admin/reset-password \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "newPassword": "NewSecurePass456!"
  }'
```

---

## Progression & Flag Management

### Understanding Progression

**Progression Model:**
- Users start at level 0 (no realms unlocked)
- Submitting a valid flag unlocks the next realm
- Progression is linear: Asgard → Alfheim → Midgard → ... → Niflheim
- Users cannot skip realms

**Progression State Storage:**
- Default: Redis (in-memory, fast)
- Alternative: JSON file (persistent, simpler)

### Viewing User Progression

```bash
# Get user's current level
curl http://localhost:3000/api/progression/user/user123 \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response:
# {
#   "userId": "user123",
#   "currentLevel": 5,
#   "unlockedRealms": ["asgard", "alfheim", "midgard", "vanaheim", "nidavellir"],
#   "completedFlags": 5,
#   "lastFlagSubmitted": "2025-12-13T10:30:00Z"
# }
```

### Flag Rotation

**Why Rotate Flags:**
- Prevent flag sharing between cohorts
- Refresh challenges for repeated courses
- Maintain challenge integrity

**Rotation Procedure:**

```bash
# 1. Generate new flags
./scripts/generate-flags.sh > new-flags.env

# 2. Update docker-compose.yml with new flag values
# (Edit each realm's FLAG environment variable)

# 3. Restart realms with new flags
docker-compose up -d --force-recreate \
  asgard alfheim midgard vanaheim nidavellir \
  muspelheim jotunheim svartalfheim helheim niflheim

# 4. Clear old progression state (optional)
curl -X POST http://localhost:3000/api/admin/clear-progression \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. Verify new flags are active
curl http://localhost:3000/api/admin/verify-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Flag Rotation Best Practices:**
- Rotate between training cohorts (every 3-6 months)
- Document old flags for incident investigation
- Notify instructors before rotation
- Test new flags before students access platform

### Manual Progression Adjustment

```bash
# Unlock a specific realm for a user
curl -X POST http://localhost:3000/api/admin/unlock-realm \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "realm": "helheim"
  }'

# Reset user progression (start over)
curl -X POST http://localhost:3000/api/admin/reset-progression \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123"
  }'

# Bulk unlock for all users (emergency)
curl -X POST http://localhost:3000/api/admin/bulk-unlock \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "realm": "niflheim",
    "reason": "Platform issue - emergency unlock"
  }'
```

---

## Monitoring & Health Checks

### Container Health

```bash
# Check all container status
docker-compose ps

# Expected output: All services "Up", healthy

# Check individual container logs
docker-compose logs -f asgard

# Check recent errors across all services
docker-compose logs --tail=100 | grep -i error
```

### Service Health Endpoints

**Gatekeeper:**
```bash
curl http://localhost:3000/health
# Expected: {"status": "ok", "timestamp": "..."}
```

**Flag Oracle:**
```bash
curl http://localhost:3000/api/flag-oracle/health
# Expected: {"status": "ok", "progression_store": "redis"}
```

**Individual Realms:**
```bash
# Each realm should respond on its health endpoint
curl http://localhost:3000/realm/asgard/health
curl http://localhost:3000/realm/niflheim/api/health
```

### Resource Monitoring

```bash
# Container resource usage
docker stats

# Disk usage
docker system df

# Network statistics
docker network inspect yggdrasil_main
```

### Log Monitoring

**Centralized Logging:**

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f gatekeeper

# Search for errors
docker-compose logs | grep -i "error\|fatal\|critical"

# Filter by time
docker-compose logs --since 1h | grep asgard
```

**Log Files Locations:**
- Container logs: Managed by Docker (docker logs)
- Application logs: May be in `/var/log` inside containers
- External logs: Configure with Docker logging drivers

---

## Troubleshooting

### Common Issues

#### Issue 1: "Realm Locked" Error When It Shouldn't Be

**Symptoms:**
- User has submitted flag but realm still locked
- Progression not updating after flag submission

**Diagnosis:**
```bash
# Check user progression
curl http://localhost:3000/api/progression/user/$USER_ID

# Check flag-oracle logs
docker-compose logs flag-oracle | tail -50

# Check flag format
echo "YGGDRASIL{REALM:uuid}" | grep -E "YGGDRASIL\{[A-Z]+:[a-f0-9-]+\}"
```

**Resolution:**
```bash
# Option 1: Manually unlock realm
curl -X POST http://localhost:3000/api/admin/unlock-realm \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"userId": "$USER_ID", "realm": "midgard"}'

# Option 2: Restart flag-oracle to refresh state
docker-compose restart flag-oracle
```

#### Issue 2: Service Container Won't Start

**Symptoms:**
- `docker-compose ps` shows container as "Restarting" or "Exited"

**Diagnosis:**
```bash
# Check exit code and logs
docker-compose ps
docker-compose logs $SERVICE_NAME

# Check for port conflicts
netstat -tulpn | grep $PORT

# Check resource limits
docker inspect $CONTAINER_ID | grep -A 10 Resources
```

**Resolution:**
```bash
# Rebuild container
docker-compose build --no-cache $SERVICE_NAME
docker-compose up -d $SERVICE_NAME

# Check for environment variable issues
docker-compose config | grep -A 5 $SERVICE_NAME
```

#### Issue 3: Cannot Access Realm Through Gatekeeper

**Symptoms:**
- 404 or 502 errors when accessing `/realm/...`
- Gatekeeper logs show proxy errors

**Diagnosis:**
```bash
# Test direct realm connectivity (from gatekeeper container)
docker-compose exec gatekeeper curl http://asgard:3000/health

# Check network connectivity
docker network inspect asgard_net

# Verify gatekeeper is attached to realm network
docker inspect yggdrasil-gatekeeper | grep -A 20 Networks
```

**Resolution:**
```bash
# Reconnect gatekeeper to realm network
docker network connect asgard_net yggdrasil-gatekeeper

# Restart gatekeeper
docker-compose restart gatekeeper
```

#### Issue 4: Database Connection Errors

**Symptoms:**
- Realm logs show "ECONNREFUSED" or "Cannot connect to database"
- User data not persisting

**Diagnosis:**
```bash
# Check DB container status
docker-compose ps asgard-db

# Check DB logs
docker-compose logs asgard-db

# Test DB connectivity
docker-compose exec asgard-db psql -U postgres -c "SELECT 1"
```

**Resolution:**
```bash
# Restart database
docker-compose restart asgard-db

# Verify environment variables
docker-compose exec asgard env | grep DATABASE

# Check for init script issues
docker-compose logs asgard-db | grep "init"
```

#### Issue 5: Session/Authentication Issues

**Symptoms:**
- Users logged out unexpectedly
- "Session Expired" errors
- Cannot log in with valid credentials

**Diagnosis:**
```bash
# Check session store (Redis)
docker-compose exec flag-oracle redis-cli KEYS "session:*"

# Check session secret consistency
docker-compose exec gatekeeper env | grep SESSION_SECRET

# Check for clock skew
docker-compose exec gatekeeper date
date
```

**Resolution:**
```bash
# Clear all sessions (forces re-login)
docker-compose exec flag-oracle redis-cli FLUSHDB

# Restart gatekeeper with consistent session secret
docker-compose restart gatekeeper

# Verify time sync (if clock skew detected)
sudo ntpdate time.nist.gov
```

---

## Security Operations

### Regular Security Tasks

**Weekly:**
- Review access logs for suspicious activity
- Check for unauthorized progression changes
- Verify flag integrity
- Update platform components if patches available

**Monthly:**
- Rotate session secrets
- Review user accounts (remove inactive)
- Audit admin actions
- Check for unusual resource consumption

**Per Cohort:**
- Rotate flags
- Clear old progression data
- Review and update challenge content

### Monitoring Suspicious Activity

**Red Flags:**
- Multiple rapid flag submissions from one user
- Unusual API request patterns
- Direct container access attempts
- Progression jumps without flag submissions

**Investigation Procedure:**

```bash
# 1. Check user's submission history
curl http://localhost:3000/api/admin/user-activity/$USER_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Review access logs
docker-compose logs gatekeeper | grep $USER_ID

# 3. Check for API abuse
docker-compose logs flag-oracle | grep $USER_ID | grep -i "429\|rate"

# 4. Review progression timeline
curl http://localhost:3000/api/admin/progression-timeline/$USER_ID
```

### Incident Response

**If Challenge Integrity Compromised:**

1. **Contain:**
   ```bash
   # Lock affected realm
   docker-compose stop $REALM_SERVICE
   ```

2. **Investigate:**
   ```bash
   # Export logs
   docker-compose logs $REALM_SERVICE > incident-$(date +%Y%m%d).log
   
   # Check for flag leaks
   grep -r "YGGDRASIL{" incident-*.log
   ```

3. **Remediate:**
   ```bash
   # Rotate affected flag
   # Update docker-compose.yml
   docker-compose up -d --force-recreate $REALM_SERVICE
   
   # Clear progression for affected users
   curl -X POST http://localhost:3000/api/admin/bulk-reset \
     -d '{"realm": "$REALM", "reason": "Integrity issue"}'
   ```

4. **Document:**
   - Create incident report
   - Update SECURITY_LOG.md
   - Notify instructors

---

## Backup & Recovery

### What to Back Up

**Critical Data:**
1. Progression state (Redis or JSON file)
2. User accounts database
3. Flag values (docker-compose.yml)
4. Platform configuration (.env)
5. Custom challenge content

**Non-Critical (Can Regenerate):**
- Docker images (can rebuild)
- Container logs (rotate regularly)
- Temporary session data

### Backup Procedures

**Daily Automated Backup:**

```bash
#!/bin/bash
# backup-yggdrasil.sh

BACKUP_DIR="/backups/yggdrasil/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# 1. Backup progression data
docker-compose exec flag-oracle redis-cli BGSAVE
docker cp yggdrasil-flag-oracle:/data/dump.rdb "$BACKUP_DIR/progression.rdb"

# 2. Backup user database (if applicable)
docker-compose exec asgard-db pg_dump -U postgres > "$BACKUP_DIR/users.sql"

# 3. Backup configuration
cp docker-compose.yml "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/.env.backup"

# 4. Create tarball
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

echo "Backup completed: $BACKUP_DIR.tar.gz"
```

**Schedule with cron:**
```bash
# Run daily at 2 AM
0 2 * * * /opt/yggdrasil/scripts/backup-yggdrasil.sh
```

### Recovery Procedures

**Full Platform Recovery:**

```bash
# 1. Stop all services
docker-compose down

# 2. Extract backup
tar -xzf /backups/yggdrasil/20251213.tar.gz

# 3. Restore configuration
cp 20251213/.env.backup .env
cp 20251213/docker-compose.yml .

# 4. Rebuild containers
docker-compose build

# 5. Start platform
docker-compose up -d

# 6. Restore progression data
docker cp 20251213/progression.rdb yggdrasil-flag-oracle:/data/dump.rdb
docker-compose restart flag-oracle

# 7. Restore user database
docker-compose exec -T asgard-db psql -U postgres < 20251213/users.sql

# 8. Verify recovery
docker-compose ps
curl http://localhost:3000/health
```

**Partial Recovery (Progression Only):**

```bash
# Restore only progression data
docker cp backup/progression.rdb yggdrasil-flag-oracle:/data/dump.rdb
docker-compose restart flag-oracle
```

---

## Performance Tuning

### Resource Allocation

**Docker Resource Limits:**

Edit `docker-compose.yml`:

```yaml
services:
  asgard:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

**Recommended Allocations:**
- Gatekeeper: 1 CPU, 1GB RAM
- Flag Oracle: 0.5 CPU, 512MB RAM
- Each Realm: 0.5 CPU, 512MB RAM (adjust based on complexity)
- Database: 1 CPU, 2GB RAM

### Scaling

**Horizontal Scaling (Multiple Students):**

```yaml
# docker-compose.yml
services:
  asgard:
    deploy:
      replicas: 3  # Run 3 instances of Asgard
```

**Load Balancing:**
- Use nginx or HAProxy in front of gatekeeper
- Configure session affinity (sticky sessions)
- Use Redis for shared session storage

### Caching

**Enable Response Caching:**

```typescript
// In gatekeeper
app.use('/static', express.static('public', {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));
```

**Cache Static Assets:**
```bash
# Use nginx to cache static resources
# nginx.conf
location /static {
    expires 1d;
    add_header Cache-Control "public, immutable";
}
```

---

## Incident Response

### Incident Classification

**P0 - Critical (Response: Immediate)**
- Platform completely down
- Data loss
- Security breach

**P1 - High (Response: < 1 hour)**
- Single realm down
- Flag validation failing
- Authentication broken

**P2 - Medium (Response: < 4 hours)**
- Slow performance
- Non-critical feature broken
- Minor progression issues

**P3 - Low (Response: Next business day)**
- Cosmetic issues
- Documentation errors
- Feature requests

### Response Procedures

**P0 Incident Example: Platform Down**

1. **Detect** (Monitoring alerts or user report)
2. **Assess:**
   ```bash
   docker-compose ps  # Check all services
   docker-compose logs --tail=100 | grep -i error
   ```
3. **Communicate:** Notify instructors/students
4. **Mitigate:**
   ```bash
   # Quick restart
   docker-compose restart
   
   # If that fails, full rebuild
   docker-compose down
   docker-compose up -d --build
   ```
5. **Resolve:** Fix root cause (disk space, config error, etc.)
6. **Verify:** Test all realms
7. **Document:** Create incident report

### Escalation Path

1. Platform Operator (you)
2. Platform Administrator
3. Development Team
4. Infrastructure Team

---

## Appendix

### Useful Scripts

Located in `scripts/` directory:

- `backup-yggdrasil.sh` - Automated backup
- `generate-flags.sh` - Generate new flag values
- `bulk-register-users.sh` - Register multiple users from CSV
- `health-check.sh` - Comprehensive health check
- `reset-platform.sh` - Complete platform reset

### Useful Commands Cheat Sheet

```bash
# Quick status check
docker-compose ps && docker-compose logs --tail=20

# Restart everything
docker-compose restart

# View resource usage
docker stats --no-stream

# Clean up old data
docker system prune -a

# Export all user progression
curl http://localhost:3000/api/admin/export-progression > progression-backup.json

# Import progression
curl -X POST http://localhost:3000/api/admin/import-progression -d @progression-backup.json
```

### Contact & Support

**Documentation:**
- Platform README: `/README.md`
- Developer Guide: `/CONTRIBUTING.md`
- Instructor Notes: `.docs/instructor/`

**Support Channels:**
- GitHub Issues: [repo-url]/issues
- Operator Slack: #yggdrasil-ops
- Emergency: [on-call-contact]

---

**End of Operator Guide**

This guide is maintained as part of Milestone 13 (Immersion & Final Polish). 
For updates or corrections, submit a PR to the documentation.
