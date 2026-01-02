/**
 * AccountService Unit Tests
 */

import { AccountService } from '../../src/services/account-service';

describe('AccountService', () => {
  let accountService: AccountService;

  beforeEach(() => {
    accountService = new AccountService();
  });

  describe('getAccount', () => {
    it('should create new account if not exists', () => {
      const account = accountService.getAccount('user1');
      
      expect(account).toBeDefined();
      expect(account.userId).toBe('user1');
      expect(account.balance).toBe(1000);
      expect(account.loanActive).toBe(false);
    });

    it('should return existing account on subsequent calls', () => {
      const account1 = accountService.getAccount('user1');
      account1.balance = 500;
      
      const account2 = accountService.getAccount('user1');
      
      expect(account2.balance).toBe(500);
    });
  });

  describe('updateBalance', () => {
    it('should increase balance', () => {
      accountService.updateBalance('user1', 500);
      const account = accountService.getAccount('user1');
      
      expect(account.balance).toBe(1500); // 1000 initial + 500
    });

    it('should decrease balance', () => {
      accountService.updateBalance('user1', -200);
      const account = accountService.getAccount('user1');
      
      expect(account.balance).toBe(800); // 1000 initial - 200
    });
  });

  describe('setLoanStatus', () => {
    it('should set loan as active', () => {
      accountService.setLoanStatus('user1', true, 5000);
      const account = accountService.getAccount('user1');
      
      expect(account.loanActive).toBe(true);
      expect(account.loanAmount).toBe(5000);
    });

    it('should set loan as inactive', () => {
      accountService.setLoanStatus('user1', true, 5000);
      accountService.setLoanStatus('user1', false, 0);
      const account = accountService.getAccount('user1');
      
      expect(account.loanActive).toBe(false);
      expect(account.loanAmount).toBe(0);
    });
  });

  describe('markExploited', () => {
    it('should mark account as exploited', () => {
      accountService.markExploited('user1');
      const account = accountService.getAccount('user1');
      
      expect(account.exploited).toBe(true);
    });
  });

  describe('addTransaction', () => {
    it('should add transaction to account', () => {
      accountService.addTransaction('user1', {
        type: 'deposit',
        amount: 100,
        timestamp: new Date(),
        status: 'completed',
      });

      const account = accountService.getAccount('user1');
      
      expect(account.transactions.length).toBe(1);
      expect(account.transactions[0].type).toBe('deposit');
      expect(account.transactions[0].amount).toBe(100);
      expect(account.transactions[0].id).toBeDefined();
    });
  });

  describe('getAllAccounts', () => {
    it('should return all created accounts', () => {
      accountService.getAccount('user1');
      accountService.getAccount('user2');
      
      const accounts = accountService.getAllAccounts();
      
      expect(accounts.length).toBe(2);
    });
  });
});
