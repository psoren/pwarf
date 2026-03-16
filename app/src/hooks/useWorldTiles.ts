import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { WorldTile } from '@pwarf/shared';

interface UseWorldTilesOptions {
  worldId: string | null;
  offsetX: number;
  offsetY: number;
  viewportCols: number;
  viewportRows: number;
}

const BUFFER = 10; // extra tiles around viewport for smooth panning
const PAGE_SIZE = 1000; // Supabase default row limit

export function useWorldTiles({ worldId, offsetX, offsetY, viewportCols, viewportRows }: UseWorldTilesOptions) {
  const [tileMap, setTileMap] = useState<Map<string, WorldTile>>(new Map());
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchKey = useRef<string>('');

  // Fetch with a small buffer around the viewport, paginating to get all rows
  const fetchTiles = useCallback(async (wId: string, ox: number, oy: number, cols: number, rows: number) => {
    const x0 = Math.max(0, ox - BUFFER);
    const y0 = Math.max(0, oy - BUFFER);
    const x1 = ox + cols + BUFFER;
    const y1 = oy + rows + BUFFER;

    const allTiles: WorldTile[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('world_tiles')
        .select('id, world_id, x, y, terrain, elevation, biome_tags, explored')
        .eq('world_id', wId)
        .gte('x', x0)
        .lt('x', x1)
        .gte('y', y0)
        .lt('y', y1)
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('[useWorldTiles] fetch error:', error.message);
        return;
      }

      if (data) {
        allTiles.push(...(data as WorldTile[]));
      }

      hasMore = data !== null && data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    // Merge into existing map so tiles outside the new range aren't lost
    setTileMap((prev) => {
      const merged = new Map(prev);
      for (const tile of allTiles) {
        merged.set(`${tile.x},${tile.y}`, tile);
      }
      return merged;
    });
  }, []);

  useEffect(() => {
    if (!worldId) return;

    const key = `${worldId}:${offsetX}:${offsetY}:${viewportCols}:${viewportRows}`;
    if (key === lastFetchKey.current) return;

    // Debounce fetches by 100ms
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => {
      lastFetchKey.current = key;
      fetchTiles(worldId, offsetX, offsetY, viewportCols, viewportRows);
    }, 100);

    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [worldId, offsetX, offsetY, viewportCols, viewportRows, fetchTiles]);

  const getTile = useCallback((x: number, y: number): WorldTile | null => {
    return tileMap.get(`${x},${y}`) ?? null;
  }, [tileMap]);

  return { tileMap, getTile };
}
