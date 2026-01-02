import axios from 'axios';

export interface ProgressionData {
  userId: string;
  unlockedRealms: string[];
  flags: string[];
  lastUpdated: string;
}

export class ProgressionClient {
  constructor(private flagOracleUrl: string) {}

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
