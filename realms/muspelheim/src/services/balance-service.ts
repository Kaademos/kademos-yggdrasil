/**
 * Balance Service - VULNERABLE TO RACE CONDITIONS
 * 
 * OWASP A06:2025 - Insecure Design
 * VULNERABLE: TOCTOU (Time-Of-Check-Time-Of-Use) in withdrawal operations
 * 
 * SPOILER: Async gap between balance check and update allows concurrent withdrawals
 * EXPLOIT: Send multiple withdrawal requests simultaneously to withdraw more than available balance
 */

export interface BalanceRecord {
  userId: string;
  balance: number;
  initialBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  withdrawalCount: number;
  lastUpdated: number;
}

export class BalanceService {
  private balances: Map<string, BalanceRecord> = new Map();
  private withdrawalHistory: Array<{
    userId: string;
    amount: number;
    timestamp: number;
    balanceBefore: number;
    balanceAfter: number;
  }> = [];

  /**
   * Initialize account with starting balance
   */
  initializeAccount(userId: string, initialBalance: number = 1000): void {
    if (!this.balances.has(userId)) {
      this.balances.set(userId, {
        userId,
        balance: initialBalance,
        initialBalance,
        totalDeposited: initialBalance,
        totalWithdrawn: 0,
        withdrawalCount: 0,
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Get balance for user
   */
  async getBalance(userId: string): Promise<number> {
    this.initializeAccount(userId);
    const record = this.balances.get(userId)!;
    return record.balance;
  }

  /**
   * Get full balance record
   */
  getBalanceRecord(userId: string): BalanceRecord | null {
    return this.balances.get(userId) || null;
  }

  /**
   * VULNERABLE: Withdraw with TOCTOU race condition
   * 
   * VULNERABILITY: Time gap between check and update allows concurrent withdrawals
   * 
   * EXPLOIT:
   * 1. Multiple requests check balance simultaneously (all pass)
   * 2. Async delay simulates network/DB latency
   * 3. All requests update balance (none see others' updates)
   * 4. Result: Total withdrawn > available balance
   */
  async withdraw(userId: string, amount: number): Promise<boolean> {
    this.initializeAccount(userId);
    
    // VULNERABLE: Check balance (Time-Of-Check)
    const currentBalance = await this.getBalance(userId);
    
    if (currentBalance < amount) {
      throw new Error('Insufficient balance');
    }

    // VULNERABLE: Async processing delay
    // This simulates network latency, database operations, etc.
    // Creates a race window where multiple requests can pass the check
    await this.simulateProcessingDelay();

    // VULNERABLE: Update balance (Time-Of-Use)
    // By this time, other concurrent requests may have already passed the check
    // but their updates haven't been applied yet
    const record = this.balances.get(userId)!;
    const balanceBefore = record.balance;
    
    record.balance -= amount;
    record.totalWithdrawn += amount;
    record.withdrawalCount += 1;
    record.lastUpdated = Date.now();

    // Record withdrawal in history
    this.withdrawalHistory.push({
      userId,
      amount,
      timestamp: Date.now(),
      balanceBefore,
      balanceAfter: record.balance,
    });

    return true;
  }

  /**
   * Safe deposit operation (no race condition)
   */
  async deposit(userId: string, amount: number): Promise<void> {
    this.initializeAccount(userId);
    const record = this.balances.get(userId)!;
    
    record.balance += amount;
    record.totalDeposited += amount;
    record.lastUpdated = Date.now();
  }

  /**
   * Get withdrawal history for user
   */
  getWithdrawalHistory(userId: string): Array<{
    amount: number;
    timestamp: number;
    balanceBefore: number;
    balanceAfter: number;
  }> {
    return this.withdrawalHistory.filter(w => w.userId === userId);
  }

  /**
   * Get total withdrawal count
   */
  getTotalWithdrawals(userId: string): number {
    return this.withdrawalHistory
      .filter(w => w.userId === userId)
      .reduce((sum, w) => sum + w.amount, 0);
  }

  /**
   * VULNERABLE: Simulate async processing delay
   * 
   * This creates the race window - realistic systems have similar delays from:
   * - Network latency
   * - Database query time
   * - External service calls
   * - Payment processor verification
   * 
   * Duration: 100-300ms (realistic but exploitable)
   */
  private async simulateProcessingDelay(): Promise<void> {
    const delay = 150 + Math.random() * 100; // 150-250ms
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Reset account (for testing)
   */
  resetAccount(userId: string): void {
    this.balances.delete(userId);
    this.withdrawalHistory = this.withdrawalHistory.filter(w => w.userId !== userId);
  }

  /**
   * Get all accounts (for debugging)
   */
  getAllAccounts(): BalanceRecord[] {
    return Array.from(this.balances.values());
  }
}
