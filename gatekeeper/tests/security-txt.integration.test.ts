/**
 * Integration tests for GET /.well-known/security.txt — the published rules of
 * engagement for a hosted instance. A deliberately vulnerable platform has to
 * state which hosts are the target and which are only in the path, so this
 * endpoint is part of the deployment contract rather than documentation.
 */
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createRoutes } from '../src/routes';
import { ProgressionClient } from '../src/services/progression-client';
import { ProgressionService } from '../src/services/progression-service';

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
  app.use(createRoutes([], progressionClient, progressionService, authMiddleware, realmGate));
  return app;
}

describe('GET /.well-known/security.txt', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SECURITY_CONTACT;
    delete process.env.PUBLIC_ORIGIN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('serves plain text', async () => {
    const res = await request(buildApp()).get('/.well-known/security.txt');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('includes the RFC 9116 required fields', async () => {
    const res = await request(buildApp()).get('/.well-known/security.txt');

    expect(res.text).toContain('Contact: ');
    expect(res.text).toContain('Expires: ');
    expect(res.text).toContain('Policy: ');
  });

  it('sets an expiry in the future', async () => {
    const res = await request(buildApp()).get('/.well-known/security.txt');

    const expires = res.text.match(/^Expires: (.+)$/m)?.[1];
    expect(expires).toBeDefined();
    expect(new Date(expires as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('names transit providers and other players as out of scope', async () => {
    const res = await request(buildApp()).get('/.well-known/security.txt');

    expect(res.text).toContain('Out of scope');
    expect(res.text).toContain('Cloudflare');
    expect(res.text).toContain('other players');
  });

  it('takes the contact address from the environment', async () => {
    process.env.SECURITY_CONTACT = 'mailto:ops@example.test';

    const res = await request(buildApp()).get('/.well-known/security.txt');

    expect(res.text).toContain('Contact: mailto:ops@example.test');
  });

  it('advertises the deployment origin as the in-scope host', async () => {
    process.env.PUBLIC_ORIGIN = 'https://play.example.test';

    const res = await request(buildApp()).get('/.well-known/security.txt');

    expect(res.text).toContain('In scope:     https://play.example.test');
    expect(res.text).toContain('Canonical: https://play.example.test/.well-known/security.txt');
  });

  it('omits Canonical when no public origin is configured', async () => {
    const res = await request(buildApp()).get('/.well-known/security.txt');

    expect(res.text).not.toContain('Canonical:');
  });
});
