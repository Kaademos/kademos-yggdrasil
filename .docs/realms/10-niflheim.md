# Realm 10: Niflheim
## A10:2025 - Exceptional Conditions

---

## Overview

**Realm Name:** Niflheim  
**Level:** 10 (First Realm)  
**OWASP Category:** A10:2025 - Exceptional Conditions  
**Tech Stack:** Node.js, Express, TypeScript  
**Difficulty:** Easy (Entry Point)

---

## Intended Vulnerability

Niflheim demonstrates **improper exception handling** that leads to security failures. The cryo-stasis pressure regulator system fails to handle "impossible" input values, triggering unhandled exceptions that reveal the flag.

### Vulnerability Concept

```
User Input → Validation Check → Exception Thrown
              (Incomplete)          ↓
                           Unhandled Exception
                                   ↓
                          Error State Reveals Flag
```

---

## Exploitation Path

### Attack Vector: Exceptional Input Values

**Vulnerable Endpoint:** `/realm/niflheim/regulate`

**Normal Operation:**
```javascript
// Expected input range: 0-1000 PSI
POST /regulate
{
  "pressure": 500
}

// Response: { status: "regulated", pressure: 500 }
```

**Attack:**
```javascript
// Impossible value triggers exception
POST /regulate
{
  "pressure": 999999
}

// Response: { error: "CRITICAL FAILURE", flag: "YGGDRASIL{...}" }
```

**Why This Works:**
1. Validation only checks for `typeof number`
2. No range validation for extreme values
3. Downstream code assumes "reasonable" values
4. Exception handler in error state reveals flag

---

## Code Locations

### Vulnerable Code Section

**Pressure Regulation Logic:**
```typescript
// realms/niflheim/src/routes/regulate.ts (INTENTIONALLY VULNERABLE)
router.post('/regulate', async (req, res) => {
  try {
    const { pressure } = req.body;
    
    // VULNERABILITY: Only type check, no range validation
    if (typeof pressure !== 'number') {
      return res.status(400).json({ error: 'Invalid pressure value' });
    }
    
    // Downstream calculation assumes reasonable values
    const coolingRate = calculateCoolingRate(pressure);
    const safetyMargin = THRESHOLD / pressure; // Division by extreme values
    
    if (safetyMargin < 0.001) {
      // VULNERABILITY: Exception reveals flag in error state
      throw new Error('CRITICAL_FAILURE');
    }
    
    res.json({ status: 'regulated', pressure, coolingRate });
    
  } catch (error) {
    // VULNERABILITY: Error handler exposes flag
    if (error.message === 'CRITICAL_FAILURE') {
      res.status(500).json({
        error: 'Critical system failure',
        state: 'door_unlocked',
        flag: process.env.FLAG
      });
    } else {
      res.status(500).json({ error: 'Internal error' });
    }
  }
});
```

**Location:**
- File: `realms/niflheim/src/routes/regulate.ts`
- Lines: 15-45 (regulation logic with incomplete validation)

---

## ASVS Deviations

### Intentionally Violated Controls

| ASVS Control | Requirement | Niflheim Implementation | Rationale |
|--------------|-------------|------------------------|-----------|
| V1.2.1 | Input validation | ❌ No range validation | Challenge vulnerability |
| V7.4.1 | Error handling | ❌ Errors reveal sensitive data | Challenge vulnerability |
| V7.4.3 | Exception management | ❌ Unhandled exceptions expose state | Challenge vulnerability |

### Compliant Areas (Non-Challenge Code)

| ASVS Control | Requirement | Niflheim Implementation | Location |
|--------------|-------------|------------------------|-----------|
| V3.4.5 | Security headers | ✅ Proper headers set | `src/middleware/headers.ts` |
| V14.5.1 | HTTP methods | ✅ Only POST allowed | `src/routes/regulate.ts:12` |
| V1.2.2 | Output encoding | ✅ JSON responses properly encoded | Throughout |

