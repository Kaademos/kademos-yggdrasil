import React from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';

const rankBadge = (rank: number): string => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

export const Leaderboard: React.FC = () => {
  const { entries, loading, error } = useLeaderboard(20);

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="text-4xl md:text-5xl font-bold tracking-widest mb-4 uppercase"
            style={{ fontFamily: 'Cinzel, serif', textShadow: '0 0 20px rgba(234, 179, 8, 0.3)' }}
          >
            Hall of the Slain
          </h2>
          <p className="text-gray-400">The mightiest warriors of the Ten Realms</p>
        </div>

        {loading && (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-800 rounded"></div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-center text-red-400">Failed to load the leaderboard. Try again later.</p>
        )}

        {!loading && !error && entries.length === 0 && (
          <p className="text-center text-gray-500">
            No warriors have claimed a flag yet. Be the first to ascend.
          </p>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left">
              <thead className="bg-white/5 text-gray-400 text-sm uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-20">Rank</th>
                  <th className="px-4 py-3">Warrior</th>
                  <th className="px-4 py-3 text-right">Realms</th>
                  <th className="px-4 py-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={`${e.rank}-${e.handle}`}
                    className={`border-t border-white/5 ${
                      e.isYou ? 'bg-yellow-500/10 text-yellow-200' : 'text-gray-200'
                    }`}
                  >
                    <td className="px-4 py-3 font-bold">{rankBadge(e.rank)}</td>
                    <td className="px-4 py-3 font-mono">
                      {e.handle}
                      {e.isYou && <span className="ml-2 text-xs text-yellow-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{e.realmsCompleted}</td>
                    <td className="px-4 py-3 text-right font-semibold">{e.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
