import 'reflect-metadata';
import express from 'express';
import { configureContainer } from './config/di';
import { Config } from './config';
import { FlagService } from './services/flag-service';
import { ProgressionService } from './services/progression-service';
import { RateLimiter } from './services/rate-limiter';
import { Logger } from './services/logger';
import { createRoutes } from './routes';
import { securityHeaders } from './middleware/security-headers';

async function main() {
  const container = configureContainer();
  const config = container.resolve<Config>('Config');

  const app = express();
  // Don't advertise the framework to callers. Gatekeeper does the same via helmet;
  // Flag Oracle hand-rolls its headers, so this has to be explicit.
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(express.json());

  const logger = new Logger();

  const progressionService = container.resolve(ProgressionService);
  const rateLimiter = container.resolve(RateLimiter);

  // FlagService requires a strong FLAG_MASTER_SECRET (>=32 chars) and throws otherwise.
  // Dynamic flag generation is an optional feature, so a missing/weak secret must not
  // crash the service — it simply disables the /generate endpoint.
  let flagService: FlagService | null = null;
  try {
    flagService = container.resolve(FlagService);
  } catch (error) {
    logger.logInfo('Dynamic flag generation disabled (FLAG_MASTER_SECRET not set or too weak)', {
      feature: 'flag-generation',
      reason: (error as Error).message,
    });
  }

  const routes = createRoutes({ progressionService, rateLimiter, logger, flagService });
  app.use('/', routes);

  app.listen(config.port, () => {
    console.info(`Flag Oracle listening on port ${config.port}`);
    console.info(`Environment: ${config.nodeEnv}`);
    console.info(`Data path: ${config.dataPath}`);
    if (config.redisUrl) {
      console.info(`Redis: ${config.redisUrl}`);
    } else {
      console.info('Redis: Disabled (using file-based storage)');
    }
  });
}

main().catch((error) => {
  console.error('Fatal error starting Flag Oracle:', error);
  process.exit(1);
});
