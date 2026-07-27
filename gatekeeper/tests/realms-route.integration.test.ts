/**
 * Integration tests for GET /realms — the endpoint that feeds the landing
 * page RealmMap. Mounts the real router (real realm metadata, real response
 * shaping) against an Express app with mocked progression/auth collaborators,
 * and verifies the API contract the frontend depends on.
 */
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createRoutes } from '../src/routes';
import { ProgressionClient } from '../src/services/progression-client';
import { ProgressionService } from '../src/services/progression-service';

function buildApp(unlockedRealms: string[]) {
  const progressionClient = {
    validateFlag: jest.fn(),
    getLeaderboard: jest.fn().mockResolvedValue([]),
  } as unknown as ProgressionClient;

  const progressionService = {
    getUnlockedRealms: jest.fn().mockResolvedValue(unlockedRealms),
    invalidateCache: jest.fn(),
  } as unknown as ProgressionService;

  const authMiddleware = {
    ensureSession: (req: Request, _res: Response, next: NextFunction) => {
      Object.defineProperty(req, 'sessionID', { value: 'test-session', configurable: true });
      next();
    },
  };

  // createRealmGate returns a factory: realmGate(realmName) yields the middleware.
  // The previous mock was an object with a `checkAccess` method, which never
  // matched that shape — it survived only because this test passes no realms, so
  // the gate is never constructed.
  const realmGate = (_realmName: string) => (_req: Request, _res: Response, next: NextFunction) =>
    next();

  const app = express();
  app.use(express.json());
  // No proxied realms: keeps the test self-contained (no realm containers)
  app.use(createRoutes([], progressionClient, progressionService, authMiddleware, realmGate));
  return { app, progressionService };
}

describe('GET /realms', () => {
  it('returns all eleven realms (ten production + sample) with the full theme contract', async () => {
    const { app } = buildApp([]);
    const res = await request(app).get('/realms');

    expect(res.status).toBe(200);
    expect(res.body.realms).toHaveLength(11);

    for (const realm of res.body.realms) {
      expect(realm).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          displayName: expect.any(String),
          description: expect.any(String),
          order: expect.any(Number),
          locked: expect.any(Boolean),
          theme: expect.objectContaining({
            primaryColor: expect.stringMatching(/^#[0-9a-f]{6}$/i),
            image: expect.any(String),
            category: expect.any(String),
            icon: expect.any(String),
          }),
        })
      );
    }
  });

  it('unlocks only Niflheim (entry) and sample for a fresh session', async () => {
    const { app } = buildApp([]);
    const res = await request(app).get('/realms');

    const byName = Object.fromEntries(res.body.realms.map((r: any) => [r.name, r]));
    expect(byName.niflheim.locked).toBe(false);
    expect(byName.sample.locked).toBe(false);

    for (const name of [
      'helheim',
      'svartalfheim',
      'jotunheim',
      'muspelheim',
      'nidavellir',
      'vanaheim',
      'midgard',
      'alfheim',
      'asgard',
    ]) {
      expect(byName[name].locked).toBe(true);
    }
  });

  it('unlocks realms reported by the progression service', async () => {
    const { app, progressionService } = buildApp(['NIFLHEIM', 'HELHEIM', 'SVARTALFHEIM']);
    const res = await request(app).get('/realms');

    expect(progressionService.getUnlockedRealms).toHaveBeenCalledWith('test-session');

    const byName = Object.fromEntries(res.body.realms.map((r: any) => [r.name, r]));
    expect(byName.helheim.locked).toBe(false);
    expect(byName.svartalfheim.locked).toBe(false);
    expect(byName.jotunheim.locked).toBe(true);
    expect(byName.asgard.locked).toBe(true);
  });

  it('serves the OWASP 2025 category and emblem for the final realm', async () => {
    const { app } = buildApp([]);
    const res = await request(app).get('/realms');

    const asgard = res.body.realms.find((r: any) => r.name === 'asgard');
    expect(asgard.order).toBe(1);
    expect(asgard.theme.category).toBe('A01:2025 Broken Access Control');
    expect(asgard.theme.icon).toBe('👑');
  });

  it('returns 500 when the progression service fails', async () => {
    const { app, progressionService } = buildApp([]);
    (progressionService.getUnlockedRealms as jest.Mock).mockRejectedValue(new Error('redis down'));

    const res = await request(app).get('/realms');
    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});
