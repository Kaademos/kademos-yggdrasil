export interface SessionData {
  userId: string;
  username: string;
  createdAt: Date;
  lastAccessed: Date;
}

export interface ISessionStore {
  get(sessionId: string): Promise<SessionData | null>;
  set(sessionId: string, data: SessionData): Promise<void>;
  destroy(sessionId: string): Promise<void>;
  touch(sessionId: string): Promise<void>;
}

export class MemorySessionStore implements ISessionStore {
  private sessions: Map<string, SessionData> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxSessions: number;
  private readonly sessionTTLMs: number;

  constructor(
    maxSessions: number = 1000,
    sessionTTLMs: number = 3600000,
    cleanupIntervalMs: number = 300000
  ) {
    this.maxSessions = maxSessions;
    this.sessionTTLMs = sessionTTLMs;

    // Start cleanup job
    this.startCleanup(cleanupIntervalMs);
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const data = this.sessions.get(sessionId);
    if (!data) return null;

    // Check if session expired
    const now = Date.now();
    const sessionAge = now - data.lastAccessed.getTime();
    if (sessionAge > this.sessionTTLMs) {
      await this.destroy(sessionId);
      return null;
    }

    return data;
  }

  async set(sessionId: string, data: SessionData): Promise<void> {
    // Enforce max sessions limit
    if (this.sessions.size >= this.maxSessions && !this.sessions.has(sessionId)) {
      // Remove oldest session
      const oldestSessionId = this.findOldestSession();
      if (oldestSessionId) {
        await this.destroy(oldestSessionId);
      }
    }

    this.sessions.set(sessionId, {
      ...data,
      lastAccessed: new Date(),
    });
  }

  async destroy(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async touch(sessionId: string): Promise<void> {
    const data = this.sessions.get(sessionId);
    if (data) {
      data.lastAccessed = new Date();
    }
  }

  private findOldestSession(): string | null {
    let oldestId: string | null = null;
    let oldestTime: number = Date.now();

    for (const [sessionId, data] of this.sessions.entries()) {
      const accessTime = data.lastAccessed.getTime();
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestId = sessionId;
      }
    }

    return oldestId;
  }

  private startCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, intervalMs);

    // Don't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, data] of this.sessions.entries()) {
      const sessionAge = now - data.lastAccessed.getTime();
      if (sessionAge > this.sessionTTLMs) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      console.info(`[SessionStore] Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Test helper methods
  async count(): Promise<number> {
    return this.sessions.size;
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }
}
