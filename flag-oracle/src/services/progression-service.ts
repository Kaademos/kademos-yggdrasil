import { FlagValidator } from './flag-validator';
import { IFlagRepository } from '../repositories/flag-repository';
import { ProgressionValidator } from './progression-validator';

export interface ValidationResult {
  status: 'success' | 'error' | 'invalid';
  message: string;
  unlocked?: string;
  realm?: string;
}

export class ProgressionService {
  constructor(
    private repository: IFlagRepository,
    private validator: FlagValidator,
    private progressionValidator?: ProgressionValidator
  ) {}

  async validateFlag(userId: string, flag: string): Promise<ValidationResult> {
    if (!userId || typeof userId !== 'string') {
      return {
        status: 'error',
        message: 'Invalid userId',
      };
    }

    const validationResult = this.validator.validate(flag);
    if (!validationResult.valid) {
      return {
        status: 'invalid',
        message: validationResult.error || 'Invalid flag format',
      };
    }

    const validFlags = await this.repository.getValidFlags();
    const matchingFlag = validFlags.find(
      (f) => f.realm === validationResult.realm && f.flag === flag
    );

    if (!matchingFlag) {
      return {
        status: 'invalid',
        message: 'Flag not found',
      };
    }

    const progression = await this.repository.getProgression(userId);
    const unlockedRealms = progression?.unlockedRealms || [];

    if (this.progressionValidator) {
      if (!this.progressionValidator.canAccessRealm(matchingFlag.realm, unlockedRealms)) {
        return {
          status: 'error',
          message: 'Previous realm must be completed first',
        };
      }
    }

    if (progression && progression.flags.includes(flag)) {
      return {
        status: 'success',
        message: 'Flag already submitted',
        realm: matchingFlag.realm,
        unlocked: matchingFlag.nextRealm,
      };
    }

    await this.repository.updateProgression(userId, matchingFlag.realm, flag);

    return {
      status: 'success',
      message: 'Flag accepted',
      realm: matchingFlag.realm,
      unlocked: matchingFlag.nextRealm,
    };
  }

  async getProgression(userId: string) {
    if (!userId || typeof userId !== 'string') {
      return null;
    }
    return this.repository.getProgression(userId);
  }
}
