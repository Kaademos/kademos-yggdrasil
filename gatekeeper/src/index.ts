import express from 'express';
import path from 'path';
import { loadConfig } from './config';
import { enhancedSecurityHeaders } from './middleware/security-headers';
import { createSessionMiddleware } from './middleware/session';
import { createCorsMiddleware } from './middleware/cors-config';
import { createAuthMiddleware } from './middleware/auth';
import { requestLogger } from './middleware/logging';
import { logger } from './utils/logger';
import { ProgressionClient } from './services/progression-client';
import { ProgressionService } from './services/progression-service';
import { UserRepositoryFactory } from './repositories/user-repository';
import { AuthService } from './services/auth-service';
import { AuthRateLimiter } from './services/auth-rate-limiter';
import { createAuthRoutes, csrfErrorHandler } from './routes/auth';
import { createRoutes } from './routes';
import { createRealmGate } from './middleware/realm-gate';

async function main() {
  const config = loadConfig();

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

  // Initialize services
  const userRepository = UserRepositoryFactory.create(config.bcryptRounds, config.testUserPassword);
  const authService = new AuthService(userRepository, config.bcryptRounds);
  const authRateLimiter = new AuthRateLimiter(
    config.authRateLimitWindowMs,
    config.authRateLimitMaxRequests
  );
  const authMiddleware = createAuthMiddleware(userRepository);
  const progressionClient = new ProgressionClient(config.flagOracleUrl);
  const progressionService = new ProgressionService(progressionClient);
  const realmGate = createRealmGate(progressionService);

  // Auth routes
  const authRoutes = createAuthRoutes(authService, authRateLimiter, authMiddleware.requireAuth);
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
    console.info(`[Gatekeeper] Configured realms: ${config.realms.map((r) => r.name).join(', ')}`);
  });
}

main().catch((error) => {
  console.error('[Gatekeeper] Fatal error starting:', error);
  process.exit(1);
});
