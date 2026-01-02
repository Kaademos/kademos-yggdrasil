import { AuthRateLimiter } from '../src/services/auth-rate-limiter';

describe('AuthRateLimiter', () => {
  let rateLimiter: AuthRateLimiter;

  beforeEach(() => {
    rateLimiter = new AuthRateLimiter(1000, 3); // 3 requests per 1 second window
  });

  afterEach(() => {
    rateLimiter.clear();
  });

  describe('checkLimit', () => {
    it('should allow requests within limit', () => {
      const result1 = rateLimiter.checkLimit('test-key');
      expect(result1.allowed).toBe(true);

      const result2 = rateLimiter.checkLimit('test-key');
      expect(result2.allowed).toBe(true);

      const result3 = rateLimiter.checkLimit('test-key');
      expect(result3.allowed).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      // Use up the limit
      rateLimiter.checkLimit('test-key');
      rateLimiter.checkLimit('test-key');
      rateLimiter.checkLimit('test-key');

      // This should be blocked
      const result = rateLimiter.checkLimit('test-key');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should track different keys independently', () => {
      // Use up limit for key1
      rateLimiter.checkLimit('key1');
      rateLimiter.checkLimit('key1');
      rateLimiter.checkLimit('key1');

      const result1 = rateLimiter.checkLimit('key1');
      expect(result1.allowed).toBe(false);

      // key2 should still be allowed
      const result2 = rateLimiter.checkLimit('key2');
      expect(result2.allowed).toBe(true);
    });

    it('should calculate correct retryAfter time', () => {
      rateLimiter.checkLimit('test-key');
      rateLimiter.checkLimit('test-key');
      rateLimiter.checkLimit('test-key');

      const result = rateLimiter.checkLimit('test-key');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThanOrEqual(0);
      expect(result.retryAfter).toBeLessThanOrEqual(2); // Within window duration
    });

    it('should allow requests after window expires', async () => {
      const shortWindowLimiter = new AuthRateLimiter(100, 2); // 100ms window

      shortWindowLimiter.checkLimit('test-key');
      shortWindowLimiter.checkLimit('test-key');

      const blockedResult = shortWindowLimiter.checkLimit('test-key');
      expect(blockedResult.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const allowedResult = shortWindowLimiter.checkLimit('test-key');
      expect(allowedResult.allowed).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset attempts for a key', () => {
      rateLimiter.checkLimit('test-key');
      rateLimiter.checkLimit('test-key');
      rateLimiter.checkLimit('test-key');

      const blockedResult = rateLimiter.checkLimit('test-key');
      expect(blockedResult.allowed).toBe(false);

      rateLimiter.reset('test-key');

      const allowedResult = rateLimiter.checkLimit('test-key');
      expect(allowedResult.allowed).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove old entries', async () => {
      const shortWindowLimiter = new AuthRateLimiter(100, 5);

      shortWindowLimiter.checkLimit('key1');
      shortWindowLimiter.checkLimit('key2');

      // Wait for entries to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      shortWindowLimiter.cleanup();

      // Should be able to make requests again (old entries removed)
      const result = shortWindowLimiter.checkLimit('key1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all attempts', () => {
      rateLimiter.checkLimit('key1');
      rateLimiter.checkLimit('key2');
      rateLimiter.checkLimit('key3');

      rateLimiter.clear();

      const result1 = rateLimiter.checkLimit('key1');
      const result2 = rateLimiter.checkLimit('key2');
      const result3 = rateLimiter.checkLimit('key3');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);
    });
  });
});
