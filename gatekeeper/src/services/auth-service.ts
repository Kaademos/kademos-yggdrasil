import { injectable, inject } from 'tsyringe';
import { Config } from '../config';
import bcrypt from 'bcrypt';
import { User } from '../models/user';
import { IUserRepository } from '../repositories/user-repository';

export interface AuthResult {
  success: boolean;
  user?: User;
  message?: string;
}

@injectable()
export class AuthService {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository,
    @inject('Config') private config: Pick<Config, 'bcryptRounds'> = { bcryptRounds: 10 }
  ) {
    this.bcryptRounds = config.bcryptRounds || 10;
  }

  private bcryptRounds: number;

  async authenticate(username: string, password: string): Promise<User | null> {
    // Find user
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      // Add small random delay to prevent timing attacks
      await this.randomDelay(50, 150);
      return null;
    }

    // Verify password
    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      // Add small random delay to prevent timing attacks
      await this.randomDelay(50, 150);
      return null;
    }

    return user;
  }

  async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    return bcrypt.hash(password, this.bcryptRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('[AuthService] Error verifying password:', error);
      return false;
    }
  }

  private async randomDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
