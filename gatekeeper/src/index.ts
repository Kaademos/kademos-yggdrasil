import 'reflect-metadata';
import express from 'express';
import path from 'path';
import { configureContainer } from './config/di';
import { enhancedSecurityHeaders } from './middleware/security-headers';
import { createSessionMiddleware } from './middleware/session';
import { createCorsMiddleware } from './middleware/cors-config';
import { createAuthMiddleware } from './middleware/auth';
import { requestLogger } from './middleware/logging';
import { captureAttackTrace } from './middleware/attack-trace';
import { logger } from './utils/logger';
import { ProgressionClient } from './services/progression-client';
import { ProgressionService } from './services/progression-service';
import { IUserRepository } from './repositories/user-repository';
import { AuthService } from './services/auth-service';
import { AuthRateLimiter } from './services/auth-rate-limiter';
import { createAuthRoutes, csrfErrorHandler } from './routes/auth';
import { createRoutes } from './routes';
import { createRealmGate } from './middleware/realm-gate';

async function main() {
  // Configure DI container
  const container = configureContainer();
  const config = container.resolve<any>('Config');

  const app = express();

  // Disable X-Powered-By header for security
  app.disable('x-powered-by');

  // CORS middleware (before other middleware)
  const corsMiddleware = createCorsMiddleware(config.allowedOrigin);
  app.use(corsMiddleware);

  // Security headers (must be before static files to apply headers to all responses)
  const securityHeadersMiddleware = enhancedSecurityHeaders(config.nodeEnv);
  app.use(securityHeadersMiddleware);

  // Serve static files from frontend build
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));

  // Body parsing
  app.use(express.json());

  // Session management
  const sessionMiddleware = createSessionMiddleware(config);
  app.use(sessionMiddleware);

  // Request logging
  app.use(requestLogger);

  // Attack trace logging (for AI training)
  app.use(captureAttackTrace);

  // Resolve services from container
  const userRepository = container.resolve<IUserRepository>('IUserRepository');
  const authService = container.resolve(AuthService);
  const authRateLimiter = container.resolve(AuthRateLimiter);
  const authMiddleware = createAuthMiddleware(userRepository);
  const progressionClient = container.resolve(ProgressionClient);
  const progressionService = container.resolve(ProgressionService);
  const realmGate = createRealmGate(progressionService);

  // Auth routes
  const authRoutes = createAuthRoutes(
    authService,
    authRateLimiter,
    authMiddleware.requireAuth,
    authMiddleware.ensureSession
  );
  app.use('/', authRoutes);

  // Main routes (with auth and realm gating)
  const routes = createRoutes(
    config.realms,
    progressionClient,
    progressionService,
    authMiddleware,
    realmGate,
    path.join(__dirname, 'public', 'index.html') // Pass path for landing page
  );
  app.use('/', routes);

  // CSRF error handler (must be after routes)
  app.use(csrfErrorHandler);

  // Generic error handler
  app.use((err: any, req: any, res: any, _next: any) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
    console.error('[Gatekeeper] Error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  });

  app.listen(config.port, () => {
    logger.info('Gatekeeper started', {
      port: config.port,
      environment: config.nodeEnv,
      flagOracleUrl: config.flagOracleUrl,
      realmCount: config.realms.length,
    });
    console.info(`[Gatekeeper] Listening on port ${config.port}`);
    console.info(`[Gatekeeper] Environment: ${config.nodeEnv}`);
    console.info(`[Gatekeeper] Flag Oracle URL: ${config.flagOracleUrl}`);
    console.info(
      `[Gatekeeper] Configured realms: ${config.realms.map((r: any) => r.name).join(', ')}`
    );
  });
}

main().catch((error) => {
  console.error('[Gatekeeper] Fatal error starting:', error);
  process.exit(1);
});
