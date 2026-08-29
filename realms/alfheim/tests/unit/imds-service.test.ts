/**
 * Unit tests for IMDSService
 */

import { IMDSService } from '../../src/services/imds-service';

describe('IMDSService', () => {
  let imdsService: IMDSService;
  const testFlag = 'YGGDRASIL{ALFHEIM:test-flag-uuid}';

  beforeEach(() => {
    // IMDSService starts an hourly cleanup interval in its constructor. Under
    // real timers that handle keeps the Node process alive after the last
    // assertion, so the run hangs instead of exiting. Faking timers also makes
    // the TTL-expiry cases below deterministic and instant.
    jest.useFakeTimers();
    imdsService = new IMDSService(testFlag);
  });

  afterEach(() => {
    // Clears the interval as well as the token map — the leak this suite used
    // to hit is a real one, not a test artefact.
    imdsService.destroy();
    jest.useRealTimers();
  });

  describe('Token Generation', () => {
    it('should generate token with valid PUT request and TTL header', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '3600',
        },
      } as any;

      const token = imdsService.generateToken(mockRequest);
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token!.length).toBeGreaterThan(20);
    });

    it('should reject token generation without PUT method', () => {
      const mockRequest = {
        method: 'GET',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '3600',
        },
      } as any;

      const token = imdsService.generateToken(mockRequest);
      
      expect(token).toBeNull();
    });

    it('should reject token generation without TTL header', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {},
      } as any;

      const token = imdsService.generateToken(mockRequest);
      
      expect(token).toBeNull();
    });

    it('should reject TTL outside valid range (1-21600)', () => {
      const invalidTTLs = ['0', '30000', '-100'];
      
      invalidTTLs.forEach(ttl => {
        const mockRequest = {
          method: 'PUT',
          headers: {
            'x-aws-ec2-metadata-token-ttl-seconds': ttl,
          },
        } as any;

        const token = imdsService.generateToken(mockRequest);
        expect(token).toBeNull();
      });
    });

    it('should generate unique tokens for each request', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '3600',
        },
      } as any;

      const token1 = imdsService.generateToken(mockRequest);
      const token2 = imdsService.generateToken(mockRequest);
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('Available Paths', () => {
    it('should return paths with valid token', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '3600',
        },
      } as any;

      const token = imdsService.generateToken(mockRequest);
      const paths = imdsService.getAvailablePaths(token!);

      expect(paths).toBeTruthy();
      // getAvailablePaths returns string[] | null; toBeTruthy does not narrow for
      // the compiler, so assert explicitly before dereferencing.
      if (!paths) throw new Error('expected available paths for a valid token');

      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.some((p: string) => p.includes('instance'))).toBe(true);
      expect(paths.some((p: string) => p.includes('iam'))).toBe(true);
    });

    it('should reject invalid token', () => {
      const paths = imdsService.getAvailablePaths('invalid-token');
      
      expect(paths).toBeNull();
    });
  });

  describe('Instance Metadata', () => {
    it('should return instance metadata with valid token', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '3600',
        },
      } as any;

      const token = imdsService.generateToken(mockRequest);
      const metadata = imdsService.getInstanceMetadata(token!);
      
      expect(metadata).toBeTruthy();
      expect(metadata?.instanceId).toBeDefined();
      expect(metadata?.region).toBe('alfheim-north-1');
      expect(metadata?.availabilityZone).toBeDefined();
    });

    it('should reject invalid token', () => {
      const metadata = imdsService.getInstanceMetadata('invalid-token');
      
      expect(metadata).toBeNull();
    });
  });

  describe('IAM Role', () => {
    it('should return IAM role name with valid token', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '3600',
        },
      } as any;

      const token = imdsService.generateToken(mockRequest);
      const role = imdsService.getIAMRole(token!);
      
      expect(role).toBe('AlfheimAdminRole');
    });

    it('should reject invalid token', () => {
      const role = imdsService.getIAMRole('invalid-token');
      
      expect(role).toBeNull();
    });
  });

  describe('IAM Credentials', () => {
    it('should return credentials with valid token and role', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '3600',
        },
      } as any;

      const token = imdsService.generateToken(mockRequest);
      const credentials = imdsService.getIAMCredentials(token!, 'AlfheimAdminRole');
      
      expect(credentials).toBeTruthy();
      expect(credentials?.AccessKeyId).toMatch(/^AKIA/);
      expect(credentials?.SecretAccessKey).toBeDefined();
      expect(credentials?.Token).toBeDefined();
      expect(credentials?.RealmAccessToken).toBe(testFlag);
    });

    it('should reject invalid role', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '3600',
        },
      } as any;

      const token = imdsService.generateToken(mockRequest);
      const credentials = imdsService.getIAMCredentials(token!, 'InvalidRole');
      
      expect(credentials).toBeNull();
    });

    it('should reject invalid token', () => {
      const credentials = imdsService.getIAMCredentials('invalid-token', 'AlfheimAdminRole');
      
      expect(credentials).toBeNull();
    });

    it('should contain flag in RealmAccessToken field', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '3600',
        },
      } as any;

      const token = imdsService.generateToken(mockRequest);
      const credentials = imdsService.getIAMCredentials(token!, 'AlfheimAdminRole');
      
      expect(credentials?.RealmAccessToken).toContain('YGGDRASIL{ALFHEIM:');
      expect(credentials?.RealmAccessToken).toBe(testFlag);
    });
  });

  describe('Token Management', () => {
    it('should track active tokens', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '3600',
        },
      } as any;

      const initialCount = imdsService.getTokenCount();
      imdsService.generateToken(mockRequest);
      const newCount = imdsService.getTokenCount();
      
      expect(newCount).toBe(initialCount + 1);
    });

    it('should clean up expired tokens', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '1',
        },
      } as any;

      const token = imdsService.generateToken(mockRequest);
      expect(token).toBeTruthy();

      // Advance past the 1s TTL. Expiry is a Date.now() comparison, which the
      // fake clock moves with the timers.
      jest.advanceTimersByTime(1200);

      expect(imdsService.getInstanceMetadata(token!)).toBeNull();
    });
  });

  describe('Security', () => {
    it('should not accept expired tokens', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '1',
        },
      } as any;

      const token = imdsService.generateToken(mockRequest);

      jest.advanceTimersByTime(1200);

      expect(imdsService.getIAMCredentials(token!, 'AlfheimAdminRole')).toBeNull();
    });

    it('should generate cryptographically strong tokens', () => {
      const mockRequest = {
        method: 'PUT',
        headers: {
          'x-aws-ec2-metadata-token-ttl-seconds': '3600',
        },
      } as any;

      const tokens = new Set();
      for (let i = 0; i < 10; i++) {
        const token = imdsService.generateToken(mockRequest);
        tokens.add(token);
      }

      expect(tokens.size).toBe(10);
    });
  });
});
