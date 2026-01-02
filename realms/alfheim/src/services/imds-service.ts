/**
 * IMDSv2 Service - AWS Instance Metadata Service v2
 * 
 * 
 */

import { randomUUID } from 'crypto';
import { Request } from 'express';

export interface Token {
  token: string;
  expiresAt: number;
  issued: number;
  ttl: number;
}

export interface InstanceMetadata {
  instanceId: string;
  instanceType: string;
  region: string;
  availabilityZone: string;
  privateIp: string;
  publicIp?: string;
  architecture: string;
  imageId: string;
}

export interface IAMCredentials {
  Code: string;
  Type: string;
  AccessKeyId: string;
  SecretAccessKey: string;
  Token: string;
  Expiration: string;
  LastUpdated: string;
  // 
  RealmAccessToken?: string;
}

export class IMDSService {
  private tokens: Map<string, Token> = new Map();
  private readonly flag: string;
  private readonly TOKEN_PREFIX = 'AQAAAxxxxxxxx';
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(flag: string) {
    this.flag = flag;
    
    // Cleanup expired tokens every hour
    this.cleanupInterval = setInterval(() => this.cleanupExpiredTokens(), 3600000);
  }

  /**
   * Generate IMDSv2 token
   * 
   */
  generateToken(req: Request): string | null {
    // IMDSv2 requires specific header
    const ttlHeader = req.headers['x-aws-ec2-metadata-token-ttl-seconds'];
    
    if (!ttlHeader) {
      return null; // 
    }

    if (req.method !== 'PUT') {
      return null; 
    }

    const ttlSeconds = parseInt(ttlHeader as string, 10);
    
    // AWS IMDSv2 allows TTL from 1 to 21600 seconds (6 hours)
    if (isNaN(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 21600) {
      return null;
    }

    const token = `${this.TOKEN_PREFIX}-${randomUUID()}`;
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    
    this.tokens.set(token, {
      token,
      expiresAt,
      issued: Date.now(),
      ttl: ttlSeconds,
    });

    return token;
  }

  /**
   * Get instance metadata
   * 
   */
  getInstanceMetadata(token: string): InstanceMetadata | null {
    if (!this.isValidToken(token)) {
      return null;
    }

    return {
      instanceId: 'i-alfheim-prod-001',
      instanceType: 'm5.large',
      region: 'alfheim-north-1',
      availabilityZone: 'alfheim-north-1a',
      privateIp: '10.0.1.42',
      publicIp: '203.0.113.42',
      architecture: 'x86_64',
      imageId: 'ami-alfheim-20250101',
    };
  }

  /**
   * Get IAM role name
   *
   */
  getIAMRole(token: string): string | null {
    if (!this.isValidToken(token)) {
      return null;
    }

    return 'AlfheimAdminRole';
  }

  /**
   * Get IAM credentials for role
   * VULNERABLE: Returns credentials containing flag
   * 
   * EXPLOIT: This is the final step - flag is in RealmAccessToken field
   */
  getIAMCredentials(token: string, roleName: string): IAMCredentials | null {
    if (!this.isValidToken(token)) {
      return null;
    }

    if (roleName !== 'AlfheimAdminRole') {
      return null;
    }

    // Simulate AWS IAM temporary credentials
    const expiration = new Date(Date.now() + 3600000); // 1 hour
    const lastUpdated = new Date();

    return {
      Code: 'Success',
      Type: 'AWS-HMAC',
      AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      Token: 'IQoJb3JpZ2luX2VjEH8aCXVzLWVhc3QtMSJGMEQCIGZhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NQIgNTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=',
      Expiration: expiration.toISOString(),
      LastUpdated: lastUpdated.toISOString(),
      // FLAG HERE: Embedded as custom field in credentials
      // SPOILER: Flag in RealmAccessToken field (mimics AWS custom metadata)
      RealmAccessToken: this.flag,
    };
  }

  /**
   * Get all available metadata paths (discovery)
   */
  getAvailablePaths(token: string): string[] | null {
    if (!this.isValidToken(token)) {
      return null;
    }

    return [
      '/latest/meta-data/',
      '/latest/meta-data/instance-id',
      '/latest/meta-data/instance-type',
      '/latest/meta-data/placement/availability-zone',
      '/latest/meta-data/iam/security-credentials/',
      '/latest/meta-data/iam/security-credentials/AlfheimAdminRole',
    ];
  }

  /**
   * Validate token (not expired)
   */
  private isValidToken(token: string): boolean {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData) {
      return false;
    }

    if (tokenData.expiresAt < Date.now()) {
      // Token expired - clean it up
      this.tokens.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Cleanup expired tokens (runs periodically)
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, data] of this.tokens.entries()) {
      if (data.expiresAt < now) {
        this.tokens.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[IMDSService] Cleaned ${cleaned} expired tokens`);
    }
  }

  /**
   * Get token count (for debugging/monitoring)
   */
  getTokenCount(): number {
    return this.tokens.size;
  }

  /**
   * Get token info (for debugging - non-production)
   */
  getTokenInfo(token: string): Token | undefined {
    return this.tokens.get(token);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.tokens.clear();
  }
}
