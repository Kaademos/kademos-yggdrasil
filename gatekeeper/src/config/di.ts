import { container } from 'tsyringe';
import { loadConfig } from '../config';
import { IUserRepository, UserRepositoryFactory } from '../repositories/user-repository';
import { AuthService } from '../services/auth-service';
import { AuthRateLimiter } from '../services/auth-rate-limiter';
import { ProgressionClient } from '../services/progression-client';
import { ProgressionService } from '../services/progression-service';
import { Logger } from '../services/logger';

export function configureContainer() {
  const config = loadConfig();

  // Register Config
  container.register('Config', { useValue: config });

  // Register Repositories
  const userRepository = UserRepositoryFactory.create(config.bcryptRounds, config.testUserPassword);
  container.register('UserRepository', { useValue: userRepository });
  container.register('IUserRepository', { useValue: userRepository });

  // Register Services
  container.register(AuthService, { useClass: AuthService });
  
  // Register Rate Limiter with factory to pass config values
  container.register(AuthRateLimiter, {
    useFactory: (c) => {
      return new AuthRateLimiter(
        config.authRateLimitWindowMs,
        config.authRateLimitMaxRequests
      );
    }
  });

  // Register Progression Client with factory
  container.register(ProgressionClient, {
    useFactory: (c) => {
      return new ProgressionClient(config.flagOracleUrl);
    }
  });

  container.register(ProgressionService, { useClass: ProgressionService });
  
  // Logger is static, but we can register it if needed for instance-based logging later
  // For now, services use static Logger class
  
  return container;
}
