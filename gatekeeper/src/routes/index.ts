import { Router, Request, Response, RequestHandler } from 'express';
import { createHash } from 'crypto';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { RealmConfig, REALMS_METADATA } from '../config';
import { ProgressionClient } from '../services/progression-client';
import { ProgressionService } from '../services/progression-service';
import { csrfProtection } from '../middleware/csrf';
import { metrics } from '../utils/metrics';

/**
 * Pull the upstream HTTP status out of a proxied-request failure.
 *
 * The flag oracle is reached over axios, whose rejections carry the upstream
 * response on `error.response`. Narrowed here rather than typing the catch as
 * `any`, so a shape change surfaces at compile time instead of silently
 * degrading every upstream 404 into a 500.
 */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function upstreamStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return undefined;
  const status = (response as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Convert a raw user/session id into a stable, non-reversible display handle so the
 * public leaderboard never leaks session ids or account ids.
 */
function toDisplayHandle(rawId: string): string {
  const suffix = createHash('sha256').update(rawId).digest('hex').slice(0, 6).toUpperCase();
  return `Seeker-${suffix}`;
}

export function createRoutes(
  realms: RealmConfig[],
  progressionClient: ProgressionClient,
  progressionService: ProgressionService,
  authMiddleware: { ensureSession: RequestHandler },
  realmGate: (realmName: string) => RequestHandler,
  landingPagePath?: string
): Router {
  const router = Router();

  // Landing page (if provided)
  if (landingPagePath) {
    router.get('/', (_req: Request, res: Response) => {
      res.sendFile(landingPagePath);
    });
  }

  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', service: 'gatekeeper' });
  });

  /**
   * RFC 9116 security.txt — the rules of engagement for a hosted instance.
   *
   * Yggdrasil is deliberately vulnerable, so a public deployment has to say out
   * loud which hosts are the target and which are merely in the path. Values are
   * environment-driven so an operator can point it at their own contact without
   * rebuilding the image, and the route is declared here (ahead of the realm
   * proxies and the SPA catch-all) so it can never be shadowed by a realm.
   */
  router.get('/.well-known/security.txt', (_req: Request, res: Response) => {
    const contact = process.env.SECURITY_CONTACT || 'mailto:kirumachi@proton.me';
    const canonical = process.env.PUBLIC_ORIGIN
      ? `${process.env.PUBLIC_ORIGIN}/.well-known/security.txt`
      : undefined;
    const inScope = process.env.PUBLIC_ORIGIN || '(this deployment only)';

    // RFC 9116 requires an expiry; default to a year out so a forgotten
    // deployment advertises a stale-but-honest date rather than none.
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const lines = [
      `Contact: ${contact}`,
      `Expires: ${expires}`,
      ...(canonical ? [`Canonical: ${canonical}`] : []),
      'Policy: https://github.com/Kaademos/kademos-yggdrasil/blob/main/SECURITY.md',
      '',
      '# Project Yggdrasil is a vulnerable-by-design training platform.',
      '# The realms are MEANT to be exploited. Please do not report them.',
      '#',
      `# In scope:     ${inScope}`,
      '# Out of scope: Cloudflare and every other network provider in the path,',
      '#               other players, and any host not listed above.',
      '#',
      '# Report only: control-plane flaws (gatekeeper / flag-oracle), container',
      '# escape, or host compromise. See the Policy link for full scope.',
      '',
    ];

    res.type('text/plain').send(lines.join('\n'));
  });

  router.get('/metrics', async (_req: Request, res: Response) => {
    try {
      const metricsData = await metrics.getMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(metricsData);
    } catch (error) {
      console.error('[Gatekeeper] Error generating metrics:', error);
      res.status(500).send('Error generating metrics');
    }
  });

  router.post(
    '/submit-flag',
    authMiddleware.ensureSession,
    csrfProtection,
    async (req: Request, res: Response) => {
      try {
        const { flag } = req.body;
        // Use logged-in user ID if available, otherwise use session ID for anonymous users
        const progressionId = req.user?.id || req.sessionID;

        if (!progressionId) {
          return res.status(500).json({
            status: 'error',
            message: 'Session not initialized',
          });
        }

        if (!flag) {
          return res.status(400).json({
            status: 'error',
            message: 'flag is required',
          });
        }

        const result = await progressionClient.validateFlag(progressionId, flag);

        // Invalidate progression cache on successful flag submission
        if (result.status === 'success') {
          progressionService.invalidateCache(progressionId);
        }

        res.status(result.status === 'success' ? 200 : 400).json(result);
      } catch (error) {
        console.error('[Gatekeeper] Error submitting flag:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  );

  router.get('/leaderboard', authMiddleware.ensureSession, async (req: Request, res: Response) => {
    try {
      const progressionId = req.user?.id || req.sessionID;
      const rawLimit = parseInt(String(req.query.limit ?? '20'), 10);
      const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100);

      const entries = await progressionClient.getLeaderboard(limit);

      const leaderboard = entries.map((e) => ({
        rank: e.rank,
        handle: toDisplayHandle(e.userId),
        score: e.score,
        realmsCompleted: e.realmsCompleted,
        isYou: progressionId ? e.userId === progressionId : false,
      }));

      res.status(200).json({ leaderboard });
    } catch (error) {
      console.error('[Gatekeeper] Error fetching leaderboard:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  router.get('/realms', authMiddleware.ensureSession, async (req: Request, res: Response) => {
    try {
      // Use logged-in user ID if available, otherwise use session ID for anonymous users
      const progressionId = req.user?.id || req.sessionID;
      let unlockedRealms: string[] = [];

      if (progressionId) {
        unlockedRealms = await progressionService.getUnlockedRealms(progressionId);
      }

      const realmList = REALMS_METADATA.map((r) => {
        // Sample realm and Niflheim (order 10, the entry realm) are always accessible
        const isAlwaysAccessible = r.name.toLowerCase() === 'sample' || r.order === 10;
        const isLocked = isAlwaysAccessible
          ? false
          : !unlockedRealms.includes(r.name.toUpperCase());

        return {
          name: r.name,
          displayName: r.displayName,
          description: r.description,
          order: r.order,
          locked: isLocked,
          theme: {
            primaryColor: r.theme.primaryColor,
            image: r.theme.image,
            category: r.theme.category,
            icon: r.theme.icon,
          },
        };
      });

      res.status(200).json({ realms: realmList });
    } catch (error) {
      console.error('[Gatekeeper] Error fetching realms:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  // Hint routes — declared before the realm proxy so they are handled here and not
  // forwarded into the realm container. Hints never block progression.
  router.get(
    '/realms/:realm/hints',
    authMiddleware.ensureSession,
    async (req: Request, res: Response) => {
      try {
        const progressionId = req.user?.id || req.sessionID;
        if (!progressionId) {
          return res.status(500).json({ status: 'error', message: 'Session not initialized' });
        }

        const data = await progressionClient.getHints(progressionId, req.params.realm);
        res.status(200).json(data);
      } catch (error) {
        const status = upstreamStatus(error) === 404 ? 404 : 500;
        if (status === 404) {
          return res.status(404).json({ status: 'error', message: 'No hints for this realm' });
        }
        console.error('[Gatekeeper] Error fetching hints:', errorMessage(error));
        res.status(500).json({ status: 'error', message: 'Internal server error' });
      }
    }
  );

  router.post(
    '/realms/:realm/hint',
    authMiddleware.ensureSession,
    csrfProtection,
    async (req: Request, res: Response) => {
      try {
        const progressionId = req.user?.id || req.sessionID;
        if (!progressionId) {
          return res.status(500).json({ status: 'error', message: 'Session not initialized' });
        }

        const order = parseInt(String(req.body.order), 10);
        if (Number.isNaN(order)) {
          return res.status(400).json({ status: 'error', message: 'order is required' });
        }

        const result = await progressionClient.revealHint(progressionId, req.params.realm, order);
        res.status(200).json(result);
      } catch (error) {
        const status = upstreamStatus(error) === 404 ? 404 : 500;
        if (status === 404) {
          return res.status(404).json({ status: 'error', message: 'Hint not found' });
        }
        console.error('[Gatekeeper] Error revealing hint:', errorMessage(error));
        res.status(500).json({ status: 'error', message: 'Internal server error' });
      }
    }
  );

  for (const realm of realms) {
    const proxyMiddleware = createProxyMiddleware({
      target: realm.internalUrl,
      changeOrigin: true,
      pathRewrite: {
        [`^/realms/${realm.name}`]: '',
      },
      onError: (err, _req, res) => {
        console.error(`[Gatekeeper] Proxy error for realm ${realm.name}:`, err);
        if ('status' in res && typeof res.status === 'function') {
          res.status(502).json({
            status: 'error',
            message: 'Bad Gateway',
          });
        }
      },
    });

    // Redirect to trailing slash for base realm URL (ensures relative paths work)
    router.get(`/realms/${realm.name}`, (req: Request, res: Response, next) => {
      // Only redirect if there's no trailing slash
      if (req.originalUrl === `/realms/${realm.name}`) {
        return res.redirect(301, `/realms/${realm.name}/`);
      }
      next();
    });

    // Realms are accessible to everyone - use session for progression tracking
    router.use(
      `/realms/${realm.name}`,
      authMiddleware.ensureSession,
      realmGate(realm.name),
      proxyMiddleware
    );
  }

  // Catch-all route for SPA client-side routing (must be last)
  // Serve index.html for any unmatched routes so React Router can handle them
  if (landingPagePath) {
    router.get('*', (_req: Request, res: Response) => {
      res.sendFile(landingPagePath);
    });
  }

  return router;
}
