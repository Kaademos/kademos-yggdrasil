/**
 * Midgard Realm Entry Point
 * 
 * OWASP A03:2025 - Supply Chain Failures
 * Demonstrates dependency confusion and typosquatting vulnerabilities
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { loadConfig, RealmConfig } from './config';
import { createHealthRouter } from './routes/health';
import { createMidgardRouter } from './routes/midgard';
import { createBuildRouter } from './routes/build';
import { requestLogger, errorLogger } from './middleware/logging';
import { PackageResolverService } from './services/package-resolver';
import { BuildService } from './services/build-service';

/**
 * Create and configure Express application
 */
function createApp(config: RealmConfig): express.Application {
  const app = express();

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging middleware (in development mode)
  if (config.nodeEnv === 'development') {
    app.use(requestLogger);
  }

  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, 'public')));

  // Initialize services
  const packageResolver = new PackageResolverService();
  const verdaccioUrl = process.env.VERDACCIO_URL || 'http://verdaccio:4873';
  const buildService = new BuildService(verdaccioUrl, config.flag);

  // Mount health check router
  app.use(createHealthRouter(config));

  // Mount Midgard routes
  app.use(createMidgardRouter(config, packageResolver));

  // Mount build routes
  app.use(createBuildRouter(buildService));

  // Default landing page
  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Error logging middleware
  if (config.nodeEnv === 'development') {
    app.use(errorLogger);
  }

  // Error handling middleware (must be last)
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    
    res.status(statusCode).json({
      error: config.nodeEnv === 'development' ? err.message : 'Internal Server Error',
      ...(config.nodeEnv === 'development' && { stack: err.stack }),
    });
  });

  return app;
}

/**
 * Main entry point
 */
async function main() {
  const config = loadConfig();
  const app = createApp(config);

  app.listen(config.port, () => {
    console.info(`🌍  MIDGARD - Human Marketplace`);
    console.info(`   Listening on port ${config.port}`);
    console.info(`   Environment: ${config.nodeEnv}`);
    console.info(`   OWASP: A03:2025 - Supply Chain Failures`);
    console.info(`   Vulnerability: Dependency Confusion Attack`);
  });
}

// Start the server (only when run directly, not when imported for tests)
if (require.main === module) {
  main().catch((error) => {
    console.error(`Fatal error starting realm:`, error);
    process.exit(1);
  });
}
