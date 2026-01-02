/**
 *
 * 
 * 
 * SPOILER: Withdrawal endpoint has race condition allowing multiple concurrent withdrawals
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { BalanceService } from '../services/balance-service';
import { AuditService } from '../services/audit-service';

export function createRaceConditionRouter(
  config: RealmConfig,
  balanceService: BalanceService,
  auditService: AuditService
): Router {
  const router = Router();

  /**
   * POST /api/loan/create
   * Initialize loan account with starting balance
   */
  router.post('/api/loan/create', async (req: Request, res: Response) => {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    try {
      balanceService.initializeAccount(userId, 1000);
      const balance = await balanceService.getBalance(userId);

      res.json({
        success: true,
        message: 'Loan account created',
        account: {
          userId,
          initialBalance: 1000,
          currentBalance: balance,
        },
        hint: 'Use /api/loan/withdraw to withdraw funds',
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Failed to create account');
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * GET /api/loan/balance
   * Get current balance
   */
  router.get('/api/loan/balance', async (req: Request, res: Response) => {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    try {
      const record = balanceService.getBalanceRecord(userId);
      
      if (!record) {
        return res.status(404).json({
          success: false,
          error: 'Account not found',
          hint: 'Create account first via /api/loan/create',
        });
      }

      res.json({
        success: true,
        account: {
          userId: record.userId,
          balance: record.balance,
          totalDeposited: record.totalDeposited,
          totalWithdrawn: record.totalWithdrawn,
          withdrawalCount: record.withdrawalCount,
        },
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Failed to create account');
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * POST /api/loan/withdraw
   * 
   * VULNERABLE: Race condition in withdrawal process
   * 
   * EXPLOIT:
   * 1. Send multiple concurrent POST requests with same userId and amount
   * 2. All requests pass balance check simultaneously
   * 3. Async delay creates race window
   * 4. All requests complete, withdrawing more than available balance
   * 5. Check /api/audit to get flag when impossible state detected
   */
  router.post('/api/loan/withdraw', async (req: Request, res: Response) => {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'userId and amount are required',
      });
    }

    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
      });
    }

    try {
      // VULNERABLE: Withdrawal with race condition
      await balanceService.withdraw(userId, withdrawAmount);
      
      const newBalance = await balanceService.getBalance(userId);

      res.json({
        success: true,
        message: `Withdrawn ${withdrawAmount} FIRE tokens`,
        balance: newBalance,
        timestamp: Date.now(),
        hint: 'Try sending multiple concurrent requests to exploit the race condition',
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Withdrawal failed');
      res.status(400).json({
        success: false,
        error: err.message,
        hint: 'Make sure account exists and has sufficient balance',
      });
    }
  });

  /**
   * POST /api/loan/deposit
   * Deposit funds
   */
  router.post('/api/loan/deposit', async (req: Request, res: Response) => {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'userId and amount are required',
      });
    }

    const depositAmount = parseFloat(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
      });
    }

    try {
      await balanceService.deposit(userId, depositAmount);
      const newBalance = await balanceService.getBalance(userId);

      res.json({
        success: true,
        message: `Deposited ${depositAmount} FIRE tokens`,
        balance: newBalance,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Failed to create account');
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * GET /api/audit
   * 
   * Audit account for anomalies
   * 
   * VULNERABLE: Returns flag as incidentId when race condition exploitation detected
   * EXPLOIT: After exploiting race condition, call this endpoint to get the flag
   */
  router.get('/api/audit', async (req: Request, res: Response) => {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    try {
      const auditReport = await auditService.auditAccount(userId);

      res.json({
        success: true,
        audit: auditReport,
        warning: auditReport.anomalyDetected 
          ? '⚠️ CRITICAL ANOMALY DETECTED - Check incidentId for details'
          : 'Account activity normal',
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Failed to create account');
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * GET /api/audit/system
   * System-wide audit summary
   */
  router.get('/api/audit/system', async (req: Request, res: Response) => {
    try {
      const summary = await auditService.getSystemAudit();

      res.json({
        success: true,
        summary,
        description: 'System-wide audit of all loan accounts',
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Failed to create account');
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * GET /api/loan/history
   * Get withdrawal history
   */
  router.get('/api/loan/history', async (req: Request, res: Response) => {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    try {
      const history = balanceService.getWithdrawalHistory(userId);

      res.json({
        success: true,
        count: history.length,
        history,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Failed to create account');
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * GET /debug/race-info
   * 
   * VULNERABLE: Debug endpoint explaining the race condition
   */
  router.get('/debug/race-info', (req: Request, res: Response) => {
    res.json({
      success: true,
      vulnerability: 'TOCTOU (Time-Of-Check-Time-Of-Use) Race Condition',
      owasp: 'A06:2025 - Insecure Design',
      description: 'Withdrawal endpoint has async delay between balance check and update',
      exploitation: {
        step1: 'Create account via POST /api/loan/create with {"userId":"user1"}',
        step2: 'Note initial balance (1000 FIRE)',
        step3: 'Send 10 concurrent POST requests to /api/loan/withdraw with {"userId":"user1","amount":"300"}',
        step4: 'All requests pass balance check before any completes',
        step5: 'Total withdrawn = 3000 FIRE (3x available balance)',
        step6: 'Call GET /api/audit?userId=user1 to get flag in incidentId',
      },
      hint: 'Use Promise.all() or parallel curl requests to exploit the race window',
      raceWindow: '150-250ms (simulated processing delay)',
      exploitPayload: `
// JavaScript example:
const userId = 'attacker';
const requests = Array(10).fill(null).map(() =>
  fetch('/api/loan/withdraw', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({userId, amount: 300})
  })
);
await Promise.all(requests);

// Check audit for flag
const audit = await fetch('/api/audit?userId=attacker').then(r => r.json());
console.log('Flag:', audit.audit.incidentId);
      `.trim(),
    });
  });

  return router;
}
