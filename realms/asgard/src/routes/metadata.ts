/**
 * Metadata Service Routes
 * Internal API for secrets and configuration management
 * 
 * 
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { Pool } from 'pg';

export function createMetadataRouter(config: RealmConfig): Router {
  const router = Router();

  /**
   * List available metadata endpoints
   * 
   * Route: GET /metadata/
   */
  router.get('/', (_req: Request, res: Response) => {
    res.json({
      success: true,
      service: 'asgard-metadata',
      version: '1.0.0',
      description: 'Internal metadata and secrets management service',
      endpoints: [
        {
          path: '/metadata/',
          method: 'GET',
          description: 'List available endpoints'
        },
        {
          path: '/metadata/secrets',
          method: 'GET',
          description: 'Retrieve system secrets and flags'
        },
        {
          path: '/metadata/config',
          method: 'GET',
          description: 'Service configuration information'
        },
        {
          path: '/metadata/health',
          method: 'GET',
          description: 'Health status check'
        }
      ],
      note: 'This service is internal only - not externally accessible'
    });
  });

  /**
   * Secrets Endpoint
   * 
   * 
   * Route: GET /metadata/secrets
   */
  router.get('/secrets', async (_req: Request, res: Response) => {
    try {
      const pool = new Pool({ connectionString: config.databaseUrl });
      
      
      const result = await pool.query(
        'SELECT * FROM secrets WHERE secret_type IN ($1, $2) ORDER BY id',
        ['flag', 'system']
      );
      
      await pool.end();

      //
      res.json({
        success: true,
        service: 'internal-metadata',
        note: 'This endpoint is only accessible via SSRF',
        warning: 'Contains sensitive secrets and realm flags',
        secrets: result.rows,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('[Metadata] Database error:', error);
      res.status(500).json({
        success: false,
        error: 'Database error'
      });
    }
  });

  /**
   * Configuration Endpoint
   * 
   * Route: GET /metadata/config
   */
  router.get('/config', (_req: Request, res: Response) => {
    res.json({
      success: true,
      config: {
        service: 'metadata',
        realm: config.realmName,
        environment: config.nodeEnv,
        port: 9090,
        host: '127.0.0.1',
        database: config.databaseUrl.split('@')[1] || 'hidden',
        features: {
          secretsManagement: true,
          flagStorage: true,
          configurationApi: true
        }
      },
      note: 'Internal service configuration'
    });
  });

  /**
   * Health Check
   * 
   * Route: GET /metadata/health
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      service: 'metadata',
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  return router;
}
