/**
 * Audit Service 
 * 
 * OWASP A06:2025 - Insecure Design
 * Monitors for impossible balance states caused by race condition exploitation
 */

import { BalanceService } from './balance-service';

export interface AuditReport {
  anomalyDetected: boolean;
  severity: string;
  incidentId: string;
  timestamp: string;
  details: {
    userId: string;
    initialBalance: number;
    totalDeposited: number;
    totalWithdrawn: number;
    currentBalance: number;
    expectedBalance: number;
    discrepancy: number;
    withdrawalCount: number;
    impossibleState: boolean;
  };
  analysis: string[];
  recommendations: string[];
}

export class AuditService {
  constructor(
    private balanceService: BalanceService,
    private flag: string
  ) {}

  /**
   * Perform audit on user account
   * 
   * Detects race condition exploitation by checking for impossible states:
   * - Total withdrawn > initial balance + deposits
   * - Current balance < 0
   * - Discrepancy between expected and actual balance
   */
  async auditAccount(userId: string): Promise<AuditReport> {
    const record = this.balanceService.getBalanceRecord(userId);
    
    if (!record) {
      throw new Error('Account not found');
    }

    // Calculate expected balance
    const expectedBalance = record.initialBalance + record.totalDeposited - record.totalWithdrawn;
    const discrepancy = expectedBalance - record.balance;

    // Detect impossible states
    const impossibleWithdrawal = record.totalWithdrawn > (record.initialBalance + record.totalDeposited);
    const negativeBalance = record.balance < 0;
    const largeDiscrepancy = Math.abs(discrepancy) > 0.01; // Account for floating point

    const anomalyDetected = impossibleWithdrawal || negativeBalance || largeDiscrepancy;

    // Generate analysis
    const analysis: string[] = [];
    
    if (impossibleWithdrawal) {
      analysis.push(`CRITICAL: Total withdrawn (${record.totalWithdrawn}) exceeds available funds (${record.initialBalance + record.totalDeposited})`);
      analysis.push('This indicates successful exploitation of race condition vulnerability');
    }

    if (negativeBalance) {
      analysis.push(`CRITICAL: Negative balance detected (${record.balance})`);
      analysis.push('Account state is mathematically impossible under normal operations');
    }

    if (largeDiscrepancy && !impossibleWithdrawal) {
      analysis.push(`WARNING: Balance discrepancy of ${discrepancy.toFixed(2)} detected`);
      analysis.push('May indicate concurrent transaction processing issues');
    }

    if (record.withdrawalCount > 5) {
      analysis.push(`HIGH: Multiple withdrawals detected (${record.withdrawalCount})`);
      analysis.push('Pattern consistent with race condition attack');
    }

    if (!anomalyDetected) {
      analysis.push('Account activity appears normal');
      analysis.push('No evidence of race condition exploitation');
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (anomalyDetected) {
      recommendations.push('Implement database-level transaction locking (SELECT FOR UPDATE)');
      recommendations.push('Use atomic operations for balance updates');
      recommendations.push('Add distributed locks for critical sections (Redis, etc.)');
      recommendations.push('Implement idempotency keys for withdrawal requests');
      recommendations.push('Add request deduplication based on unique identifiers');
    } else {
      recommendations.push('Continue monitoring for suspicious activity');
      recommendations.push('Regular audits recommended');
    }

    // VULNERABLE: Incident ID contains flag if anomaly detected
    const incidentId = anomalyDetected 
      ? this.flag // Flag revealed as incident ID
      : `INCIDENT-${Date.now()}-${userId.substring(0, 8)}`;

    return {
      anomalyDetected,
      severity: impossibleWithdrawal ? 'CRITICAL' : (negativeBalance ? 'HIGH' : 'MEDIUM'),
      incidentId,
      timestamp: new Date().toISOString(),
      details: {
        userId,
        initialBalance: record.initialBalance,
        totalDeposited: record.totalDeposited,
        totalWithdrawn: record.totalWithdrawn,
        currentBalance: record.balance,
        expectedBalance,
        discrepancy,
        withdrawalCount: record.withdrawalCount,
        impossibleState: impossibleWithdrawal || negativeBalance,
      },
      analysis,
      recommendations,
    };
  }

  /**
   * Check if user has exploited the race condition
   */
  async hasExploited(userId: string): Promise<boolean> {
    const record = this.balanceService.getBalanceRecord(userId);
    
    if (!record) {
      return false;
    }

    // Check for impossible state
    const impossibleWithdrawal = record.totalWithdrawn > (record.initialBalance + record.totalDeposited);
    const negativeBalance = record.balance < 0;

    return impossibleWithdrawal || negativeBalance;
  }

  /**
   * Get system-wide audit summary
   */
  async getSystemAudit(): Promise<{
    totalAccounts: number;
    accountsWithAnomalies: number;
    totalAnomalies: number;
  }> {
    const accounts = this.balanceService.getAllAccounts();
    let accountsWithAnomalies = 0;

    for (const account of accounts) {
      const audit = await this.auditAccount(account.userId);
      if (audit.anomalyDetected) {
        accountsWithAnomalies++;
      }
    }

    return {
      totalAccounts: accounts.length,
      accountsWithAnomalies,
      totalAnomalies: accountsWithAnomalies,
    };
  }
}
