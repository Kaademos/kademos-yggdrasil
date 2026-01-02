/**
 * Vanaheim Realm Entry Point
 * 
 * OWASP A04:2025 - Cryptographic Failures
 * Demonstrates predictable PRNG-based token generation vulnerability
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { loadConfig, RealmConfig } from './config';
import { createHealthRouter } from './routes/health';
import { createVanaheimRouter } from './routes/vanaheim';
import { requestLogger, errorLogger } from './middleware/logging';
import { TokenService } from './services/token-service';
import { AuthService } from './services/auth-service';

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

  // Initialize services with config
  const tokenService = new TokenService(config.maxTokenHistory, config.tokenSeedMultiplier);
  const authService = new AuthService(tokenService);

  // Mount health check router
  app.use(createHealthRouter(config));

  // Mount Vanaheim routes
  app.use(createVanaheimRouter(config, tokenService, authService));

  // Default landing page - serve index.html from public
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
    console.info(`⚖️  VANAHEIM - Merchant Realm`);
    console.info(`   Listening on port ${config.port}`);
    console.info(`   Environment: ${config.nodeEnv}`);
    console.info(`   OWASP: A04:2025 - Cryptographic Failures`);
    console.info(`   Vulnerability: Weak PRNG Token Generation`);
  });
}

// Start the server
main().catch((error) => {
  console.error(`Fatal error starting realm:`, error);
  process.exit(1);
});
