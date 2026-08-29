/**
 * Guards the SPA catch-all route registration.
 *
 * `createRoutes` only registers the `router.get('*')` fallback when a
 * `landingPagePath` is supplied, and production always supplies one
 * (gatekeeper/src/index.ts). Every other suite omits it, so until this test
 * existed the catch-all was never constructed anywhere in CI — the route was
 * exercised only at container startup.
 *
 * That gap matters because the wildcard pattern is the part of this codebase
 * most sensitive to the router's path parser. Express 5 moves to
 * path-to-regexp v8, where a bare `'*'` is rejected with
 * "Missing parameter name at index 1" and the router throws while mounting.
 * A dependency bump could therefore pass the whole unit suite and still crash
 * the Gatekeeper on boot.
 *
 * If this test starts failing after an Express upgrade, the fix is to name the
 * wildcard (`'/*splat'`) rather than to delete the assertion.
 */
import * as fs from 'fs';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createRoutes } from '../src/routes';
import { ProgressionClient } from '../src/services/progression-client';
import { ProgressionService } from '../src/services/progression-service';

const LANDING_PAGE = '/tmp/yggdrasil-test-landing.html';

function buildApp() {
  const progressionClient = {
    validateFlag: jest.fn(),
    getLeaderboard: jest.fn().mockResolvedValue([]),
  } as unknown as ProgressionClient;

  const progressionService = {
    getUnlockedRealms: jest.fn().mockResolvedValue([]),
    invalidateCache: jest.fn(),
  } as unknown as ProgressionService;

  const authMiddleware = {
    ensureSession: (req: Request, _res: Response, next: NextFunction) => {
      Object.defineProperty(req, 'sessionID', { value: 'test-session', configurable: true });
      next();
    },
  };

  const realmGate = (_realmName: string) => (_req: Request, _res: Response, next: NextFunction) =>
    next();

  const app = express();
  app.use(express.json());
  app.use(
    createRoutes([], progressionClient, progressionService, authMiddleware, realmGate, LANDING_PAGE)
  );
  return app;
}

describe('SPA catch-all route', () => {
  // A real file, so res.sendFile succeeds and a served response proves the
  // catch-all matched rather than an error handler swallowing the request.
  beforeAll(() => {
    fs.writeFileSync(LANDING_PAGE, '<!doctype html><title>Yggdrasil</title>');
  });

  afterAll(() => {
    fs.rmSync(LANDING_PAGE, { force: true });
  });

  it('mounts without throwing when a landing page is configured', () => {
    // The router builds its path matchers at mount time, so an unsupported
    // wildcard pattern surfaces here rather than on the first request.
    expect(() => buildApp()).not.toThrow();
  });

  it('still routes API paths to their own handlers', async () => {
    const res = await request(buildApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'gatekeeper' });
  });

  it('serves the landing page for unmatched client-side routes', async () => {
    const res = await request(buildApp()).get('/some/client-side/route');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Yggdrasil');
  });
});
