/**
 * Token Service - Vanaheim
 * 
 */

export interface Token {
  value: string;
  userId: string;
  timestamp: number;
  seed: number;
}

export class TokenService {
  private tokenHistory: Token[] = [];
  private readonly maxHistory: number;
  private readonly seedMultiplier: number;

  constructor(maxHistory: number = 50, seedMultiplier: number = 1000) {
    this.maxHistory = maxHistory;
    this.seedMultiplier = seedMultiplier;
  }

  /**
   * 
   * 
   */
  generateToken(userId: string): Token {
    const timestamp = Date.now();
    const userIdNum = this.parseUserId(userId);
    
    // 
    const seed = timestamp + userIdNum * this.seedMultiplier;
    
    // 
    const tokenValue = this.weakPRNG(seed);
    
    const token: Token = {
      value: tokenValue,
      userId,
      timestamp,
      seed,
    };
    
    // 
    this.addToHistory(token);
    
    return token;
  }

  /**
   * 
   */
  private weakPRNG(seed: number): string {
    // Linear Congruential Generator (LCG) - predictable algorithm
    // Formula: next = (a * seed + c) mod m
    const a = 1103515245;
    const c = 12345;
    const m = 2 ** 31;
    
    let value = seed;
    let tokenHex = '';
    
    // Generate 16-character hex token
    for (let i = 0; i < 4; i++) {
      value = (a * value + c) % m;
      const hex = (value % 65536).toString(16).padStart(4, '0');
      tokenHex += hex;
    }
    
    return `VAN-${tokenHex.toUpperCase()}`;
  }

  /**
   * Parse userId to number for seed calculation
   */
  private parseUserId(userId: string): number {
    // Extract numeric part from userId or use char code sum
    const numericMatch = userId.match(/\d+/);
    if (numericMatch) {
      return parseInt(numericMatch[0], 10);
    }
    
    // Fallback: sum of character codes
    return userId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  }

  /**
   * Add token to history
   */
  private addToHistory(token: Token): void {
    this.tokenHistory.push(token);
    
    // Maintain max history size
    if (this.tokenHistory.length > this.maxHistory) {
      this.tokenHistory.shift();
    }
  }

  /**
   * Get token history
   * 
   */
  getTokenHistory(limit?: number): Token[] {
    if (limit) {
      return this.tokenHistory.slice(-limit);
    }
    return [...this.tokenHistory];
  }

  /**
   * Validate token
   */
  validateToken(tokenValue: string): boolean {
    return this.tokenHistory.some(t => t.value === tokenValue);
  }

  /**
   * Get history count
   */
  getHistoryCount(): number {
    return this.tokenHistory.length;
  }
}
