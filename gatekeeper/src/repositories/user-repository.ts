import { User } from '../models/user';
import bcrypt from 'bcrypt';

export interface IUserRepository {
  findByUsername(username: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(username: string, password: string): Promise<User>;
}

export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private readonly bcryptRounds: number;
  private readonly testUserPassword: string;
  private seeded: boolean = false;

  constructor(
    bcryptRounds: number = 10,
    autoSeed: boolean = true,
    testUserPassword: string = 'yggdrasil123'
  ) {
    this.bcryptRounds = bcryptRounds;
    this.testUserPassword = testUserPassword;
    if (autoSeed) {
      this.seedTestUsers();
    }
  }

  async seedTestUsers(): Promise<void> {
    if (this.seeded) return;

    // Pre-seed the default "weaver" test user
    try {
      const defaultUser = await this.create('weaver', this.testUserPassword);
      this.seeded = true;
      console.info(`[UserRepository] Seeded test user: ${defaultUser.username}`);
    } catch (error) {
      // User might already exist
      this.seeded = true;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
    return user || null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async create(username: string, password: string): Promise<User> {
    // Check if user already exists
    const existing = await this.findByUsername(username);
    if (existing) {
      throw new Error('Username already exists');
    }

    // Validate inputs
    if (!username || username.trim().length === 0) {
      throw new Error('Username is required');
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.bcryptRounds);

    // Create user
    const user: User = {
      id: this.generateId(),
      username: username.trim(),
      passwordHash,
      createdAt: new Date(),
    };

    this.users.set(user.id, user);
    return user;
  }

  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Test helper methods
  async clear(): Promise<void> {
    this.users.clear();
  }

  async count(): Promise<number> {
    return this.users.size;
  }
}

export class UserRepositoryFactory {
  static create(bcryptRounds: number = 10, testUserPassword?: string): IUserRepository {
    // For M2, we only have in-memory implementation
    // Future: Add Redis/DB-based repository
    return new InMemoryUserRepository(bcryptRounds, true, testUserPassword);
  }
}
