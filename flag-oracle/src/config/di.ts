import { container } from 'tsyringe';
import { loadConfig } from '../config';
import { FlagService } from '../services/flag-service';
import { ProgressionService } from '../services/progression-service';
import { FlagValidator } from '../services/flag-validator';
import { ProgressionValidator } from '../services/progression-validator';
import { RateLimiter } from '../services/rate-limiter';
import { FlagRepository, IFlagRepository } from '../repositories/flag-repository';

export function configureContainer() {
  const config = loadConfig();

  // Register Config
  container.register('Config', { useValue: config });

  // Register RateLimitConfig separately as it's a specific object, not the full config
  container.register('RateLimitConfig', { 
    useValue: {
      windowMs: config.rateLimitWindowMs,
      maxRequests: config.rateLimitMaxRequests
    }
  });

  // Register Repositories
  container.register(FlagRepository, { useClass: FlagRepository });
  // Also register as interface if needed for injection
  // Note: Since we use string injection token 'IFlagRepository' or class 'FlagRepository' in constructor
  // We need to ensure consistency.
  container.register('FlagRepository', { useClass: FlagRepository });
  container.register('IFlagRepository', { useClass: FlagRepository });


  // Register Services
  container.register(FlagService, { 
    useFactory: (c) => new FlagService({ masterSecret: config.flagMasterSecret })
  });
  
  // Note: ProgressionService constructor signature might need to align with injection
  // If it injects FlagRepository class, this works. If interface, might need token.
  container.register(ProgressionService, { useClass: ProgressionService });
  
  container.register(FlagValidator, { useClass: FlagValidator });
  container.register(ProgressionValidator, { useClass: ProgressionValidator });
  
  // RateLimiter now takes config object injected via 'RateLimitConfig'
  container.register(RateLimiter, { useClass: RateLimiter });
  
  return container;
}
