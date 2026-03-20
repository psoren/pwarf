import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { POLL_FORTRESS_TILES_MS } from '@pwarf/shared';

/**
 * Load stockpile tiles for a civilization, returning a Set of "x,y,z" keys.
 * Polls on the same interval as fortress tiles.
 */
export function useStockpileTiles(civId: string | null): Set<string> {
  const [tiles, setTiles] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!civId) {
      setTiles(new Set());
      return;
    }

    async function fetch() {
      const { data, error } = await supabase
        .from('stockpile_tiles')
        .select('x, y, z')
        .eq('civilization_id', civId!);

      if (!error && data) {
        const set = new Set<string>();
        for (const row of data) {
          set.add(`${row.x},${row.y},${row.z}`);
        }
        setTiles(set);
      }
    }

    void fetch();
    pollRef.current = setInterval(() => void fetch(), POLL_FORTRESS_TILES_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [civId]);

  return tiles;
}
