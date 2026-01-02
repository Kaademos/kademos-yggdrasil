# Gatekeeper Error Handling Guide

**M13: Immersion & Final Polish - Phase 4**

## Overview

The Yggdrasil Gatekeeper provides specialized error pages for progression-related issues that are unique to the gatekeeper's role as the platform's access control layer.

---

## Error Pages

### 1. Realm Locked (403 Progression Block)

**File:** `public/templates/error-realm-locked.html`

**When to use:**
- User tries to access a realm they haven't unlocked yet
- Progression check fails (missing required flags)
- User hasn't completed prerequisite realms

**Features:**
- Shows locked realm name
- Displays user's current progression level
- Explains the progression system
- Links to available realms and progress page

**Example integration:**
```typescript
// In gatekeeper proxy middleware
if (userLevel < requiredLevel) {
  return res.status(403).sendFile(
    path.join(__dirname, 'public/templates/error-realm-locked.html')
      .replace('{REALM_NAME}', realmName)
      .replace('{USER_LEVEL}', String(userLevel))
  );
}
```

---

### 2. Session Expired (401)

**File:** `public/templates/error-session-expired.html`

**When to use:**
- Session cookie is invalid or expired
- User has been inactive for 30+ minutes
- Session was invalidated server-side

**Features:**
- Clear explanation of why session expired
- Login redirect button
- Reassurance that progress is saved

**Example integration:**
```typescript
// In session validation middleware
if (!session || session.expired) {
  return res.status(401).sendFile(
    path.join(__dirname, 'public/templates/error-session-expired.html')
  );
}
```

---

### 3. Service Unavailable (503)

**File:** `public/templates/error-service-unavailable.html`

**When to use:**
- Target realm service is down
- Docker container not responding
- Network issue between gatekeeper and realm

**Features:**
- Shows which realm is unavailable
- Lists possible causes
- Auto-retry after 10 seconds
- Manual retry button

**Example integration:**
```typescript
// In proxy error handler
proxyReq.on('error', (err) => {
  return res.status(503).sendFile(
    path.join(__dirname, 'public/templates/error-service-unavailable.html')
      .replace('{REALM_NAME}', realmName)
  );
});
```

---

## Integration with Gatekeeper Middleware

### Current Gatekeeper Structure

```typescript
// Typical gatekeeper flow
app.use('/realm/:realmName', async (req, res, next) => {
  // 1. Validate session
  const session = await validateSession(req);
  if (!session) {
    // Return session-expired.html
  }
  
  // 2. Check progression
  const userLevel = await getProgression(session.userId);
  const realmLevel = REALM_LEVELS[req.params.realmName];
  if (userLevel < realmLevel) {
    // Return realm-locked.html
  }
  
  // 3. Proxy to realm
  try {
    await proxyToRealm(req, res, req.params.realmName);
  } catch (err) {
    // Return service-unavailable.html
  }
});
```

### Error Priority

1. **Session validation (401)** - Check first
2. **Progression check (403)** - Check second
3. **Service availability (503)** - Check during proxy
4. **Other errors (500)** - Catch-all

---

## Template Customization

All gatekeeper error templates support placeholders:

- `{REALM_NAME}` - Name of the target realm
- `{USER_LEVEL}` - User's current progression level (for locked page)
- `{ERROR_MESSAGE}` - Custom error message (optional)

**Example:**
```typescript
let html = fs.readFileSync('error-realm-locked.html', 'utf-8');
html = html.replace('{REALM_NAME}', 'Muspelheim');
html = html.replace('{USER_LEVEL}', '3');
res.status(403).send(html);
```

---

## Testing

### Manual Testing

```bash
# Test locked realm
curl -H "Cookie: session=invalid" \
  http://localhost:3000/realm/helheim

# Test session expired
curl -H "Cookie: session=expired" \
  http://localhost:3000/realm/asgard

# Test service unavailable (stop a realm container first)
docker stop yggdrasil-niflheim
curl http://localhost:3000/realm/niflheim
```

### Automated Testing

```typescript
describe('Gatekeeper Error Pages', () => {
  it('should show realm locked page for insufficient progression', async () => {
    const res = await request(app)
      .get('/realm/helheim')
      .set('Cookie', 'session=level1_session');
    
    expect(res.status).toBe(403);
    expect(res.text).toContain('Realm Locked');
    expect(res.text).toContain('Helheim');
  });

  it('should show session expired page for invalid session', async () => {
    const res = await request(app)
      .get('/realm/asgard')
      .set('Cookie', 'session=invalid');
    
    expect(res.status).toBe(401);
    expect(res.text).toContain('Session Expired');
  });
});
```

---

## Styling

All gatekeeper error pages use inline CSS (no external stylesheets) to ensure they always display correctly even if:
- The realm's CSS is unavailable
- The shared styles fail to load
- There are routing issues

The styling matches the Yggdrasil brand with:
- Dark gradient backgrounds (#1a1a2e → #16213e)
- Gold accents (#FFD700) for progression/success
- Red accents (#ff6b6b) for errors/warnings
- Blue accents (#6464c8) for info/secondary actions

---

## Accessibility

All pages include:
- ✅ ARIA roles and labels
- ✅ Semantic HTML structure
- ✅ High contrast ratios (WCAG AA)
- ✅ Keyboard navigation support
- ✅ Screen reader compatible
- ✅ Mobile responsive (< 600px breakpoints)

---

## Logging

When serving error pages, the gatekeeper should log:

```typescript
console.error('[Gatekeeper] Error served', {
  errorType: 'realm-locked',
  realmName: 'Helheim',
  userId: session?.userId,
  userLevel: userLevel,
  requiredLevel: realmLevel,
  timestamp: new Date().toISOString(),
});
```

This helps with:
- Debugging progression issues
- Identifying misconfigured realms
- Tracking service availability
- User experience monitoring

---

## Best Practices

### DO:
✅ Check session before checking progression  
✅ Log all error page serves  
✅ Provide clear next steps for users  
✅ Include links back to available content  
✅ Auto-retry for service unavailable errors

### DON'T:
❌ Expose internal service names or ports  
❌ Show stack traces or debug info  
❌ Hard-code realm levels in templates  
❌ Block legitimate users due to race conditions  
❌ Forget to validate realm names (prevent injection)

---

## Migration Checklist

To integrate gatekeeper error handling:

- [ ] Add error page templates to `gatekeeper/public/templates/`
- [ ] Update session validation to use `error-session-expired.html`
- [ ] Update progression check to use `error-realm-locked.html`
- [ ] Update proxy error handler to use `error-service-unavailable.html`
- [ ] Add logging for all error page serves
- [ ] Test all three error scenarios
- [ ] Update gatekeeper tests to verify error pages
- [ ] Document any realm-specific progression rules

---

## Files

```
gatekeeper/
├── public/
│   └── templates/
│       ├── error-realm-locked.html        # 403 Progression block
│       ├── error-session-expired.html     # 401 Session invalid
│       └── error-service-unavailable.html # 503 Realm down
└── GATEKEEPER-ERROR-HANDLING.md           # This file
```

---

## Support

For questions or issues:
1. Check this guide
2. Review `realms/_shared/ERROR-HANDLING-README.md`
3. Review `.docs/milestones/M13-PROGRESS.md`
4. Check gatekeeper logs for error details

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-13  
**M13 Phase:** 4 (Gatekeeper Error Handling)
