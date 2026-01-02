import * as fs from 'fs/promises';
import * as path from 'path';

export interface UserProgression {
  userId: string;
  unlockedRealms: string[];
  flags: string[];
  lastUpdated: string;
}

export interface FlagData {
  realm: string;
  flag: string;
  nextRealm?: string;
}

export interface IFlagRepository {
  getProgression(userId: string): Promise<UserProgression | null>;
  updateProgression(userId: string, realm: string, flag: string): Promise<void>;
  getValidFlags(): Promise<FlagData[]>;
}

export class FileBasedFlagRepository implements IFlagRepository {
  private dataPath: string;
  private progressionFile: string;
  private flagsFile: string;

  constructor(dataPath: string) {
    this.dataPath = dataPath;
    this.progressionFile = path.join(dataPath, 'progression.json');
    this.flagsFile = path.join(dataPath, 'flags.json');
  }

  async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.dataPath);
    } catch {
      await fs.mkdir(this.dataPath, { recursive: true });
    }
  }

  async getProgression(userId: string): Promise<UserProgression | null> {
    await this.ensureDataDirectory();

    try {
      const data = await fs.readFile(this.progressionFile, 'utf-8');
      const progressions: Record<string, UserProgression> = JSON.parse(data);
      return progressions[userId] || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async updateProgression(userId: string, realm: string, flag: string): Promise<void> {
    await this.ensureDataDirectory();

    let progressions: Record<string, UserProgression> = {};

    try {
      const data = await fs.readFile(this.progressionFile, 'utf-8');
      progressions = JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    const existing = progressions[userId] || {
      userId,
      unlockedRealms: [],
      flags: [],
      lastUpdated: new Date().toISOString(),
    };

    if (!existing.unlockedRealms.includes(realm)) {
      existing.unlockedRealms.push(realm);
    }

    if (!existing.flags.includes(flag)) {
      existing.flags.push(flag);
    }

    existing.lastUpdated = new Date().toISOString();
    progressions[userId] = existing;

    const tempFile = `${this.progressionFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(progressions, null, 2), 'utf-8');
    await fs.rename(tempFile, this.progressionFile);
  }

  async getValidFlags(): Promise<FlagData[]> {
    await this.ensureDataDirectory();

    try {
      const data = await fs.readFile(this.flagsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Default flags for all realms (10 → 1)
        const defaultFlags: FlagData[] = [
          {
            realm: 'NIFLHEIM',
            flag: 'YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}',
            nextRealm: 'HELHEIM',
          },
          {
            realm: 'HELHEIM',
            flag: 'YGGDRASIL{HELHEIM:e1a93eab-4720-4ef8-a2eb-342a77e9f200}',
            nextRealm: 'SVARTALFHEIM',
          },
          {
            realm: 'SVARTALFHEIM',
            flag: 'YGGDRASIL{SVARTALFHEIM:77c7df6c-2625-45aa-a00f-37a415c8a97e}',
            nextRealm: 'JOTUNHEIM',
          },
          {
            realm: 'JOTUNHEIM',
            flag: 'YGGDRASIL{JOTUNHEIM:522fb48d-0399-41ea-8e8d-9745900585bc}',
            nextRealm: 'MUSPELHEIM',
          },
          {
            realm: 'MUSPELHEIM',
            flag: 'YGGDRASIL{MUSPELHEIM:b1aea18f-ce5b-4f34-b45a-99166cb72236}',
            nextRealm: 'NIDAVELLIR',
          },
          {
            realm: 'NIDAVELLIR',
            flag: 'YGGDRASIL{NIDAVELLIR:969cb870-99ee-4431-b645-3fe818fc2ceb}',
            nextRealm: 'VANAHEIM',
          },
          // Realms 4-1 will be added in M5
          {
            realm: 'SAMPLE',
            flag: 'YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}',
            nextRealm: 'COMPLETE',
          },
        ];
        await fs.writeFile(this.flagsFile, JSON.stringify(defaultFlags, null, 2), 'utf-8');
        return defaultFlags;
      }
      throw error;
    }
  }
}
