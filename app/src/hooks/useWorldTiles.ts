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

export function useWorldTiles({ worldId, offsetX, offsetY, viewportCols, viewportRows }: UseWorldTilesOptions) {
  const [tileMap, setTileMap] = useState<Map<string, WorldTile>>(new Map());
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchKey = useRef<string>('');

  // Fetch with a buffer around the viewport for smooth panning
  const fetchTiles = useCallback(async (wId: string, ox: number, oy: number, cols: number, rows: number) => {
    const buffer = Math.max(cols, rows); // fetch extra tiles around viewport
    const x0 = Math.max(0, ox - buffer);
    const y0 = Math.max(0, oy - buffer);
    const x1 = ox + cols + buffer;
    const y1 = oy + rows + buffer;

    const { data, error } = await supabase
      .from('world_tiles')
      .select('id, world_id, x, y, terrain, elevation, biome_tags, explored')
      .eq('world_id', wId)
      .gte('x', x0)
      .lt('x', x1)
      .gte('y', y0)
      .lt('y', y1);

    if (error) {
      console.error('[useWorldTiles] fetch error:', error.message);
      return;
    }

    if (data) {
      const newMap = new Map<string, WorldTile>();
      for (const tile of data as WorldTile[]) {
        newMap.set(`${tile.x},${tile.y}`, tile);
      }
      setTileMap(newMap);
    }
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
