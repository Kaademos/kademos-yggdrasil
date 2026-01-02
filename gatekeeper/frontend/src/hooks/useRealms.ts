import { useState, useEffect } from 'react';
import { Realm, RealmsResponse } from '../types/realm';

/**
 * Hook to fetch and manage realm data
 */
export function useRealms() {
  const [realms, setRealms] = useState<Realm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchRealms = async () => {
      try {
        setLoading(true);
        const response = await fetch('/realms', {
          credentials: 'same-origin', // Include cookies for auth
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch realms: ${response.statusText}`);
        }

        const data: RealmsResponse = await response.json();
        setRealms(data.realms);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching realms:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRealms();
  }, []);

  return { realms, loading, error };
}

/**
 * Get production realms (excluding sample)
 */
export function useProductionRealms() {
  const { realms, loading, error } = useRealms();
  const productionRealms = realms.filter(r => r.name !== 'sample');
  return { realms: productionRealms, loading, error };
}

/**
 * Get realms sorted by order
 */
export function useRealmsSorted(ascending = false) {
  const { realms, loading, error } = useRealms();
  const sorted = [...realms].sort((a, b) => 
    ascending ? a.order - b.order : b.order - a.order
  );
  return { realms: sorted, loading, error };
}
