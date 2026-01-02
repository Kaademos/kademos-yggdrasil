/**
 * Asgard Realm Entry Point
 * 
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { loadConfig, RealmConfig } from './config';
import { createHealthRouter } from './routes/health';
import { createAsgardRouter } from './routes/asgard';
import { createInternalRouter } from './routes/internal';
import { createAuthRouter } from './routes/auth';
import { requestLogger, errorLogger } from './middleware/logging';
import { DatabaseService } from './services/database';
import { DocumentService } from './services/document-service';
import { EmployeeService } from './services/employee-service';
import { ScreenshotService } from './services/screenshot-service';

async function createApp(config: RealmConfig): Promise<express.Application> {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (config.nodeEnv === 'development') {
    app.use(requestLogger);
  }

  app.use(express.static(path.join(__dirname, 'public')));

  // Initialize database
  const db = new DatabaseService(config.databaseUrl);
  console.log('[Asgard] Connecting to database...');
  for (let i = 0; i < 10; i++) {
    try {
      if (await db.healthCheck()) {
        console.log('[Asgard] Database ready');
        break;
      }
    } catch (error) {
      if (i === 9) throw new Error('Database connection failed');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const documentService = new DocumentService(db);
  const employeeService = new EmployeeService(db);
  const screenshotService = new ScreenshotService();

  app.use(createHealthRouter(config));
  app.use(createAsgardRouter(config, documentService, employeeService, screenshotService));
  
  
  app.use('/api/internal', createInternalRouter());
  
  
  app.use('/api/auth', createAuthRouter(db));

  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  if (config.nodeEnv === 'development') {
    app.use(errorLogger);
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      error: config.nodeEnv === 'development' ? err.message : 'Internal Server Error',
    });
  });

  return app;
}

async function main() {
  const config = loadConfig();
  
  const app = await createApp(config);
  
  app.listen(config.port, () => {
    console.info(`🏛️  ASGARD - Golden Citadel`);
    console.info(`   Port ${config.port} (HR Portal)`);
    console.info(`   OWASP: A01:2025 - BAC + SSRF`);
    console.info(``);
    console.info(`   ℹ️  Metadata service runs separately`);
    console.info(`   ℹ️  Start with: npm run start:metadata`);
  });
}

main().catch((error) => {
  console.error(`Fatal error:`, error);
  process.exit(1);
});
