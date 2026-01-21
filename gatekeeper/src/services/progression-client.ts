import axios from 'axios';
import { injectable, inject } from 'tsyringe';

export interface ProgressionData {
  userId: string;
  unlockedRealms: string[];
  flags: string[];
  lastUpdated: string;
}

@injectable()
export class ProgressionClient {
  constructor(@inject('Config') private config: any) {
    this.flagOracleUrl = config.flagOracleUrl;
  }

  private flagOracleUrl: string;

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
}
