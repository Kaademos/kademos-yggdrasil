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

    it('should derive a distinct seed per userId', () => {
      const token1 = tokenService.generateToken('merchant1');
      const token2 = tokenService.generateToken('merchant2');

      // seed = timestamp + parseUserId(userId) * seedMultiplier, so the userId
      // always shifts the seed regardless of how close the timestamps are.
      expect(token1.seed).not.toBe(token2.seed);
      expect(token1.userId).toBe('merchant1');
      expect(token2.userId).toBe('merchant2');
    });

    it('should emit well-formed tokens for distinct userIds', () => {
      const token1 = tokenService.generateToken('merchant1');
      const token2 = tokenService.generateToken('merchant2');

      expect(token1.value).toMatch(/^VAN-[A-F0-9]{16}$/);
      expect(token2.value).toMatch(/^VAN-[A-F0-9]{16}$/);

      // NOTE: deliberately not asserting token1.value !== token2.value.
      //
      // This realm is A04 Cryptographic Failures and its PRNG is an LCG with
      // intentionally poor mixing, so seeds 1000 apart routinely map onto the
      // same 16-hex output — colliding tokens ARE the vulnerability being
      // taught. The previous assertion demanded they never collide, which
      // failed roughly 40% of runs and contradicted the realm's own premise.
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
