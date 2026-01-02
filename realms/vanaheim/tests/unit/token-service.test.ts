/**
 * Token Service Unit Tests
 * Tests for non-vulnerable aspects of TokenService
 */

import { TokenService } from '../../src/services/token-service';

describe('TokenService', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    tokenService = new TokenService(10, 1000);
  });

  describe('generateToken', () => {
    it('should generate a token for a valid userId', () => {
      const token = tokenService.generateToken('merchant1');
      
      expect(token).toBeDefined();
      expect(token.value).toMatch(/^VAN-[A-F0-9]{16}$/);
      expect(token.userId).toBe('merchant1');
      expect(token.timestamp).toBeGreaterThan(0);
      expect(token.seed).toBeGreaterThan(0);
    });

    it('should generate different tokens for different userIds', () => {
      const token1 = tokenService.generateToken('merchant1');
      const token2 = tokenService.generateToken('merchant2');
      
      expect(token1.value).not.toBe(token2.value);
      expect(token1.seed).not.toBe(token2.seed);
    });

    it('should add generated tokens to history', () => {
      tokenService.generateToken('merchant1');
      tokenService.generateToken('merchant2');
      
      const history = tokenService.getTokenHistory();
      expect(history.length).toBe(2);
    });

    it('should maintain max history size', () => {
      // Generate more tokens than max history
      for (let i = 0; i < 15; i++) {
        tokenService.generateToken(`merchant${i}`);
      }
      
      const history = tokenService.getTokenHistory();
      expect(history.length).toBe(10); // maxHistory = 10
    });
  });

  describe('getTokenHistory', () => {
    it('should return empty array when no tokens generated', () => {
      const history = tokenService.getTokenHistory();
      expect(history).toEqual([]);
    });

    it('should return all tokens when no limit specified', () => {
      tokenService.generateToken('merchant1');
      tokenService.generateToken('merchant2');
      tokenService.generateToken('merchant3');
      
      const history = tokenService.getTokenHistory();
      expect(history.length).toBe(3);
    });

    it('should return limited tokens when limit specified', () => {
      for (let i = 0; i < 5; i++) {
        tokenService.generateToken(`merchant${i}`);
      }
      
      const history = tokenService.getTokenHistory(3);
      expect(history.length).toBe(3);
    });
  });

  describe('validateToken', () => {
    it('should validate a generated token as true', () => {
      const token = tokenService.generateToken('merchant1');
      const isValid = tokenService.validateToken(token.value);
      
      expect(isValid).toBe(true);
    });

    it('should validate a non-generated token as false', () => {
      const isValid = tokenService.validateToken('VAN-1234567890ABCDEF');
      expect(isValid).toBe(false);
    });
  });

  describe('getHistoryCount', () => {
    it('should return 0 when no tokens generated', () => {
      expect(tokenService.getHistoryCount()).toBe(0);
    });

    it('should return correct count after generating tokens', () => {
      tokenService.generateToken('merchant1');
      tokenService.generateToken('merchant2');
      
      expect(tokenService.getHistoryCount()).toBe(2);
    });
  });
});
