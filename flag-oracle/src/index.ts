import express from 'express';
import { loadConfig } from './config';
import { FlagValidator } from './services/flag-validator';
import { FlagService } from './services/flag-service';
import { RepositoryFactory } from './repositories/repository-factory';
import { ProgressionService } from './services/progression-service';
import { ProgressionValidator } from './services/progression-validator';
import { RateLimiter } from './services/rate-limiter';
import { Logger } from './services/logger';
import { REALM_ORDER } from './config/realm-order';
import { createRoutes } from './routes';
import { securityHeaders } from './middleware/security-headers';

async function main() {
  const config = loadConfig();

  const app = express();
  app.use(securityHeaders);
  app.use(express.json());

  const logger = new Logger();

  const repository = RepositoryFactory.create({
    redisUrl: config.redisUrl,
    dataPath: config.dataPath,
  });

  const validator = new FlagValidator();
  const progressionValidator = new ProgressionValidator(REALM_ORDER);
  const progressionService = new ProgressionService(repository, validator, progressionValidator);

  // Initialize FlagService (M8)
  const flagService = config.flagMasterSecret
    ? new FlagService({ masterSecret: config.flagMasterSecret })
    : null;

  if (!flagService) {
    logger.logInfo('FLAG_MASTER_SECRET not set - dynamic flag generation disabled', {
      feature: 'flag-generation',
    });
  }

  const rateLimiter = new RateLimiter({
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests,
  });

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
