import { RateLimiter } from '../src/services/rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 1000,
      maxRequests: 3,
    });
  });

  describe('checkLimit', () => {
    it('should allow requests within limit', async () => {
      const result1 = await rateLimiter.checkLimit('test-key');
      const result2 = await rateLimiter.checkLimit('test-key');
      const result3 = await rateLimiter.checkLimit('test-key');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);
    });

    it('should block requests exceeding limit', async () => {
      await rateLimiter.checkLimit('test-key');
      await rateLimiter.checkLimit('test-key');
      await rateLimiter.checkLimit('test-key');

      const result = await rateLimiter.checkLimit('test-key');

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(1);
    });

    it('should allow requests after time window expires', async () => {
      await rateLimiter.checkLimit('test-key');
      await rateLimiter.checkLimit('test-key');
      await rateLimiter.checkLimit('test-key');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = await rateLimiter.checkLimit('test-key');
      expect(result.allowed).toBe(true);
    });

    it('should track different keys independently', async () => {
      await rateLimiter.checkLimit('key1');
      await rateLimiter.checkLimit('key1');
      await rateLimiter.checkLimit('key1');

      const result1 = await rateLimiter.checkLimit('key1');
      const result2 = await rateLimiter.checkLimit('key2');

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });

    it('should calculate correct retryAfter value', async () => {
      const start = Date.now();
      await rateLimiter.checkLimit('test-key');
      await rateLimiter.checkLimit('test-key');
      await rateLimiter.checkLimit('test-key');

      const result = await rateLimiter.checkLimit('test-key');

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeLessThanOrEqual(2);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset limit for specific key', async () => {
      await rateLimiter.checkLimit('test-key');
      await rateLimiter.checkLimit('test-key');
      await rateLimiter.checkLimit('test-key');

      rateLimiter.reset('test-key');

      const result = await rateLimiter.checkLimit('test-key');
      expect(result.allowed).toBe(true);
    });

    it('should not affect other keys when resetting', async () => {
      await rateLimiter.checkLimit('key1');
      await rateLimiter.checkLimit('key1');
      await rateLimiter.checkLimit('key1');
      await rateLimiter.checkLimit('key2');

      rateLimiter.reset('key1');

      const result1 = await rateLimiter.checkLimit('key1');
      const result2 = await rateLimiter.checkLimit('key2');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('should reset all limits', async () => {
      await rateLimiter.checkLimit('key1');
      await rateLimiter.checkLimit('key1');
      await rateLimiter.checkLimit('key1');
      await rateLimiter.checkLimit('key2');
      await rateLimiter.checkLimit('key2');
      await rateLimiter.checkLimit('key2');

      rateLimiter.resetAll();

      const result1 = await rateLimiter.checkLimit('key1');
      const result2 = await rateLimiter.checkLimit('key2');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });
});
