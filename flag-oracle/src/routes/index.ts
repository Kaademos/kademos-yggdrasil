import { Router, Request, Response } from 'express';
import { ProgressionService } from '../services/progression-service';
import { FlagService } from '../services/flag-service';
import { RateLimiter } from '../services/rate-limiter';
import { Logger } from '../services/logger';
import { metrics } from '../utils/metrics';
import { createRateLimitMiddleware } from '../middleware/rate-limit';
import { InputSanitizer } from '../utils/input-sanitizer';

export interface RouteConfig {
  progressionService: ProgressionService;
  rateLimiter?: RateLimiter;
  logger?: Logger;
  flagService?: FlagService | null;
}

export function createRoutes(config: RouteConfig | ProgressionService): Router {
  const router = Router();

  const progressionService =
    config instanceof ProgressionService ? config : config.progressionService;
  const rateLimiter = config instanceof ProgressionService ? undefined : config.rateLimiter;
  const logger = config instanceof ProgressionService ? undefined : config.logger;
  const flagService = config instanceof ProgressionService ? undefined : config.flagService;

  const rateLimitMiddleware = rateLimiter ? createRateLimitMiddleware(rateLimiter, logger) : [];

  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', service: 'flag-oracle' });
  });

  // M8: Generate dynamic flag for user/realm pair
  router.post('/generate', rateLimitMiddleware, async (req: Request, res: Response) => {
    try {
      if (!flagService) {
        return res.status(503).json({
          status: 'error',
          message: 'Dynamic flag generation not available (FLAG_MASTER_SECRET not configured)',
        });
      }

      const userId = InputSanitizer.sanitizeUserId(req.body.userId);
      const realmId = InputSanitizer.sanitizeUserId(req.body.realmId); // Reuse same sanitizer for alphanumeric

      if (!userId || !realmId) {
        return res.status(400).json({
          status: 'error',
          message: 'userId and realmId are required',
        });
      }

      const flag = flagService.generateFlag(realmId, userId);

      if (logger) {
        logger.logInfo('Flag generated', {
          userId,
          realmId: realmId.toUpperCase(),
          endpoint: '/generate',
        });
      }

      res.status(200).json({
        status: 'ok',
        flag,
        realmId: realmId.toUpperCase(),
      });
    } catch (error) {
      if (logger) {
        logger.logError(error as Error, {
          userId: req.body.userId,
          realmId: req.body.realmId,
          endpoint: '/generate',
        });
      }
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate flag',
      });
    }
  });

  router.get('/metrics', async (_req: Request, res: Response) => {
    try {
      const metricsOutput = await metrics.getMetrics();
      res.set('Content-Type', metrics.register.contentType);
      res.send(metricsOutput);
    } catch (error) {
      if (logger) {
        logger.logError(error as Error, { endpoint: '/metrics' });
      }
      res.status(500).send('Error generating metrics');
    }
  });

  router.post('/validate', rateLimitMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = InputSanitizer.sanitizeUserId(req.body.userId);
      const flag = InputSanitizer.sanitizeFlag(req.body.flag);

      if (!userId || !flag) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid input parameters',
        });
      }

      const result = await progressionService.validateFlag(userId, flag);

      if (logger) {
        const ip = req.ip || 'unknown';
        logger.logValidationAttempt(userId, flag, result.status === 'success', ip);
      }

      const statusCode = result.status === 'success' ? 200 : 400;
      res.status(statusCode).json(result);
    } catch (error) {
      if (logger) {
        logger.logError(error as Error, { userId: req.body.userId, endpoint: '/validate' });
      } else {
        console.error('Error validating flag:', error);
      }
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  router.get('/progress/:userId', rateLimitMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = InputSanitizer.sanitizeUserId(req.params.userId);

      if (!userId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid userId parameter',
        });
      }

      const progression = await progressionService.getProgression(userId);

      if (!progression) {
        return res.status(404).json({
          status: 'error',
          message: 'User progression not found',
        });
      }

      res.status(200).json(progression);
    } catch (error) {
      if (logger) {
        logger.logError(error as Error, { userId: req.params.userId, endpoint: '/progress' });
      } else {
        console.error('Error fetching progression:', error);
      }
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  return router;
}
