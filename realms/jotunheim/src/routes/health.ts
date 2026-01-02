/**
 * Health Check Route
 * 
 * Standard health endpoint for Docker health checks and monitoring.
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';

export function createHealthRouter(config: RealmConfig): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      realm: config.realmName,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
