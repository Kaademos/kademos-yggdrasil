/**
 * Asgard Internal Routes
 * Development and internal API endpoints
 * 
 * 
 */

import { Router, Request, Response } from 'express';

export function createInternalRouter(): Router {
  const router = Router();

  /**
   * Metadata Service Information Endpoint
   * 
   * 
   */
  router.get('/metadata-service', (_req: Request, res: Response) => {
    // 
    // 
    
    res.json({
      success: true,
      service: 'metadata',
      url: 'http://localhost:9090',
      description: 'Internal metadata and secrets management service',
      endpoints: [
        {
          path: '/metadata/',
          method: 'GET',
          description: 'List available metadata endpoints'
        },
        {
          path: '/metadata/secrets',
          method: 'GET',
          description: 'Retrieve system secrets (FLAG HERE)'
        },
        {
          path: '/metadata/config',
          method: 'GET',
          description: 'Service configuration'
        },
        {
          path: '/metadata/health',
          method: 'GET',
          description: 'Health status'
        }
      ],
      access: 'Internal only (localhost)',
      note: 'This service is not externally accessible',
      hint: 'Use Odin-View (System Diagnostics) to access internal services via SSRF'
    });
  });

  /**
   * Diagnostics Endpoint (placeholder)
   * 
   * Route: GET /api/internal/diagnostics
   */
  router.get('/diagnostics', (_req: Request, res: Response) => {
    res.json({
      success: true,
      diagnostics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        platform: process.platform
      },
      note: 'System diagnostics'
    });
  });

  /**
   * Configuration Endpoint (placeholder)
   * 
   * Route: GET /api/internal/config
   */
  router.get('/config', (_req: Request, res: Response) => {
    res.json({
      success: true,
      config: {
        environment: process.env.NODE_ENV || 'development',
        realm: process.env.REALM_NAME || 'asgard',
        features: {
          employeeManagement: true,
          documentManagement: true,
          odinView: true,
          advancedReporting: false
        }
      },
      note: 'Application configuration'
    });
  });

  return router;
}
