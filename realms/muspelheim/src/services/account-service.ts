/**
 * Account Service
 * 
 * Manages user accounts and balances
 */

import { Account, createAccount, Transaction } from '../models/account';

export class AccountService {
  private accounts: Map<string, Account> = new Map();

  /**
   * Get or create account for user
   */
  getAccount(userId: string): Account {
    if (!this.accounts.has(userId)) {
      this.accounts.set(userId, createAccount(userId));
    }
    return this.accounts.get(userId)!;
  }

  /**
   * Update account balance
   */
  updateBalance(userId: string, amount: number): void {
    const account = this.getAccount(userId);
    account.balance += amount;
  }

  /**
   * Update collateral
   */
  updateCollateral(userId: string, amount: number): void {
    const account = this.getAccount(userId);
    account.collateral += amount;
  }

  /**
   * Set loan status
   */
  setLoanStatus(userId: string, active: boolean, amount: number = 0): void {
    const account = this.getAccount(userId);
    account.loanActive = active;
    account.loanAmount = amount;
  }

  /**
   * Mark account as exploited (for flag access)
   */
  markExploited(userId: string): void {
    const account = this.getAccount(userId);
    account.exploited = true;
  }

  /**
   * Add transaction to account history
   */
  addTransaction(userId: string, transaction: Omit<Transaction, 'id'>): void {
    const account = this.getAccount(userId);
    const fullTransaction: Transaction = {
      ...transaction,
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    account.transactions.push(fullTransaction);
  }

  /**
   * Get all accounts (for debugging)
   */
  getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }
}
