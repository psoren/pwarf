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

  // Fetch only modified tiles from DB (explored, etc.)
  useEffect(() => {
    if (!worldId) return;

    const buffer = Math.max(viewportCols, viewportRows);
    const x0 = Math.max(0, offsetX - buffer);
    const y0 = Math.max(0, offsetY - buffer);
    const x1 = Math.min(WORLD_WIDTH, offsetX + viewportCols + buffer);
    const y1 = Math.min(WORLD_HEIGHT, offsetY + viewportRows + buffer);

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

    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [worldId, offsetX, offsetY, viewportCols, viewportRows]);

  // Build tileMap by deriving tiles from seed + overlaying DB overrides
  const tileMap = useMemo(() => {
    if (!deriver || !worldId) return new Map<string, WorldTile>();

    const map = new Map<string, WorldTile>();
    const buffer = Math.max(viewportCols, viewportRows);
    const x0 = Math.max(0, offsetX - buffer);
    const y0 = Math.max(0, offsetY - buffer);
    const x1 = Math.min(WORLD_WIDTH, offsetX + viewportCols + buffer);
    const y1 = Math.min(WORLD_HEIGHT, offsetY + viewportRows + buffer);

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const key = `${x},${y}`;
        const derived = deriver.deriveTile(x, y);
        const override = dbOverrides.get(key);

        map.set(key, {
          id: '',
          world_id: worldId,
          coord: null,
          x,
          y,
          terrain: override?.terrain ?? derived.terrain,
          elevation: override?.elevation ?? derived.elevation,
          biome_tags: override?.biome_tags ?? derived.biome_tags,
          explored: override?.explored ?? false,
        });
      }
    }
    return map;
  }, [deriver, worldId, offsetX, offsetY, viewportCols, viewportRows, dbOverrides]);

  const getTile = useCallback((x: number, y: number): WorldTile | null => {
    return tileMap.get(`${x},${y}`) ?? null;
  }, [tileMap]);

  return { tileMap, getTile };
}
