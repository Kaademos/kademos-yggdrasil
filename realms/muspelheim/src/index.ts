/**
 * Muspelheim Realm Entry Point
 * 
 *
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { loadConfig, RealmConfig } from './config';
import { createHealthRouter } from './routes/health';
import { createTradingRouter } from './routes/trading';
import { createVaultRouter } from './routes/vault';
import { requestLogger, errorLogger } from './middleware/logging';
import { AccountService } from './services/account-service';
import { TradingService } from './services/trading-service';
import { VaultService } from './services/vault-service';
import { BalanceService } from './services/balance-service';
import { AuditService } from './services/audit-service';
import { createRaceConditionRouter } from './routes/race-condition';

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
  app.use(express.static(path.join(__dirname, 'public')));

  // Create service instances
  const accountService = new AccountService();
  const tradingService = new TradingService(accountService);
  const vaultService = new VaultService(config.flag);
  
  const balanceService = new BalanceService();
  const auditService = new AuditService(balanceService, config.flag);

  // Mount health check router
  app.use(createHealthRouter(config));

  // Mount trading routes
  app.use(createTradingRouter(config, tradingService, accountService));

  // Mount vault routes
  app.use(createVaultRouter(config, vaultService, tradingService));
  
  // 
  app.use(createRaceConditionRouter(config, balanceService, auditService));

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
    console.info(`🔥 MUSPELHEIM - Fire Realm Trading Post`);
    console.info(`   Listening on port ${config.port}`);
    console.info(`   Environment: ${config.nodeEnv}`);
    console.info(`   Vulnerability: A06:2025 Insecure Design`);
    console.info(`   Flag loaded: ${config.flag.substring(0, 30)}...`);
  });
}

// Start the server
main().catch((error) => {
  console.error(`Fatal error starting realm:`, error);
  process.exit(1);
});
