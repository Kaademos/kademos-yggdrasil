/**
 * Realm Template Entry Point
 * 
 * This template provides a standardized structure for all Yggdrasil realms.
 * To use this template:
 * 1. Copy this directory to /realms/<realm-name>
 * 2. Update package.json (name, description)
 * 3. Update config/index.ts with realm-specific config
 * 4. Implement realm-specific routes
 * 5. Add your vulnerability implementation
 * 6. Update README.md with realm details
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { loadConfig, RealmConfig } from './config';
import { createHealthRouter } from './routes/health';
import { requestLogger, errorLogger } from './middleware/logging';

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
  app.use(express.static(path.join(__dirname, '../public')));

  // Mount health check router
  app.use(createHealthRouter(config));

  // TODO: Add realm-specific routes here
  // Example:
  // import { createRealmRouter } from './routes/realm';
  // app.use(createRealmRouter(config));

  // Default landing page (customize per realm)
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${config.realmName} - Yggdrasil</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
            color: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .container {
            text-align: center;
            background: rgba(0, 0, 0, 0.3);
            padding: 3rem;
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 600px;
          }
          h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
          }
          p {
            font-size: 1.2rem;
            margin: 1rem 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚡ ${config.realmName.toUpperCase()} Realm</h1>
          <p>Welcome to the ${config.realmName} realm of Yggdrasil.</p>
          <p><em>TODO: Customize this page with realm-specific content</em></p>
        </div>
      </body>
      </html>
    `);
  });

  // Error logging middleware
  if (config.nodeEnv === 'development') {
    app.use(errorLogger);
  }

  // Error handling middleware (must be last)
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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
    console.info(`${config.realmName.toUpperCase()} Realm listening on port ${config.port}`);
    console.info(`Environment: ${config.nodeEnv}`);
    console.info(`Flag loaded: ${config.flag.substring(0, 20)}...`);
  });
}

// Start the server
main().catch((error) => {
  console.error(`Fatal error starting realm:`, error);
  process.exit(1);
});
