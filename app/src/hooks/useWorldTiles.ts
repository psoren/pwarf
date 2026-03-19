import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  createWorldDeriver,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  type WorldDeriver,
  type WorldTile,
} from '@pwarf/shared';

interface UseWorldTilesOptions {
  worldId: string | null;
  worldSeed: bigint | null;
  offsetX: number;
  offsetY: number;
  viewportCols: number;
  viewportRows: number;
}

const CACHE_MAX = 20_000;

export function useWorldTiles({ worldId, worldSeed, offsetX, offsetY, viewportCols, viewportRows }: UseWorldTilesOptions) {
  // DB overrides (explored tiles, etc.)
  const [dbOverrides, setDbOverrides] = useState<Map<string, Partial<WorldTile>>>(new Map());
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchKey = useRef<string>('');

  // Create deriver once per seed
  const deriver = useMemo<WorldDeriver | null>(() => {
    if (worldSeed == null) return null;
    return createWorldDeriver(worldSeed);
  }, [worldSeed]);

  // Tile cache — persists across renders, cleared when underlying data changes
  const cacheRef = useRef(new Map<string, WorldTile>());
  const cacheGenRef = useRef(0);

  // Clear cache when deriver or overrides change
  useEffect(() => {
    cacheRef.current.clear();
    cacheGenRef.current += 1;
  }, [deriver, dbOverrides]);

  // Use refs for offset/viewport so DB fetch doesn't need them as deps
  const offsetRef = useRef({ x: offsetX, y: offsetY });
  offsetRef.current = { x: offsetX, y: offsetY };
  const vpRef = useRef({ cols: viewportCols, rows: viewportRows });
  vpRef.current = { cols: viewportCols, rows: viewportRows };

  // Debounced fetch of modified tiles from DB
  useEffect(() => {
    if (!worldId) return;

    function doFetch() {
      const { x: ox, y: oy } = offsetRef.current;
      const { cols, rows } = vpRef.current;
      const buffer = Math.max(cols, rows);
      const x0 = Math.max(0, ox - buffer);
      const y0 = Math.max(0, oy - buffer);
      const x1 = Math.min(WORLD_WIDTH, ox + cols + buffer);
      const y1 = Math.min(WORLD_HEIGHT, oy + rows + buffer);

      const key = `${worldId}:${x0}:${y0}:${x1}:${y1}`;
      if (key === lastFetchKey.current) return;

      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(async () => {
        lastFetchKey.current = key;

        const { data, error } = await supabase
          .from('world_tiles')
          .select('x, y, terrain, elevation, biome_tags, explored')
          .eq('world_id', worldId)
          .gte('x', x0)
          .lt('x', x1)
          .gte('y', y0)
          .lt('y', y1);

        if (error) {
          console.error('[useWorldTiles] fetch error:', error.message);
          return;
        }

        if (data && data.length > 0) {
          const newOverrides = new Map<string, Partial<WorldTile>>();
          for (const tile of data) {
            newOverrides.set(`${tile.x},${tile.y}`, tile as Partial<WorldTile>);
          }
          setDbOverrides(newOverrides);
        }
      }, 100);
    }

    doFetch();

    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [worldId, offsetX, offsetY, viewportCols, viewportRows]);

  // On-demand tile derivation with cache
  const getTile = useCallback((x: number, y: number): WorldTile | null => {
    if (!deriver || !worldId) return null;

    const key = `${x},${y}`;
    const cached = cacheRef.current.get(key);
    if (cached) return cached;

    // Evict if cache is too large
    if (cacheRef.current.size >= CACHE_MAX) {
      cacheRef.current.clear();
    }

    const derived = deriver.deriveTile(x, y);
    const override = dbOverrides.get(key);

    const tile: WorldTile = {
      id: '',
      world_id: worldId,
      coord: null,
      x,
      y,
      terrain: override?.terrain ?? derived.terrain,
      elevation: override?.elevation ?? derived.elevation,
      biome_tags: override?.biome_tags ?? derived.biome_tags,
      explored: override?.explored ?? false,
    };

    cacheRef.current.set(key, tile);
    return tile;
  }, [deriver, worldId, dbOverrides]);

  return { getTile };
}
