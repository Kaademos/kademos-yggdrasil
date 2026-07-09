/**
 * Unit tests for ProgressionClient.
 *
 * Regression guard: the client was constructed by the DI factory with the
 * flag-oracle base URL *string*, but an earlier constructor expected the whole
 * Config object and read `.flagOracleUrl` off it — yielding `undefined`. Every
 * request then went to `undefined/leaderboard`, breaking the leaderboard and
 * hints with a 500 ("Invalid URL"). These tests pin the URL construction so a
 * mismatch like that fails here instead of in production.
 */
import 'reflect-metadata';
import axios from 'axios';
import { ProgressionClient } from '../src/services/progression-client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const BASE = 'http://flag-oracle:3001';

describe('ProgressionClient', () => {
  let client: ProgressionClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // Constructed exactly as the DI factory does: with the base URL string.
    client = new ProgressionClient(BASE);
  });

  it('builds the leaderboard URL from the configured base (never "undefined/...")', async () => {
    mockedAxios.get.mockResolvedValue({ data: { leaderboard: [{ userId: 'u', rank: 1 }] } });

    const result = await client.getLeaderboard(25);

    expect(mockedAxios.get).toHaveBeenCalledWith(`${BASE}/leaderboard`, {
      params: { limit: 25 },
    });
    const [url] = mockedAxios.get.mock.calls[0];
    expect(url).not.toContain('undefined');
    expect(result).toEqual([{ userId: 'u', rank: 1 }]);
  });

  it('returns an empty array when the oracle reports no leaderboard entries', async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: 'ok' } });
    await expect(client.getLeaderboard()).resolves.toEqual([]);
  });

  it('builds the hints URL from the configured base', async () => {
    mockedAxios.get.mockResolvedValue({ data: { hints: [] } });

    await client.getHints('user-1', 'niflheim');

    expect(mockedAxios.get).toHaveBeenCalledWith(`${BASE}/hints/niflheim`, {
      params: { userId: 'user-1' },
    });
    expect(mockedAxios.get.mock.calls[0][0]).not.toContain('undefined');
  });

  it('builds the validate and progress URLs from the configured base', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'success' } });
    mockedAxios.get.mockResolvedValue({ data: { userId: 'user-1' } });

    await client.validateFlag('user-1', 'FLAG{x}');
    await client.getProgression('user-1');

    expect(mockedAxios.post).toHaveBeenCalledWith(`${BASE}/validate`, {
      userId: 'user-1',
      flag: 'FLAG{x}',
    });
    expect(mockedAxios.get).toHaveBeenCalledWith(`${BASE}/progress/user-1`);
    for (const call of [...mockedAxios.get.mock.calls, ...mockedAxios.post.mock.calls]) {
      expect(String(call[0])).not.toContain('undefined');
    }
  });
});
