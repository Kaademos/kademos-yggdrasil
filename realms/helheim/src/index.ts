/**
 * Helheim — A09:2025 Logging & Alerting Failures
 *
 * Helheim runs the Níðhöggr SIEM, the central log-correlation service every other
 * realm forwards to. The realm's subject is the half of A09 that the 2025 rename
 * exists to emphasise: logging that is complete, accurate, and useless, because
 * nothing downstream of it ever reaches a human.
 *
 * The flag is not stored anywhere. It is emitted as the body of an alert, and
 * only once that alert has survived every stage of the pipeline.
 *
 * Exported `createApp` so integration tests can drive the realm without binding
 * a port.
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { loadConfig, RealmConfig } from './config';
import { createHealthRouter } from './routes/health';
import { requestLogger, errorLogger } from './middleware/logging';
import { createMemorialRouter } from './routes/memorial';
import { createAdminRouter } from './routes/admin';
import { createSocRouter } from './routes/soc';
import { createSocAuth } from './middleware/soc-auth';
import { SocState } from './services/soc-state';
import { seedLogArchive } from './services/log-archive';

/**
 * Create and configure Express application
 */
export function createApp(config: RealmConfig): express.Application {
  const app = express();
  const state = new SocState(config.flag);
  const socAuth = createSocAuth(config);

  // Materialise the flat log archive, including the correlation log that
  // Niflheim's crash diagnostics point at.
  seedLogArchive();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (config.nodeEnv === 'development') {
    app.use(requestLogger);
  }

  app.use(express.static(path.join(__dirname, '../public')));

  app.use(createHealthRouter(config));

  // Public memorial forum. Feeds benign traffic into the correlation archive.
  app.use(createMemorialRouter(config, state));

  // SOC console and correlation API. Gated on the credential Niflheim leaks.
  // Scoped by path prefix so the public forum and health check stay open.
  app.use(['/admin', '/api/soc'], socAuth);
  app.use(createAdminRouter());
  app.use(createSocRouter(state));

  /**
   * The former public log drop. Retired: it embedded the realm flag in every
   * stack trace, which taught CWE-532 rather than this realm's category. Answers
   * 410 rather than 404 so older walkthroughs get an explanation instead of a
   * dead end.
   */
  app.use('/temp_logs', (_req: Request, res: Response) => {
    res.status(410).json({
      error: 'Gone',
      message:
        'The public log drop was retired. Log records are redacted before write and ' +
        'served from the SOC archive at GET /admin/logs.',
      note:
        'Reading logs was never the gap here. Nothing raises an alert on what they contain.',
    });
  });

  // Helheim landing page
  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  if (config.nodeEnv === 'development') {
    app.use(errorLogger);
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
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
    console.info('Nidhoggr SIEM: archive seeded, alert pipeline UNVERIFIED');
  });
}

// Start the server unless imported by a test harness.
if (require.main === module) {
  main().catch((error) => {
    console.error(`Fatal error starting realm:`, error);
    process.exit(1);
  });
}
