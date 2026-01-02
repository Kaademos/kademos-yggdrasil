# Yggdrasil Error Handling System

**M13: Immersion & Final Polish**

## Overview

This directory contains the shared error handling infrastructure for all Yggdrasil realms. It provides:
- Consistent error pages across the platform
- Branded error experiences per realm
- Preservation of intentional vulnerability leaks
- Generic error handling for non-challenge errors

---

## Architecture

### Components

**1. Middleware (`middleware/error-handler.ts`)**
- TypeScript error handling middleware for Express
- Distinguishes between intentional (challenge) and generic errors
- Provides branded error pages
- Logs errors for debugging

**2. Templates (`templates/error-*.html`)**
- 5 base error page templates
- Use placeholders for realm customization
- Styled using shared CSS + realm-specific themes

**3. Shared CSS (`styles/error-pages.css`)**
- Base styling for all error pages
- Realm-specific overrides via CSS variables

---

## Usage

### Basic Integration (Node.js/Express Realms)

```typescript
import express from 'express';
import { createErrorHandler, create404Handler } from '../_shared/middleware/error-handler';

const app = express();

// ... your routes ...

// 404 handler (must be after all routes)
app.use(create404Handler('RealmName', 'realm-theme'));

// Error handler (must be last)
app.use(createErrorHandler({
  realmName: 'RealmName',
  realmTheme: 'realm-theme',
  logErrors: true,
  intentionalLeakPatterns: [
    /CRASH/i,           // Example: Niflheim crash reports
    /PATH_TRAVERSAL/i,  // Example: Helheim LFI
  ],
}));
```

### Preserving Intentional Vulnerabilities

#### Method 1: Mark errors as intentional

```typescript
import { createIntentionalError } from '../_shared/middleware/error-handler';

// VULNERABLE: This error intentionally leaks information
throw createIntentionalError(
  'System crash detected',
  {
    crashReportId: crashId,
    downloadUrl: `/api/crash-report/${crashId}`
  },
  500
);
```

#### Method 2: Use patterns

```typescript
// In error handler config
intentionalLeakPatterns: [
  /CRASH/i,
  /SQL/i,
  /SSRF/i,
]

// In your code - error will be detected as intentional
throw new Error('SQL error: invalid syntax near...');
```

---

## Per-Realm Integration Guide

### Niflheim (Crash Reports)

```typescript
// Preserve crash report generation
throw createIntentionalError(
  'CRITICAL_SYSTEM_FAILURE',
  {
    crashReportId: id,
    downloadUrl: `/api/crash-report/${id}`
  }
);
```

### Helheim (LFI)

```typescript
// Preserve path traversal hints
// Use generic 404 for non-existent files
// Let LFI work as intended
if (!fs.existsSync(filePath)) {
  throw new Error('File not found'); // Generic 404
}
// Intentional leak happens in successful response, not error
```

### Asgard (SQLi)

```typescript
// Preserve boolean-blind SQLi feedback
// Different responses for true/false conditions
// Errors should be generic
if (sqlError) {
  throw new Error('Database error'); // Generic 500
}
```

### Jotunheim (Session Fixation)

```typescript
// No special error handling needed
// Vulnerability is in session management, not errors
```

### Muspelheim (Race Condition)

```typescript
// Generic errors for business logic
throw new Error('Transaction failed'); // Generic 500
```

### Nidavellir (SQLi)

```typescript
// Generic errors for SQL failures
// Vulnerability is in query construction, not error handling
```

### Vanaheim (Weak PRNG)

```typescript
// Generic errors
// Vulnerability is in token generation, not errors
```

### Midgard (Supply Chain)

```typescript
// Show build errors (intentional for challenge)
throw createIntentionalError(
  'Build failed',
  { logs: buildLogs, packages: installedPackages }
);
```

### Alfheim (SSRF/IMDS)

```typescript
// Generic errors for proxy failures
// Vulnerability is in URL validation, not errors
```

### Svartalfheim (Deserialization)

```typescript
// Generic errors for deserialization failures
// Vulnerability is in deserialize call, not errors
```

---

## Error Types

### 404 - Not Found
- **Use:** Resource doesn't exist
- **Generic:** No internal path information
- **Realm flavor:** "{REALM_NAME} realm" context

