import React, { useEffect, useState } from 'react';
import { useRealmsSorted } from '../hooks/useRealms';

interface HintItem {
  order: number;
  revealed: boolean;
  text?: string;
}

interface RealmHints {
  realm: string;
  basePoints: number;
  hintsRevealed: number;
  totalHints: number;
  potentialPoints: number;
  hints: HintItem[];
}

async function getCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch('/csrf-token', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.csrfToken ?? null;
  } catch {
    return null;
  }
}

export const Hints: React.FC = () => {
  const { realms: allRealms, loading: realmsLoading } = useRealmsSorted();
  // Exclude the internal sample realm so the panel defaults to a real, hint-bearing
  // realm (Niflheim, the entry) rather than the test realm.
  const realms = allRealms.filter((r) => r.name !== 'sample');
  const [selected, setSelected] = useState<string>('');
  const [data, setData] = useState<RealmHints | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to the first realm once realms load.
  useEffect(() => {
    if (!selected && realms.length > 0) {
      setSelected(realms[0].name);
    }
  }, [realms, selected]);

  const loadHints = async (realm: string) => {
    if (!realm) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/realms/${realm}/hints`, { credentials: 'same-origin' });
      if (res.status === 404) {
        setData(null);
        setError('No hints available for this realm yet.');
        return;
      }
      if (!res.ok) throw new Error(res.statusText);
      setData(await res.json());
    } catch (err) {
      setError('Failed to load hints.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selected) loadHints(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const revealHint = async (order: number) => {
    const token = await getCsrfToken();
    if (!token) {
      setError('Could not obtain a CSRF token. Try reloading.');
      return;
    }
    try {
      const res = await fetch(`/realms/${selected}/hint`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'CSRF-Token': token },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error(res.statusText);
      await loadHints(selected); // refresh with the revealed hint + new potential score
    } catch (err) {
      setError('Failed to reveal hint.');
      console.error(err);
    }
  };

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2
            className="text-4xl md:text-5xl font-bold tracking-widest mb-4 uppercase"
            style={{ fontFamily: 'Cinzel, serif', textShadow: '0 0 20px rgba(96, 165, 250, 0.3)' }}
          >
            Mimir's Counsel
          </h2>
          <p className="text-gray-400">
            Stuck? Seek a hint — but each whisper costs you score. Your progress is never blocked.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-8">
          <label htmlFor="hint-realm" className="text-gray-400 text-sm uppercase tracking-wider">
            Realm
          </label>
          <select
            id="hint-realm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={realmsLoading}
            className="bg-slate-800 border border-white/10 rounded px-4 py-2 text-gray-200"
          >
            {realms.map((r) => (
              <option key={r.name} value={r.name}>
                {r.displayName}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="text-center text-gray-500">Consulting the well of wisdom…</p>}
        {error && <p className="text-center text-amber-400">{error}</p>}

        {data && !loading && (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-400 px-1">
              <span>
                Revealed {data.hintsRevealed}/{data.totalHints}
              </span>
              <span>
                Worth now: <span className="text-yellow-300 font-semibold">{data.potentialPoints}</span> /{' '}
                {data.basePoints} pts
              </span>
            </div>

            {data.hints.map((h) => (
              <div
                key={h.order}
                className="rounded-lg border border-white/10 bg-slate-800/60 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-300">Hint {h.order}</span>
                  {!h.revealed && (
                    <button
                      onClick={() => revealHint(h.order)}
                      className="text-sm px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                      Reveal (−score)
                    </button>
                  )}
                </div>
                {h.revealed && <p className="mt-2 text-gray-200">{h.text}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
