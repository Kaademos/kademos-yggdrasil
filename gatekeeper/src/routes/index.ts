import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { RealmConfig, REALMS_METADATA } from '../config';
import { ProgressionClient } from '../services/progression-client';
import { ProgressionService } from '../services/progression-service';
import { csrfProtection } from '../middleware/csrf';
import { metrics } from '../utils/metrics';

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
  authMiddleware: any,
  realmGate: any,
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
      } catch (error: any) {
        const status = error?.response?.status === 404 ? 404 : 500;
        if (status === 404) {
          return res.status(404).json({ status: 'error', message: 'No hints for this realm' });
        }
        console.error('[Gatekeeper] Error fetching hints:', error?.message || error);
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
      } catch (error: any) {
        const status = error?.response?.status === 404 ? 404 : 500;
        if (status === 404) {
          return res.status(404).json({ status: 'error', message: 'Hint not found' });
        }
        console.error('[Gatekeeper] Error revealing hint:', error?.message || error);
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
