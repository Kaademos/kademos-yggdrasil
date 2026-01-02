/**
 * Token Analysis Service - Vanaheim
 * 
 * OWASP A04:2025 - Cryptographic Failures
 * VULNERABLE: Exposes PRNG internal state and parameters for analysis
 * 
 * SPOILER: This service intentionally reveals LCG parameters and seeds
 * EXPLOIT: Use exposed data to predict future tokens
 */

import { Token } from './token-service';

export interface AnalysisResult {
  seeds: number[];
  deltas: number[];
  lcgParams: {
    a: number;
    c: number;
    m: number;
    formula: string;
  };
  predictable: boolean;
  nextPrediction: number;
  entropy: number;
  pattern: string;
  warnings: string[];
}

export interface PredictionResult {
  inputSeed: number;
  nextSeed: number;
  predictedValue: number;
  formula: string;
  steps: string[];
}

export class TokenAnalysisService {
  // LCG parameters (exposed for educational purposes)
  private readonly LCG_A = 1103515245;
  private readonly LCG_C = 12345;
  private readonly LCG_M = Math.pow(2, 31);

  /**
   * VULNERABLE: Analyze token pattern and expose internal PRNG state
   * 
   * SPOILER: This method reveals:
   * - Internal seeds used for generation
   * - LCG algorithm parameters (a, c, m)
   * - Pattern detection results
   * - Entropy measurements
   * 
   * EXPLOIT: Use this data to predict future tokens for any userId
   */
  analyzePattern(tokens: Token[]): AnalysisResult {
    if (tokens.length < 3) {
      throw new Error('Insufficient data for analysis. Generate at least 3 tokens.');
    }

    // VULNERABLE: Extract all seeds from token history
    const seeds = tokens.map(t => t.seed);
    
    // Calculate deltas (differences between consecutive seeds)
    const deltas = this.calculateDeltas(seeds);
    
    // Predict next seed based on last seed
    const lastSeed = seeds[seeds.length - 1];
    const nextPrediction = this.lcg(lastSeed);
    
    // Calculate entropy (low entropy = predictable)
    const entropy = this.calculateEntropy(seeds, deltas);
    
    // Detect generation pattern
    const pattern = this.detectPattern(deltas);
    
    // Generate security warnings
    const warnings = this.generateWarnings(entropy, pattern);

    return {
      seeds, // VULNERABLE: Exposes internal PRNG state
      deltas,
      lcgParams: { // VULNERABLE: Exposes algorithm parameters
        a: this.LCG_A,
        c: this.LCG_C,
        m: this.LCG_M,
        formula: `next = (${this.LCG_A} * seed + ${this.LCG_C}) % ${this.LCG_M}`
      },
      predictable: true,
      nextPrediction,
      entropy,
      pattern,
      warnings
    };
  }

  /**
   * VULNERABLE: Predict next token value given a seed
   * 
   * EXPLOIT: Use this to predict admin tokens
   */
  predictNext(seed: number, steps: number = 1): PredictionResult {
    const calculationSteps: string[] = [];
    let currentSeed = seed;

    calculationSteps.push(`Starting seed: ${seed}`);

    for (let i = 0; i < steps; i++) {
      const nextValue = this.lcg(currentSeed);
      calculationSteps.push(
        `Step ${i + 1}: (${this.LCG_A} * ${currentSeed} + ${this.LCG_C}) % ${this.LCG_M} = ${nextValue}`
      );
      currentSeed = nextValue;
    }

    return {
      inputSeed: seed,
      nextSeed: currentSeed,
      predictedValue: currentSeed,
      formula: `next = (a * seed + c) % m`,
      steps: calculationSteps
    };
  }

  /**
   * Calculate LCG next value
   * This is the same algorithm used in TokenService
   */
  private lcg(seed: number): number {
    return (this.LCG_A * seed + this.LCG_C) % this.LCG_M;
  }

  /**
   * Calculate deltas between consecutive seeds
   */
  private calculateDeltas(seeds: number[]): number[] {
    const deltas: number[] = [];
    for (let i = 1; i < seeds.length; i++) {
      deltas.push(seeds[i] - seeds[i - 1]);
    }
    return deltas;
  }

  /**
   * Calculate entropy (measure of randomness)
   * Low entropy = predictable pattern
   */
  private calculateEntropy(seeds: number[], deltas: number[]): number {
    // Simplified entropy calculation
    // Real entropy would use Shannon entropy formula
    
    // Check for repeated values
    const uniqueSeeds = new Set(seeds).size;
    const uniqueDeltas = new Set(deltas).size;
    
    // Calculate entropy score (0-1, lower is worse)
    const seedEntropy = uniqueSeeds / seeds.length;
    const deltaEntropy = uniqueDeltas / deltas.length;
    
    return Math.min(seedEntropy, deltaEntropy);
  }

  /**
   * Detect pattern in token generation
   */
  private detectPattern(deltas: number[]): string {
    if (deltas.length === 0) return 'INSUFFICIENT_DATA';

    const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;

    // Categorize based on average time delta
    if (avgDelta < 1000) {
      return 'RAPID_SEQUENTIAL'; // Generated rapidly
    } else if (avgDelta < 60000) {
      return 'TIME_BASED_SEQUENTIAL'; // Generated within minutes
    } else if (avgDelta < 3600000) {
      return 'HOURLY_PATTERN'; // Generated within hours
    } else {
      return 'SPARSE_GENERATION'; // Long time between generations
    }
  }

  /**
   * Generate security warnings based on analysis
   */
  private generateWarnings(entropy: number, pattern: string): string[] {
    const warnings: string[] = [];

    warnings.push('⚠️ CRITICAL: PRNG uses Linear Congruential Generator (LCG)');
    warnings.push('⚠️ CRITICAL: Seeds based on predictable timestamp values');
    warnings.push('⚠️ CRITICAL: Algorithm parameters fully exposed in API');

    if (entropy < 0.5) {
      warnings.push(`⚠️ HIGH: Low entropy detected (${(entropy * 100).toFixed(1)}%)`);
    }

    if (pattern === 'RAPID_SEQUENTIAL') {
      warnings.push('⚠️ HIGH: Rapid sequential generation enables easy pattern analysis');
    }

    warnings.push('⚠️ MEDIUM: Token history exposes seeds and timestamps');
    warnings.push('⚠️ MEDIUM: No cryptographic randomness (Math.random() or crypto.randomBytes not used)');

    return warnings;
  }

  /**
   * Generate token from seed (mimics TokenService behavior)
   * 
   * VULNERABLE: Allows attacker to generate valid tokens if they know the seed
   */
  generateTokenFromSeed(seed: number): string {
    const a = this.LCG_A;
    const c = this.LCG_C;
    const m = this.LCG_M;
    
    let value = seed;
    let tokenHex = '';
    
    // Generate 16-character hex token (same as TokenService)
    for (let i = 0; i < 4; i++) {
      value = (a * value + c) % m;
      const hex = (value % 65536).toString(16).padStart(4, '0');
      tokenHex += hex;
    }
    
    return `VAN-${tokenHex.toUpperCase()}`;
  }

  /**
   * Calculate expected seed for a userId at a specific timestamp
   * 
   * VULNERABLE: Allows prediction of seeds for any user
   */
  calculateExpectedSeed(userId: string, timestamp: number, seedMultiplier: number = 1000): number {
    // Parse userId to number (same logic as TokenService)
    const numericMatch = userId.match(/\d+/);
    const userIdNum = numericMatch
      ? parseInt(numericMatch[0], 10)
      : userId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    
    return timestamp + userIdNum * seedMultiplier;
  }
}
