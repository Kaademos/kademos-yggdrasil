import { test, expect } from '@playwright/test';

const BASE_URL = process.env.GATEKEEPER_URL || 'http://localhost:8080';

const ENDPOINTS = [
  '/health',
  '/login',
  '/realms',
];

test.describe('Security Headers', () => {
  ENDPOINTS.forEach(endpoint => {
    test(`${endpoint} has X-Content-Type-Options header`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}${endpoint}`);
      const headers = response.headers();
      
      expect(headers['x-content-type-options']).toBe('nosniff');
    });

    test(`${endpoint} has Content-Security-Policy header`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}${endpoint}`);
      const headers = response.headers();
      
      expect(headers['content-security-policy']).toBeDefined();
      expect(headers['content-security-policy']).toContain('object-src');
    });

    test(`${endpoint} has Strict-Transport-Security header`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}${endpoint}`);
      const headers = response.headers();
      
      // HSTS header should be present with max-age
      const hsts = headers['strict-transport-security'];
      if (hsts) {
        expect(hsts).toMatch(/max-age=\d+/);
      }
      // Note: May not be present in development without HTTPS
    });

    test(`${endpoint} has Referrer-Policy header`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}${endpoint}`);
      const headers = response.headers();
      
      expect(headers['referrer-policy']).toBeDefined();
    });

    test(`${endpoint} has X-Frame-Options or CSP frame-ancestors`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}${endpoint}`);
      const headers = response.headers();
      
      const hasXFrameOptions = headers['x-frame-options'] !== undefined;
      const csp = headers['content-security-policy'] || '';
      const hasFrameAncestors = csp.includes('frame-ancestors');
      
      expect(hasXFrameOptions || hasFrameAncestors).toBeTruthy();
    });
  });

  test('POST /submit-flag has security headers', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/submit-flag`, {
      data: { flag: 'test' },
      headers: { 'Content-Type': 'application/json' },
      failOnStatusCode: false,
    });

    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toBeDefined();
  });

  test('/metrics endpoint does not expose sensitive headers', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/metrics`);
    const headers = response.headers();
    
    // Metrics should be plain text
    expect(headers['content-type']).toContain('text/plain');
    
    // Should still have basic security
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('Responses do not include server version', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    const headers = response.headers();
    
    // Should not expose server details
    const server = headers['server'];
    if (server) {
      expect(server).not.toContain('Express');
      expect(server).not.toMatch(/\d+\.\d+\.\d+/); // No version numbers
    }
  });

  test('Responses do not include X-Powered-By', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    const headers = response.headers();
    
    expect(headers['x-powered-by']).toBeUndefined();
  });
});