---

## Non-Challenge Code Compliance

### Secure Implementations

**Health Check (COMPLIANT):**
```typescript
// realms/niflheim/src/routes/health.ts (SECURE)
router.get('/health', (req, res) => {
  try {
    res.json({ status: 'healthy', realm: 'niflheim' });
  } catch (error) {
    // No details leaked in error
    res.status(500).json({ status: 'unhealthy' });
  }
});
```

**Configuration Loading (COMPLIANT):**
```typescript
// realms/niflheim/src/config/index.ts (SECURE)
export function loadConfig() {
  // Validates required env vars
  if (!process.env.FLAG) {
    throw new Error('FLAG environment variable required');
  }
  
  return {
    flag: process.env.FLAG,
    port: parseInt(process.env.PORT || '3000'),
    realm: 'niflheim'
  };
}
```

---

## Testing

### Automated Test

**Integration Test:** `scripts/test-niflheim.sh`

```bash
#!/bin/bash
set -e

echo "Testing Niflheim (Realm 10)..."

GATEKEEPER_URL="${GATEKEEPER_URL:-http://localhost:8080}"

# Test 1: Normal operation (should work)
echo "1. Testing normal operation..."
response=$(curl -s -X POST "$GATEKEEPER_URL/realm/niflheim/regulate" \
  -H "Content-Type: application/json" \
  -d '{"pressure": 500}')

if echo "$response" | grep -q '"status":"regulated"'; then
  echo "  ✅ Normal operation works"
else
  echo "  ❌ Normal operation failed"
  exit 1
fi

# Test 2: Exceptional condition (should reveal flag)
echo "2. Testing exceptional condition..."
response=$(curl -s -X POST "$GATEKEEPER_URL/realm/niflheim/regulate" \
  -H "Content-Type: application/json" \
  -d '{"pressure": 999999}')

if echo "$response" | grep -q "YGGDRASIL{NIFLHEIM:"; then
  flag=$(echo "$response" | grep -o "YGGDRASIL{NIFLHEIM:[a-f0-9-]\+}")
  echo "  ✅ Flag revealed: $flag"
  
  # Test 3: Flag submission
  echo "3. Testing flag submission..."
  submit_response=$(curl -s -X POST "$GATEKEEPER_URL/submit-flag" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"test-user\",\"flag\":\"$flag\"}")
  
  if echo "$submit_response" | grep -q '"status":"success"'; then
    echo "  ✅ Flag accepted"
  else
    echo "  ❌ Flag rejected"
    exit 1
  fi
else
  echo "  ❌ Flag not revealed"
  exit 1
fi

echo "✅ Niflheim tests complete"
```

### Manual Verification

**Prerequisites:**
- Platform running (`make up`)
- User logged in

**Steps:**

1. **Access Niflheim:**
   ```bash
   # First realm - should always be accessible
   curl http://localhost:8080/realm/niflheim/
   ```

2. **Test Normal Operation:**
   ```bash
   curl -X POST http://localhost:8080/realm/niflheim/regulate \
     -H "Content-Type: application/json" \
     -d '{"pressure": 500}'
   
   # Expected: {"status":"regulated","pressure":500,"coolingRate":...}
   ```

3. **Trigger Exception:**
   ```bash
   curl -X POST http://localhost:8080/realm/niflheim/regulate \
     -H "Content-Type: application/json" \
     -d '{"pressure": 999999}'
   
   # Expected: {"error":"Critical system failure","state":"door_unlocked","flag":"YGGDRASIL{...}"}
   ```

4. **Extract Flag:**
   ```bash
   # Parse flag from response
   echo '{"error":"...","flag":"YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}"}' \
     | grep -o "YGGDRASIL{NIFLHEIM:[a-f0-9-]\+}"
   ```

