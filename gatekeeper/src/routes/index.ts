import { Router, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { RealmConfig, REALMS_METADATA } from '../config';
import { ProgressionClient } from '../services/progression-client';
import { ProgressionService } from '../services/progression-service';
import { csrfProtection } from '../middleware/csrf';
import { metrics } from '../utils/metrics';

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
