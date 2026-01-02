/**
 * Trading Routes
 * 
 * Handles flash loan and trading operations
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { TradingService } from '../services/trading-service';
import { AccountService } from '../services/account-service';

export function createTradingRouter(
  config: RealmConfig,
  tradingService: TradingService,
  accountService: AccountService
): Router {
  const router = Router();

  /**
   * GET /api/account/:userId
   * 
   * Get account information
   */
  router.get('/api/account/:userId', (req: Request, res: Response) => {
    const { userId } = req.params;
    const account = accountService.getAccount(userId);

    return res.status(200).json({
      userId: account.userId,
      balance: account.balance,
      collateral: account.collateral,
      loanActive: account.loanActive,
      loanAmount: account.loanAmount,
      exploited: account.exploited,
      transactionCount: account.transactions.length,
    });
  });

  /**
   * GET /api/account/:userId/transactions
   * 
   * Get account transaction history
   */
  router.get('/api/account/:userId/transactions', (req: Request, res: Response) => {
    const { userId } = req.params;
    const account = accountService.getAccount(userId);

    return res.status(200).json({
      transactions: account.transactions,
    });
  });

  /**
   * POST /api/flash-loan
   * 
   * Execute flash loan (VULNERABLE)
   */
  router.post('/api/flash-loan', (req: Request, res: Response) => {
    const { userId, amount } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    const result = tradingService.executeFlashLoan(userId, amount);

    if (result.exploited) {
      return res.status(200).json({
        ...result,
        hint: 'The vault may now be accessible...',
      });
    }

    return res.status(200).json(result);
  });

  /**
   * POST /api/deposit
   * 
   * Deposit funds (safe operation)
   */
  router.post('/api/deposit', (req: Request, res: Response) => {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ error: 'userId and amount required' });
    }

    const result = tradingService.deposit(userId, amount);
    return res.status(result.success ? 200 : 400).json(result);
  });

  /**
   * POST /api/withdrawal
   * 
   * Withdraw funds (safe operation)
   */
  router.post('/api/withdrawal', (req: Request, res: Response) => {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ error: 'userId and amount required' });
    }

    const result = tradingService.withdrawal(userId, amount);
    return res.status(result.success ? 200 : 400).json(result);
  });

  return router;
}
