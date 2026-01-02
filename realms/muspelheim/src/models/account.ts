/**
 * Account Model
 * 
 * Represents a trading account with balance and transactions
 */

export interface Account {
  userId: string;
  balance: number;
  collateral: number;
  loanActive: boolean;
  loanAmount: number;
  exploited: boolean;
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'flash_loan' | 'trade' | 'collateral_release' | 'repayment';
  amount: number;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
  details?: string;
}

export function createAccount(userId: string): Account {
  return {
    userId,
    balance: 1000, // Starting balance
    collateral: 0,
    loanActive: false,
    loanAmount: 0,
    exploited: false,
    transactions: [],
  };
}
