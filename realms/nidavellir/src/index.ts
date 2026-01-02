/**
 * Nidavellir Realm Entry Point
 * 
 * OWASP A05:2025 - Injection (SQL Injection)
 * Demonstrates SQL injection vulnerability in search functionality
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { loadConfig, RealmConfig } from './config';
import { createHealthRouter } from './routes/health';
import { createSearchRouter } from './routes/search';
import { requestLogger, errorLogger } from './middleware/logging';
import { DatabaseService } from './services/database';
import { SearchService } from './services/search-service';

/**
 * Create and configure Express application
 */
async function createApp(config: RealmConfig): Promise<express.Application> {
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

  // Initialize database connection
  const db = new DatabaseService(config.databaseUrl);
  
  // Wait for database to be ready
  console.log('[Nidavellir] Waiting for database connection...');
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const isHealthy = await db.healthCheck();
      if (isHealthy) {
        console.log('[Nidavellir] Database connected successfully');
        break;
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error('Database connection failed after retries');
      }
      console.log(`[Nidavellir] Database not ready, retrying... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Create service instances
  const searchService = new SearchService(db);

  // Mount health check router
  app.use(createHealthRouter(config));

  // Mount search routes (contains vulnerability)
  app.use(createSearchRouter(config, searchService));

  // Default landing page - serve index.html
  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;

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
  const app = await createApp(config);

  app.listen(config.port, () => {
    console.info(`⛏️  NIDAVELLIR - Mining Facility`);
    console.info(`   Listening on port ${config.port}`);
    console.info(`   Environment: ${config.nodeEnv}`);
    console.info(`   Vulnerability: A05:2025 SQL Injection`);
    console.info(`   Flag loaded: ${config.flag.substring(0, 30)}...`);
  });
}

// Start the server
main().catch((error) => {
  console.error(`Fatal error starting realm:`, error);
  process.exit(1);
});
