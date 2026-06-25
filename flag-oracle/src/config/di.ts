import { container } from 'tsyringe';
import { loadConfig } from '../config';
import { FlagService } from '../services/flag-service';
import { ProgressionService } from '../services/progression-service';
import { FlagValidator } from '../services/flag-validator';
import { ProgressionValidator } from '../services/progression-validator';
import { RateLimiter } from '../services/rate-limiter';
import { ScoringService } from '../services/scoring-service';
import { HintService } from '../services/hint-service';
import { DiscordBroadcaster } from '../services/discord-broadcaster';
import { FlagRepository } from '../repositories/flag-repository';
import { RepositoryFactory } from '../repositories/repository-factory';

export function configureContainer() {
  const config = loadConfig();

  // Register Config
  container.register('Config', { useValue: config });

  // Register RateLimitConfig separately as it's a specific object, not the full config
  container.register('RateLimitConfig', {
    useValue: {
      windowMs: config.rateLimitWindowMs,
      maxRequests: config.rateLimitMaxRequests,
    },
  });

  // Register Repositories.
  // The active repository is selected by RepositoryFactory: Redis (primary) when
  // REDIS_URL is set, otherwise file-based. A single shared instance is used so the
  // in-memory connection/state is reused across the app.
  const repository = RepositoryFactory.create({
    redisUrl: config.redisUrl,
    dataPath: config.dataPath,
  });
  container.register('IFlagRepository', { useValue: repository });
  // Keep the concrete class registered for any direct consumers.
  container.register(FlagRepository, { useClass: FlagRepository });

  // Register Services
  container.register(FlagService, {
    useFactory: () => new FlagService({ masterSecret: config.flagMasterSecret }),
  });

  container.register(ProgressionService, { useClass: ProgressionService });
  container.register(FlagValidator, { useClass: FlagValidator });
  container.register(ProgressionValidator, { useClass: ProgressionValidator });
  container.register(ScoringService, { useClass: ScoringService });
  container.register(HintService, { useClass: HintService });
  container.register(DiscordBroadcaster, { useClass: DiscordBroadcaster });

  // RateLimiter now takes config object injected via 'RateLimitConfig'
  container.register(RateLimiter, { useClass: RateLimiter });

  return container;
}
