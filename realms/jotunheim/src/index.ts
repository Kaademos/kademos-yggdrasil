/**
 * Jotunheim Realm Entry Point
 * 
 * OWASP A07:2025 - Authentication Failures
 * Demonstrates session fixation vulnerability
 */

import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'path';
import { loadConfig, RealmConfig } from './config';
import { createHealthRouter } from './routes/health';
import { createAuthRouter } from './routes/auth';
import { createAdminRouter } from './routes/admin';
import { requestLogger, errorLogger } from './middleware/logging';
import { AuthService } from './services/auth-service';
import { SessionManager } from './services/session-manager';

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    sessionId?: string;
    isAuthenticated?: boolean;
    username?: string;
    role?: string;
  }
}

/**
 * Create and configure Express application
 */
function createApp(config: RealmConfig): express.Application {
  const app = express();

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session middleware - VULNERABLE CONFIGURATION
  // No secure flag in development, resave and saveUninitialized set to false
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        maxAge: 1000 * 60 * 60, // 1 hour
      },
      name: 'connect.sid',
    })
  );

  // Logging middleware (in development mode)
  if (config.nodeEnv === 'development') {
    app.use(requestLogger);
  }

  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, 'public')));

  // Create service instances
  const authService = new AuthService();
  const sessionManager = new SessionManager();

  // Mount health check router
  app.use(createHealthRouter(config));

  // Mount authentication routes (with session manager)
  app.use(createAuthRouter(config, authService, sessionManager));

  // Mount admin routes (with session manager)
  app.use(createAdminRouter(config, authService, sessionManager));

  // Default landing page - serve index.html
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
    console.info(`⚡ JOTUNHEIM - Ice Giant Stronghold`);
    console.info(`   Listening on port ${config.port}`);
    console.info(`   Environment: ${config.nodeEnv}`);
    console.info(`   Vulnerability: A07:2025 Authentication Failures`);
    console.info(`   Flag loaded: ${config.flag.substring(0, 25)}...`);
  });
}

// Start the server
main().catch((error) => {
  console.error(`Fatal error starting realm:`, error);
  process.exit(1);
});
