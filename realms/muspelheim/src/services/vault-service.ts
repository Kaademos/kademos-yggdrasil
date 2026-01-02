/**
 * Vault Service
 * 
 * Controls access to the vault (flag) based on exploitation status
 */

export class VaultService {
  constructor(private flag: string) {}

  /**
   * Access vault - requires successful exploitation
   */
  accessVault(exploited: boolean): { 
    access: boolean; 
    message: string; 
    flag?: string;
    secrets?: string[];
  } {
    if (!exploited) {
      return {
        access: false,
        message: 'Vault locked. Only those who master the fire realm\'s trades may enter.',
      };
    }

    return {
      access: true,
      message: 'Vault unlocked! The flames reveal their secrets.',
      flag: this.flag,
      secrets: [
        'Business logic flaws can be as dangerous as technical vulnerabilities',
        'Always validate state transitions in the correct order',
        'Financial operations must be atomic - all or nothing',
        'Never release resources before verifying conditions are met',
      ],
    };
  }
}
