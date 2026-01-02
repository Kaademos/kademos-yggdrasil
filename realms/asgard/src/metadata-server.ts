/**
 * Asgard Metadata Server
 *
 */

import express, { Request, Response } from 'express';
import { loadConfig } from './config';
import { createMetadataRouter } from './routes/metadata';

async function main() {
  const config = loadConfig();
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging middleware
  app.use((req: Request, _res: Response, next) => {
    console.log(`[Metadata] ${req.method} ${req.path}`);
    next();
  });

  // Mount metadata routes
  app.use('/metadata', createMetadataRouter(config));

  // Root endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      service: 'asgard-metadata',
      version: '1.0.0',
      description: 'Internal metadata and secrets management service',
      note: 'This service is only accessible internally',
      endpoints: [
        '/metadata/',
        '/metadata/secrets',
        '/metadata/config',
        '/metadata/health'
      ]
    });
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      service: 'asgard-metadata',
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: any) => {
    console.error('[Metadata Error]:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  });

  //
  const PORT = 9090;
  const HOST = '127.0.0.1';

  app.listen(PORT, HOST, () => {
    console.info('🔒 ASGARD METADATA SERVICE');
    console.info(`   Listening on ${HOST}:${PORT}`);
    console.info('   ⚠️  Internal only - Not externally accessible');
    console.info('   ⚠️  Accessible via SSRF through Odin-View');
  });
}

main().catch((error) => {
  console.error('Metadata server fatal error:', error);
  process.exit(1);
});
