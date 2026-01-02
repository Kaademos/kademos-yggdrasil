# Vanaheim - Realm 4

**OWASP Category:** A04:2025 - Cryptographic Failures  
**Vulnerability:** Predictable PRNG-based Token Generation  
**Difficulty:** Medium  
**Tech Stack:** Node.js, Express, TypeScript

---

## Overview

Vanaheim is the merchant realm of the Vanir gods, a place of trade and prosperity. The realm's authentication system uses time-based tokens generated through a weak Pseudo-Random Number Generator (PRNG). This vulnerability allows attackers to analyze token patterns and predict future tokens to gain unauthorized admin access.

---

## Vulnerability Description

### The Flaw

The token generation service uses a **Linear Congruential Generator (LCG)** - a simple and predictable PRNG algorithm. The seed for token generation is calculated as:

```typescript
seed = timestamp + (userId_numeric * multiplier)
```

Key vulnerabilities:
1. **Predictable Seed**: Uses `Date.now()` which is publicly observable
2. **Weak PRNG**: LCG algorithm with known parameters (a=1103515245, c=12345, m=2^31)
3. **Information Leakage**: Token history API exposes timestamps AND seeds
4. **Pattern Analysis**: Sequential tokens reveal the mathematical formula

### Real-World Context

**Similar Vulnerabilities:**
- **Debian OpenSSL Bug (2008)**: Weak random number generation affected SSL keys
- **DUAL_EC_DRBG Backdoor**: NSA-compromised RNG in cryptographic standards
- **Weak JWT Secrets**: Predictable or brute-forceable signing keys

**OWASP A04:2025 - Cryptographic Failures:**
- Use of broken or risky cryptographic algorithms
- Insufficient entropy in random number generation
- Improper key generation or management
- Predictable cryptographic parameters

---

## Exploitation Walkthrough

### Step 1: Reconnaissance

Visit the Vanaheim UI and observe the token generation system:
```
http://localhost:8080/realms/vanaheim/
```

### Step 2: Generate Sample Tokens

Generate 3-5 tokens with different user IDs:
```bash
curl -X POST http://localhost:8080/realms/vanaheim/api/generate-token \
  -H "Content-Type: application/json" \
  -d '{"userId": "merchant1"}'
```

Response:
```json
{
  "success": true,
  "token": {
    "value": "VAN-A1B2C3D4E5F60123",
    "userId": "merchant1",
    "timestamp": 1733932800000
  }
}
```

### Step 3: Analyze Token History

Fetch the token history which **exposes seeds** (critical vulnerability):
```bash
curl http://localhost:8080/realms/vanaheim/api/token-history
```

Response reveals:
```json
{
  "success": true,
  "tokens": [
    {
      "value": "VAN-...",
      "userId": "merchant1",
      "timestamp": 1733932800000,
      "seed": 1733933800000  ← EXPOSED SEED!
    }
  ]
}
```

### Step 4: Understand the Pattern

From the history, observe:
- Token values follow a predictable sequence
- Seeds = timestamp + (userId_value * 1000)
- LCG formula is deterministic with known parameters

### Step 5: Predict Next Token

**Simplified Approach**: Generate a fresh token immediately (it will be valid):
```bash
curl -X POST http://localhost:8080/realms/vanaheim/api/generate-token \
  -H "Content-Type: application/json" \
  -d '{"userId": "admin"}'
```

**Advanced Approach**: Calculate expected token value based on:
1. Current timestamp
2. Known LCG parameters
3. Reverse-engineer the formula

### Step 6: Authenticate

Use the predicted/generated token to authenticate:
```bash
curl -X POST http://localhost:8080/realms/vanaheim/api/admin-login \
  -H "Content-Type: application/json" \
  -d '{"token": "VAN-A1B2C3D4E5F60123"}'
```

Success response:
```json
{
  "success": true,
  "user": { "userId": "admin", "role": "admin" },
  "sessionToken": "VAN-A1B2C3D4E5F60123"
}
```

### Step 7: Access Vault

Use the session token to access the vault:
```bash
curl http://localhost:8080/realms/vanaheim/api/vault \
  -H "Authorization: Bearer VAN-A1B2C3D4E5F60123"
```

### Step 8: Retrieve Flag

The vault response contains the realm flag:
```json
{
  "success": true,
  "vault": {
    "realm": "Vanaheim",
    "flag": "YGGDRASIL{VANAHEIM:72dfb48c-b67c-445b-a901-2f09c70f6210}"
  }
}
```

---

## Automated Testing

Run the integration test script:
```bash
./scripts/test-vanaheim.sh
```

This script automates the entire exploit chain.

---

## Mitigation Strategies

### Proper Implementation

**Use Cryptographically Secure RNG:**
```typescript
import { randomBytes } from 'crypto';

function generateSecureToken(): string {
  // Use crypto.randomBytes for cryptographic randomness
  const bytes = randomBytes(16);
  return bytes.toString('hex');
}
```

**Key Principles:**
1. **Use crypto.randomBytes() or equivalent** (not Math.random())
2. **Never expose internal state** (seeds, timestamps, algorithms)
3. **Use sufficient entropy** (at least 128 bits for tokens)
4. **Implement token expiration** (short-lived tokens)
5. **Rate limit generation** (prevent pattern analysis)

**OWASP Recommendations:**
- Use OS-provided CSPRNGs (Cryptographically Secure PRNGs)
- Avoid custom cryptography implementations
- Regular security audits of random number generation
- Monitor for unusual token generation patterns

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Internal container port |
| `FLAG` | - | Realm flag (required) |
| `REALM_NAME` | `vanaheim` | Realm identifier |
| `NODE_ENV` | `development` | Environment mode |
| `TOKEN_SEED_MULTIPLIER` | `1000` | PRNG seed multiplier |
| `MAX_TOKEN_HISTORY` | `50` | Maximum tokens in history |

---

## Development

### Install Dependencies
```bash
npm install
```

### Run in Development Mode
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Run Tests
```bash
npm test
npm run test:coverage
```

### Lint
```bash
npm run lint
npm run lint:fix
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/generate-token` | Generate token for userId |
| `GET` | `/api/token-history` | Get token history (VULNERABLE) |
| `POST` | `/api/admin-login` | Authenticate with token |
| `GET` | `/api/vault` | Access vault (requires auth) |
| `GET` | `/api/stats` | Realm statistics |

---

## Key Takeaways

**For Learners:**
- Never use Math.random() or simple LCG for security purposes
- Cryptographic operations require cryptographically secure randomness
- Information leakage (like seed exposure) can completely break security
- Time-based seeds are predictable and unsuitable for security

**For Developers:**
- Always use crypto.randomBytes() or equivalent in production
- Never expose internal cryptographic state or parameters
- Implement proper token lifecycle management (expiration, rotation)
- Regular security code reviews focused on crypto usage

---

## References

- [OWASP A04:2025 - Cryptographic Failures](https://owasp.org/Top10/A04_2021-Insecure_Design/)
- [Debian OpenSSL Vulnerability](https://www.debian.org/security/2008/dsa-1571)
- [NIST SP 800-90A - RNG Recommendations](https://csrc.nist.gov/publications/detail/sp/800-90a/rev-1/final)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)

---

