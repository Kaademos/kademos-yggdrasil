import { useState, useEffect } from 'react';
import { LeaderboardEntry, LeaderboardResponse } from '../types/realm';

/**
 * Hook to fetch the global leaderboard.
 */
export function useLeaderboard(limit = 20) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/leaderboard?limit=${limit}`, {
          credentials: 'same-origin',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
        }

        const data: LeaderboardResponse = await response.json();
        setEntries(data.leaderboard);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [limit]);

  return { entries, loading, error };
}
