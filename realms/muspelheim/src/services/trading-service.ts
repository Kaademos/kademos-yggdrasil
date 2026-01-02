/**
 * Trading Service - VULNERABLE
 * 
 * OWASP A06:2025 - Insecure Design
 * Business logic flaw: Flash loan releases collateral before verifying repayment
 * 
 * This is an intentional vulnerability for educational purposes.
 */

import { AccountService } from './account-service';

export class TradingService {
  constructor(private accountService: AccountService) {}

  /**
   * Execute flash loan - VULNERABLE IMPLEMENTATION
   * 
   * FLAW: Collateral is released BEFORE checking repayment
   * This allows users to borrow funds and not repay them
   */
  executeFlashLoan(userId: string, amount: number): { success: boolean; message: string; exploited?: boolean } {
    const account = this.accountService.getAccount(userId);

    // Validate loan amount
    if (amount <= 0 || amount > 10000) {
      return { success: false, message: 'Invalid loan amount (must be 1-10000)' };
    }

    // Check if loan already active
    if (account.loanActive) {
      return { success: false, message: 'Loan already active' };
    }

    // Log loan initiation
    this.accountService.addTransaction(userId, {
      type: 'flash_loan',
      amount,
      timestamp: new Date(),
      status: 'pending',
      details: 'Flash loan initiated',
    });

    // Set loan status
    this.accountService.setLoanStatus(userId, true, amount);

    // VULNERABILITY STEP 1: Release collateral immediately
    // In a secure implementation, collateral should be held until repayment
    this.accountService.updateBalance(userId, amount);
    this.accountService.addTransaction(userId, {
      type: 'collateral_release',
      amount,
      timestamp: new Date(),
      status: 'completed',
      details: 'Collateral released (PREMATURE - vulnerability)',
    });

    // Simulate trade execution
    const tradeProfit = Math.floor(amount * 0.1); // 10% profit
    this.accountService.updateBalance(userId, tradeProfit);
    this.accountService.addTransaction(userId, {
      type: 'trade',
      amount: tradeProfit,
      timestamp: new Date(),
      status: 'completed',
      details: `Trade executed with profit: ${tradeProfit}`,
    });

    // VULNERABILITY STEP 2: Check repayment AFTER collateral already released
    // At this point, it's too late - user already has the funds
    const repaymentSuccess = this.verifyRepayment(userId, amount);

    if (!repaymentSuccess) {
      // Collateral already released - can't recover it!
      // Mark account as exploited for flag access
      this.accountService.markExploited(userId);
      
      this.accountService.addTransaction(userId, {
        type: 'repayment',
        amount: 0,
        timestamp: new Date(),
        status: 'failed',
        details: 'Repayment failed - but collateral already released!',
      });

      return {
        success: true,
        message: 'Flash loan completed but repayment failed. Collateral was already released!',
        exploited: true,
      };
    }

    // Normal repayment flow (if user has sufficient balance)
    this.accountService.updateBalance(userId, -amount);
    this.accountService.setLoanStatus(userId, false, 0);
    this.accountService.addTransaction(userId, {
      type: 'repayment',
      amount,
      timestamp: new Date(),
      status: 'completed',
      details: 'Loan repaid successfully',
    });

    return {
      success: true,
      message: 'Flash loan completed successfully',
    };
  }

  /**
   * Verify repayment (called too late in vulnerable implementation)
   */
  private verifyRepayment(userId: string, amount: number): boolean {
    const account = this.accountService.getAccount(userId);
    
    // Check if user has enough balance to repay
    // This check happens AFTER collateral is released (the vulnerability)
    return account.balance >= amount;
  }

  /**
   * Check if user has exploited the flash loan
   */
  hasExploited(userId: string): boolean {
    const account = this.accountService.getAccount(userId);
    return account.exploited;
  }

  /**
   * Normal deposit (safe operation)
   */
  deposit(userId: string, amount: number): { success: boolean; message: string } {
    if (amount <= 0) {
      return { success: false, message: 'Invalid amount' };
    }

    this.accountService.updateBalance(userId, amount);
    this.accountService.addTransaction(userId, {
      type: 'deposit',
      amount,
      timestamp: new Date(),
      status: 'completed',
    });

    return { success: true, message: 'Deposit successful' };
  }

  /**
   * Normal withdrawal (safe operation)
   */
  withdrawal(userId: string, amount: number): { success: boolean; message: string } {
    const account = this.accountService.getAccount(userId);

    if (amount <= 0) {
      return { success: false, message: 'Invalid amount' };
    }

    if (account.balance < amount) {
      return { success: false, message: 'Insufficient balance' };
    }

    this.accountService.updateBalance(userId, -amount);
    this.accountService.addTransaction(userId, {
      type: 'withdrawal',
      amount,
      timestamp: new Date(),
      status: 'completed',
    });

    return { success: true, message: 'Withdrawal successful' };
  }
}
