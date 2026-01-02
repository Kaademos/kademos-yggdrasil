import { MemorySessionStore, SessionData } from '../src/services/session-store';

describe('MemorySessionStore', () => {
  let store: MemorySessionStore;

  beforeEach(() => {
    store = new MemorySessionStore(100, 1000, 100000); // 1 second TTL for tests
  });

  afterEach(() => {
    store.stop();
  });

  const createSessionData = (userId: string = 'user1'): SessionData => ({
    userId,
    username: 'testuser',
    createdAt: new Date(),
    lastAccessed: new Date(),
  });

  describe('set and get', () => {
    it('should store and retrieve session data', async () => {
      const data = createSessionData();
      await store.set('session1', data);

      const retrieved = await store.get('session1');
      expect(retrieved).toBeTruthy();
      expect(retrieved?.userId).toBe('user1');
      expect(retrieved?.username).toBe('testuser');
    });

    it('should return null for non-existent session', async () => {
      const retrieved = await store.get('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should update lastAccessed on set', async () => {
      const data = createSessionData();
      const originalTime = new Date('2023-01-01');
      data.lastAccessed = originalTime;

      await store.set('session1', data);
      const retrieved = await store.get('session1');

      expect(retrieved?.lastAccessed.getTime()).toBeGreaterThan(
        originalTime.getTime()
      );
    });
  });

  describe('destroy', () => {
    it('should remove session', async () => {
      const data = createSessionData();
      await store.set('session1', data);
      expect(await store.count()).toBe(1);

      await store.destroy('session1');
      expect(await store.count()).toBe(0);

      const retrieved = await store.get('session1');
      expect(retrieved).toBeNull();
    });

    it('should not error when destroying non-existent session', async () => {
      await expect(store.destroy('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('touch', () => {
    it('should update lastAccessed time', async () => {
      const data = createSessionData();
      data.lastAccessed = new Date(Date.now() - 1000); // Set to 1 second ago
      await store.set('session1', data);

      // Manually set lastAccessed to old time (since set() updates it)
      const sessions = (store as any).sessions;
      const sessionData = sessions.get('session1');
      const oldTime = new Date(Date.now() - 1000);
      sessionData.lastAccessed = oldTime;

      await store.touch('session1');
      const after = await store.get('session1');

      expect(after?.lastAccessed.getTime()).toBeGreaterThan(oldTime.getTime());
    });

    it('should not error when touching non-existent session', async () => {
      await expect(store.touch('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('TTL and expiration', () => {
    it('should return null for expired session', async () => {
      const data = createSessionData();
      data.lastAccessed = new Date(Date.now() - 2000); // 2 seconds ago, TTL is 1 second

      await store.set('session1', data);
      // Manually set old lastAccessed
      const sessions = (store as any).sessions;
      const sessionData = sessions.get('session1');
      sessionData.lastAccessed = new Date(Date.now() - 2000);

      const retrieved = await store.get('session1');
      expect(retrieved).toBeNull();
    });

    it('should clean up expired sessions automatically', async () => {
      const shortTTLStore = new MemorySessionStore(100, 100, 50); // 100ms TTL, 50ms cleanup

      const data = createSessionData();
      await shortTTLStore.set('session1', data);
      expect(await shortTTLStore.count()).toBe(1);

      // Wait for expiration and cleanup
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(await shortTTLStore.count()).toBe(0);

      shortTTLStore.stop();
    });
  });

  describe('max sessions limit', () => {
    it('should enforce max sessions limit by removing oldest', async () => {
      const smallStore = new MemorySessionStore(3, 10000, 100000); // Max 3 sessions

      await smallStore.set('session1', createSessionData('user1'));
      await new Promise((resolve) => setTimeout(resolve, 10));

      await smallStore.set('session2', createSessionData('user2'));
      await new Promise((resolve) => setTimeout(resolve, 10));

      await smallStore.set('session3', createSessionData('user3'));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(await smallStore.count()).toBe(3);

      // Adding a 4th session should remove the oldest (session1)
      await smallStore.set('session4', createSessionData('user4'));
      expect(await smallStore.count()).toBe(3);

      const session1 = await smallStore.get('session1');
      expect(session1).toBeNull();

      const session4 = await smallStore.get('session4');
      expect(session4).toBeTruthy();

      smallStore.stop();
    });
  });

  describe('count and clear', () => {
    it('should count sessions correctly', async () => {
      expect(await store.count()).toBe(0);

      await store.set('session1', createSessionData());
      expect(await store.count()).toBe(1);

      await store.set('session2', createSessionData('user2'));
      expect(await store.count()).toBe(2);

      await store.destroy('session1');
      expect(await store.count()).toBe(1);
    });

    it('should clear all sessions', async () => {
      await store.set('session1', createSessionData());
      await store.set('session2', createSessionData('user2'));
      expect(await store.count()).toBe(2);

      await store.clear();
      expect(await store.count()).toBe(0);
    });
  });
});
