import axios from 'axios';
import { injectable } from 'tsyringe';

export interface ProgressionData {
  userId: string;
  unlockedRealms: string[];
  flags: string[];
  lastUpdated: string;
}

export interface LeaderboardEntry {
  userId: string;
  score: number;
  realmsCompleted: number;
  rank: number;
}

@injectable()
export class ProgressionClient {
  private flagOracleUrl: string;

  // Constructed via the DI factory in config/di.ts, which passes the resolved
  // flag-oracle base URL string (config.flagOracleUrl) — not the Config object.
  constructor(flagOracleUrl: string) {
    this.flagOracleUrl = flagOracleUrl;
  }

  async getProgression(userId: string): Promise<ProgressionData | null> {
    try {
      const response = await axios.get(`${this.flagOracleUrl}/progress/${userId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async validateFlag(userId: string, flag: string) {
    const response = await axios.post(`${this.flagOracleUrl}/validate`, {
      userId,
      flag,
    });
    return response.data;
  }

  async getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
    const response = await axios.get(`${this.flagOracleUrl}/leaderboard`, {
      params: { limit },
    });
    return response.data?.leaderboard ?? [];
  }

  async getHints(userId: string, realm: string) {
    const response = await axios.get(`${this.flagOracleUrl}/hints/${realm}`, {
      params: { userId },
    });
    return response.data;
  }

  async revealHint(userId: string, realm: string, order: number) {
    const response = await axios.post(`${this.flagOracleUrl}/hint`, {
      userId,
      realm,
      order,
    });
    return response.data;
  }
}
