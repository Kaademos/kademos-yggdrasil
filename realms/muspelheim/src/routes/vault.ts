/**
 * Vault Routes
 * 
 * Controls access to the flag
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { VaultService } from '../services/vault-service';
import { TradingService } from '../services/trading-service';

export function createVaultRouter(
  config: RealmConfig,
  vaultService: VaultService,
  tradingService: TradingService
): Router {
  const router = Router();

  /**
   * GET /api/vault
   * 
   * Access vault (requires exploitation)
   */
  router.get('/api/vault', (req: Request, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const exploited = tradingService.hasExploited(userId);
    const result = vaultService.accessVault(exploited);

    return res.status(result.access ? 200 : 403).json(result);
  });

  return router;
}
