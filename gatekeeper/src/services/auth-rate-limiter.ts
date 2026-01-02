export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export class AuthRateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  checkLimit(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get attempts for this key
    let attempts = this.attempts.get(key) || [];

    // Filter out attempts outside the window
    attempts = attempts.filter((timestamp) => timestamp > windowStart);

    // Check if limit exceeded
    if (attempts.length >= this.maxRequests) {
      const oldestAttempt = Math.min(...attempts);
      const retryAfter = Math.ceil((oldestAttempt + this.windowMs - now) / 1000);

      return {
        allowed: false,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Record this attempt
    attempts.push(now);
    this.attempts.set(key, attempts);

    return { allowed: true };
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  // Cleanup old entries to prevent memory leaks
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, attempts] of this.attempts.entries()) {
      const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart);

      if (recentAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, recentAttempts);
      }
    }
  }

  // Test helper
  clear(): void {
    this.attempts.clear();
  }
}