5. **Submit Flag:**
   ```bash
   curl -X POST http://localhost:8080/submit-flag \
     -H "Content-Type: application/json" \
     -d '{"userId":"test-user","flag":"YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}"}'
   ```

---

## UI Flow

### Visual Representation

```
┌─────────────────────────────────────┐
│     Niflheim Cryo-Stasis Control    │
│            ❄️ FROZEN REALM ❄️       │
├─────────────────────────────────────┤
│                                     │
│  Pressure Regulator                 │
│  ┌───────────────────────────┐     │
│  │ Pressure (PSI): [____500_]│     │
│  └───────────────────────────┘     │
│                                     │
│  [ Regulate Pressure ]              │
│                                     │
│  Status: Nominal                    │
│  Temperature: -273°C                │
│                                     │
└─────────────────────────────────────┘

# After inputting 999999:

┌─────────────────────────────────────┐
│     Niflheim Cryo-Stasis Control    │
│            ⚠️ CRITICAL ERROR ⚠️      │
├─────────────────────────────────────┤
│                                     │
│  ⚠️ CRITICAL SYSTEM FAILURE         │
│                                     │
│  Pressure regulators offline        │
│  Safety protocols breached          │
│  Emergency door UNLOCKED            │
│                                     │
│  System Diagnostic Code:            │
│  YGGDRASIL{NIFLHEIM:ba6cd20a...}   │
│                                     │
└─────────────────────────────────────┘
```

---

## Educational Value

### Learning Objectives

1. **Input Validation:**
   - Type checking alone is insufficient
   - Must validate ranges and constraints
   - Consider edge cases and extreme values

2. **Exception Handling:**
   - Never reveal sensitive data in exceptions
   - Catch and handle exceptions appropriately
   - Generic error messages for users

3. **Fail-Safe Design:**
   - Systems should fail securely
   - Error states should not reveal secrets
   - Consider "impossible" inputs in design

### Remediation Example

**Secure Implementation:**
```typescript
router.post('/regulate', async (req, res) => {
  try {
    const { pressure } = req.body;
    
    // Proper validation with range check
    if (typeof pressure !== 'number' || pressure < 0 || pressure > 1000) {
      return res.status(400).json({ 
        error: 'Invalid pressure value',
        hint: 'Pressure must be between 0 and 1000 PSI'
      });
    }
    
    const coolingRate = calculateCoolingRate(pressure);
    const safetyMargin = THRESHOLD / pressure;
    
    if (safetyMargin < 0.001) {
      // Log error internally, generic message to user
      logger.error('Pressure safety threshold breached', { pressure });
      return res.status(400).json({ 
        error: 'Pressure value exceeds safety limits' 
      });
    }
    
    res.json({ status: 'regulated', pressure, coolingRate });
    
  } catch (error) {
    // Generic error, log details internally
    logger.error('Regulation error', { error: error.message });
    res.status(500).json({ error: 'Internal error' });
  }
});
```

---

## Environment Variables

```bash
# .env
NIFLHEIM_FLAG=YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}
```

---

## Notes for Maintainers

### DO NOT "Fix" These Vulnerabilities

The following are **intentional** and must remain:
- No range validation on pressure input
- Exception revealing flag in error state
- "door_unlocked" state on critical failure

### Safe to Modify

- UI styling and theme
- Health check endpoint
- Configuration loading
- Non-challenge endpoints
- Logging (non-flag-revealing paths)

### When Making Changes

1. Re-run integration test: `./scripts/test-niflheim.sh`
2. Verify exception still reveals flag
3. Test with extreme values (999999, -999999, 0.00001)
4. Ensure flag format matches regex
5. Update this documentation if behavior changes

---

## References

- [OWASP A10:2025 - Exceptional Conditions](https://owasp.org/Top10/)
- [CWE-755: Improper Handling of Exceptional Conditions](https://cwe.mitre.org/data/definitions/755.html)
- [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)

---

**Last Updated:** 2025-12-11  
**Maintained By:** Platform Team
