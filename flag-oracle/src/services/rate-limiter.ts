export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export class RateLimiter {
  private attempts = new Map<string, number[]>();

  constructor(private config: RateLimitConfig) {}

  async checkLimit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter((t) => t > windowStart);

    if (recentAttempts.length >= this.config.maxRequests) {
      const oldestAttempt = recentAttempts[0];
      const retryAfter = Math.ceil((oldestAttempt + this.config.windowMs - now) / 1000);
      return { allowed: false, retryAfter };
    }

    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);

    this.cleanupOldEntries();

    return { allowed: true };
  }

  private cleanupOldEntries(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const keysToCleanup: string[] = [];
    const updates: Map<string, number[]> = new Map();

    this.attempts.forEach((attempts, key) => {
      const recentAttempts = attempts.filter((t) => t > windowStart);
      if (recentAttempts.length === 0) {
        keysToCleanup.push(key);
      } else if (recentAttempts.length !== attempts.length) {
        updates.set(key, recentAttempts);
      }
    });

    keysToCleanup.forEach((key) => this.attempts.delete(key));
    updates.forEach((value, key) => this.attempts.set(key, value));
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  resetAll(): void {
    this.attempts.clear();
  }
}