### 500 - Internal Server Error
- **Use:** Unexpected errors
- **Generic:** No stack traces or internal details
- **Critical:** Intentional challenge errors must bypass this

### 403 - Forbidden
- **Use:** Permission denied
- **Note:** Mainly used by gatekeeper for locked realms

### 401 - Unauthorized
- **Use:** Authentication required
- **Links:** Login page

### 429 - Too Many Requests
- **Use:** Rate limiting
- **Features:** Countdown timer

---

## Template Customization

Templates use placeholders:
- `{REALM_NAME}` - Realm name (e.g., "Niflheim")
- `{REALM_THEME}` - Theme identifier (e.g., "niflheim")
- `{ERROR_CODE}` - HTTP status code

Templates automatically load:
1. Shared theme variables (`/_shared/styles/theme-variables.css`)
2. Shared error styles (`/_shared/styles/error-pages.css`)
3. Realm-specific theme (`/css/theme.css`)

This ensures error pages match each realm's visual identity.

---

## Testing Error Handling

### Manual Testing

```bash
# Test 404
curl http://localhost:3000/nonexistent

# Test 500 (trigger intentional error in your realm)
curl http://localhost:3000/api/crash-endpoint

# Test error page rendering
# Visit in browser to see styled page
```

### Automated Testing

```typescript
// Example test
describe('Error Handling', () => {
  it('should return branded 404 page', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Not Found');
    expect(res.text).toContain('data-realm="realmname"');
  });

  it('should preserve intentional leaks', async () => {
    const res = await request(app).post('/api/trigger-crash');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('crashReportId');
  });
});
```

---

## Best Practices

### DO:
✅ Use generic error messages for non-challenge errors  
✅ Preserve intentional leaks for educational vulnerabilities  
✅ Log all errors for debugging (not shown to users)  
✅ Use branded error pages consistently  
✅ Test both generic and intentional error paths

### DON'T:
❌ Expose stack traces in generic errors  
❌ Leak internal paths or system details  
❌ Fix intentional vulnerabilities  
❌ Mix challenge and non-challenge error handling  
❌ Hard-code realm names in shared middleware

---

## Troubleshooting

**Error pages not styled:**
- Check that CSS files are properly served
- Verify `data-realm` attribute matches realm name
- Check browser console for CSS 404s

**Intentional leaks not working:**
- Verify error is marked with `isIntentional: true`
- Or check pattern matching in config
- Check logs to see if error handler is catching it

**404 handler not working:**
- Ensure it's registered AFTER all routes
- Ensure error handler is registered LAST

---

## Migration Guide

### From Inline Error Handling

**Before:**
```typescript
app.get('/api/data', (req, res) => {
  if (!found) {
    return res.status(404).send('Not found');
  }
});
```

**After:**
```typescript
app.get('/api/data', (req, res, next) => {
  if (!found) {
    const err = new Error('Resource not found');
    (err as any).statusCode = 404;
    return next(err);
  }
});
```

### From JSON Errors

**Before:**
```typescript
res.status(500).json({ error: 'Something broke' });
```

**After:**
```typescript
// For generic errors
throw new Error('Something broke');

// For intentional leaks
throw createIntentionalError(
  'Something broke',
  { details: '...' }
);
```

---

## Files Structure

```
realms/_shared/
├── middleware/
│   └── error-handler.ts      # Main error handling middleware
├── templates/
│   ├── error-404.html         # Not Found
│   ├── error-500.html         # Internal Server Error
│   ├── error-403.html         # Forbidden
│   ├── error-401.html         # Unauthorized
│   └── error-429.html         # Too Many Requests
├── styles/
│   ├── error-pages.css        # Error page base styles
│   ├── theme-variables.css    # Shared variables
│   └── ...                    # Other shared styles
└── ERROR-HANDLING-README.md   # This file
```

---

## Support

For questions or issues:
1. Check this README
2. Review `/docs/milestones/M13-IMPLEMENTATION.md`
3. Examine example integrations in existing realms
4. Check AGENTS.md for project conventions

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-13  
**M13 Phase:** 3 (Error Handling System)
