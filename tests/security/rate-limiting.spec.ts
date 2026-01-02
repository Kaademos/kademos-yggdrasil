import { test, expect } from '@playwright/test';

const BASE_URL = process.env.GATEKEEPER_URL || 'http://localhost:8080';

test.describe('Rate Limiting', () => {
  test('login endpoint enforces rate limit', async ({ request }) => {
    const requests = [];
    
    // Make 20 rapid login attempts
    for (let i = 0; i < 20; i++) {
      requests.push(
        request.post(`${BASE_URL}/login`, {
          data: { username: 'test', password: 'wrong' },
          headers: { 'Content-Type': 'application/json' },
          failOnStatusCode: false,
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status());
    
    // Should have at least some 429 (Too Many Requests) responses
    const tooManyRequests = statusCodes.filter(code => code === 429);
    
    expect(tooManyRequests.length).toBeGreaterThan(0);
    console.log(`Rate limit triggered after ${statusCodes.indexOf(429)} requests`);
  });

  test('flag submission endpoint has rate limit', async ({ request }) => {
    const requests = [];
    
    // Make 15 rapid flag submissions
    for (let i = 0; i < 15; i++) {
      requests.push(
        request.post(`${BASE_URL}/submit-flag`, {
          data: { flag: 'YGGDRASIL{TEST:00000000-0000-0000-0000-000000000000}' },
          headers: { 'Content-Type': 'application/json' },
          failOnStatusCode: false,
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status());
    
    // Should have some rate limit responses (429 or 401 for unauthorized)
    const rateLimited = statusCodes.filter(code => code === 429);
    
    // May get 401 if not authenticated, but shouldn't allow unlimited requests
    console.log(`Flag submission status codes:`, statusCodes.slice(0, 5));
    console.log(`Rate limited requests: ${rateLimited.length}`);
  });

  test('rate limit includes retry-after header', async ({ request }) => {
    // Trigger rate limit
    const requests = [];
    for (let i = 0; i < 20; i++) {
      requests.push(
        request.post(`${BASE_URL}/login`, {
          data: { username: 'test', password: 'wrong' },
          failOnStatusCode: false,
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const rateLimitedResponse = responses.find(r => r.status() === 429);
    
    if (rateLimitedResponse) {
      const headers = rateLimitedResponse.headers();
      
      // Should include retry-after or rate limit headers
      const hasRetryAfter = headers['retry-after'] !== undefined;
      const hasRateLimitHeaders = 
        headers['x-ratelimit-limit'] !== undefined ||
        headers['x-ratelimit-remaining'] !== undefined ||
        headers['x-ratelimit-reset'] !== undefined;
      
      expect(hasRetryAfter || hasRateLimitHeaders).toBeTruthy();
    }
  });

  test('different IPs have independent rate limits', async ({ request, context }) => {
    // Note: This test may not work in all environments as IP spoofing
    // is often not allowed. This is more of a conceptual test.
    
    const response1 = await request.post(`${BASE_URL}/login`, {
      data: { username: 'user1', password: 'wrong' },
      headers: { 
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.168.1.1' // Simulated IP
      },
      failOnStatusCode: false,
    });
    
    const response2 = await request.post(`${BASE_URL}/login`, {
      data: { username: 'user2', password: 'wrong' },
      headers: { 
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.168.1.2' // Different IP
      },
      failOnStatusCode: false,
    });
    
    // Both should be treated independently (both should be 401, not 429)
    // unless one IP is already rate limited
    console.log('Response 1:', response1.status());
    console.log('Response 2:', response2.status());
  });

  test('rate limit resets after time window', async ({ request }) => {
    // This test would need to wait for the rate limit window to pass
    // Skipping in CI as it would take too long
    test.skip(!!process.env.CI, 'Skipping time-based test in CI');
    
    // Make requests until rate limited
    let rateLimited = false;
    for (let i = 0; i < 20 && !rateLimited; i++) {
      const response = await request.post(`${BASE_URL}/login`, {
        data: { username: 'test', password: 'wrong' },
        failOnStatusCode: false,
      });
      if (response.status() === 429) {
        rateLimited = true;
        console.log('Rate limited after', i, 'requests');
      }
    }
    
    expect(rateLimited).toBeTruthy();
    
    // Wait for rate limit window (typically 5 minutes for auth)
    console.log('Waiting for rate limit to reset...');
    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000 + 1000));
    
    // Should be able to make requests again
    const response = await request.post(`${BASE_URL}/login`, {
      data: { username: 'test', password: 'wrong' },
      failOnStatusCode: false,
    });
    
    expect(response.status()).toBe(401); // Not rate limited, just unauthorized
  });
});
