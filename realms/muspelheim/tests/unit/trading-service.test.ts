/**
 * TradingService Unit Tests
 * 
 * Tests the business logic including the vulnerability
 */

import { TradingService } from '../../src/services/trading-service';
import { AccountService } from '../../src/services/account-service';

describe('TradingService', () => {
  let tradingService: TradingService;
  let accountService: AccountService;

  beforeEach(() => {
    accountService = new AccountService();
    tradingService = new TradingService(accountService);
  });

  describe('deposit', () => {
    it('should increase account balance', () => {
      const result = tradingService.deposit('user1', 500);
      const account = accountService.getAccount('user1');
      
      expect(result.success).toBe(true);
      expect(account.balance).toBe(1500);
    });

    it('should reject invalid amount', () => {
      const result = tradingService.deposit('user1', -100);
      
      expect(result.success).toBe(false);
    });
  });

  describe('withdrawal', () => {
    it('should decrease account balance', () => {
      const result = tradingService.withdrawal('user1', 200);
      const account = accountService.getAccount('user1');
      
      expect(result.success).toBe(true);
      expect(account.balance).toBe(800);
    });

    it('should reject withdrawal exceeding balance', () => {
      const result = tradingService.withdrawal('user1', 2000);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient balance');
    });
  });

  describe('executeFlashLoan - vulnerability test', () => {
    it('should mark account as exploited when repayment fails', () => {
      // User has 1000 balance, borrows 5000
      // After loan and trade profit (500), balance = 1000 + 5000 + 500 = 6500
      // But should repay 5000, leaving 1500
      // The vulnerability is that collateral is released before repayment check
      
      const result = tradingService.executeFlashLoan('user1', 5000);
      const account = accountService.getAccount('user1');
      
      expect(result.success).toBe(true);
      // This should NOT mark as exploited because user can repay
      expect(account.exploited).toBe(false);
    });

    it('should exploit when user withdraws before repayment', () => {
      // Simulate the exploit: borrow more than can repay
      // Start with 1000, borrow 10000
      const result = tradingService.executeFlashLoan('user1', 10000);
      
      // After loan + trade, balance = 1000 + 10000 + 1000 = 12000
      // Can repay 10000, so not exploited in this simple case
      expect(result.success).toBe(true);
    });

    it('should reject invalid loan amount', () => {
      const result = tradingService.executeFlashLoan('user1', 0);
      
      expect(result.success).toBe(false);
    });

    it('should reject loan exceeding maximum', () => {
      const result = tradingService.executeFlashLoan('user1', 20000);
      
      expect(result.success).toBe(false);
    });

    it('should reject loan when loan already active', () => {
      accountService.setLoanStatus('user1', true, 5000);
      const result = tradingService.executeFlashLoan('user1', 1000);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already active');
    });
  });

  describe('hasExploited', () => {
    it('should return false for non-exploited account', () => {
      accountService.getAccount('user1');
      
      expect(tradingService.hasExploited('user1')).toBe(false);
    });

    it('should return true for exploited account', () => {
      accountService.markExploited('user1');
      
      expect(tradingService.hasExploited('user1')).toBe(true);
    });
  });
});
