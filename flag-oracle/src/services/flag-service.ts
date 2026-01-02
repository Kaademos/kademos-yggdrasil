import { createHmac } from 'crypto';

export interface FlagConfig {
  masterSecret: string;
}

export interface FlagVerificationResult {
  valid: boolean;
  realm?: string;
  error?: string;
}

/**
 * FlagService - Deterministic flag generation using HMAC-SHA256
 *
 * Generates flags using HMAC to ensure:
 * - Deterministic: Same (realmId, userId) always produces same flag
 * - Unique: Different users get different flags per realm
 * - Secure: Cannot reverse-engineer master secret from flag
 * - Reproducible: Can verify flags without storing them
 */
export class FlagService {
  private readonly masterSecret: string;

  constructor(config: FlagConfig) {
    if (!config.masterSecret || config.masterSecret.length < 32) {
      throw new Error('Master secret must be at least 32 characters for security');
    }
    this.masterSecret = config.masterSecret;
  }

  /**
   * Generate deterministic flag for (realm, user) pair
   * Same inputs always produce same flag
   *
   * @param realmId - Realm identifier (e.g., "NIFLHEIM")
   * @param userId - User identifier
   * @returns Flag in format YGGDRASIL{REALMID:uuid}
   */
  generateFlag(realmId: string, userId: string): string {
    if (!realmId || !userId) {
      throw new Error('realmId and userId are required');
    }

    const normalizedRealmId = realmId.toUpperCase().trim();
    const normalizedUserId = userId.trim();

    // Create message combining realm and user
    const message = `${normalizedRealmId}:${normalizedUserId}`;

    // Generate HMAC-SHA256 digest
    const hmac = createHmac('sha256', this.masterSecret);
    hmac.update(message);
    const digest = hmac.digest('hex');

    // Convert first 32 hex chars to UUID v4 format
    const uuid = [
      digest.substring(0, 8),
      digest.substring(8, 12),
      digest.substring(12, 16),
      digest.substring(16, 20),
      digest.substring(20, 32),
    ].join('-');

    return `YGGDRASIL{${normalizedRealmId}:${uuid}}`;
  }

  /**
   * Verify flag is valid for given (realm, user) pair
   *
   * @param flag - Flag to verify
   * @param userId - User identifier
   * @returns Verification result with realm if valid
   */
  verifyFlag(flag: string, userId: string): FlagVerificationResult {
    if (!flag || typeof flag !== 'string') {
      return { valid: false, error: 'Flag must be a non-empty string' };
    }

    if (!userId || typeof userId !== 'string') {
      return { valid: false, error: 'userId must be a non-empty string' };
    }

    // Parse flag format: YGGDRASIL{REALM:uuid}
    const match = flag.match(/^YGGDRASIL\{([A-Z_]+):([a-f0-9-]+)\}$/i);
    if (!match) {
      return { valid: false, error: 'Invalid flag format' };
    }

    const [, realmId, providedUuid] = match;

    // Generate expected flag for this user
    const expectedFlag = this.generateFlag(realmId, userId);

    // Extract UUID from expected flag
    const expectedUuidMatch = expectedFlag.match(/([a-f0-9-]+)\}$/);
    if (!expectedUuidMatch) {
      return { valid: false, error: 'Failed to generate expected flag' };
    }

    const expectedUuid = expectedUuidMatch[1];

    // Compare UUIDs (case-insensitive)
    const isValid = providedUuid.toLowerCase() === expectedUuid.toLowerCase();

    if (isValid) {
      return {
        valid: true,
        realm: realmId.toUpperCase(),
      };
    }

    return {
      valid: false,
      error: 'Flag does not match expected value for this user',
    };
  }

  /**
   * Batch generate flags for a user across all realms
   * Useful for testing or user flag export
   *
   * @param userId - User identifier
   * @param realmIds - Array of realm identifiers
   * @returns Map of realmId to flag
   */
  generateFlagsForUser(userId: string, realmIds: string[]): Map<string, string> {
    const flags = new Map<string, string>();

    for (const realmId of realmIds) {
      try {
        const flag = this.generateFlag(realmId, userId);
        flags.set(realmId.toUpperCase(), flag);
      } catch (error) {
        // Skip invalid realm IDs
        continue;
      }
    }

    return flags;
  }

  /**
   * Get realm ID from a flag without verification
   * Useful for routing/logging before validation
   *
   * @param flag - Flag to parse
   * @returns Realm ID or null if invalid format
   */
  static extractRealmId(flag: string): string | null {
    const match = flag.match(/^YGGDRASIL\{([A-Z_]+):[a-f0-9-]+\}$/i);
    return match ? match[1].toUpperCase() : null;
  }
}
