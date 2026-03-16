import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  createFortressDeriver,
  FORTRESS_SIZE,
  type FortressDeriver,
  type DerivedFortressTile,
  type FortressTile,
  type FortressTileType,
} from '@pwarf/shared';

export interface FortressViewTile extends DerivedFortressTile {
  x: number;
  y: number;
  z: number;
  isRevealed: boolean;
  isMined: boolean;
}

interface UseFortressTilesOptions {
  civId: string | null;
  worldSeed: bigint | null;
  offsetX: number;
  offsetY: number;
  zLevel: number;
  viewportCols: number;
  viewportRows: number;
}

export function useFortressTiles({
  civId,
  worldSeed,
  offsetX,
  offsetY,
  zLevel,
  viewportCols,
  viewportRows,
}: UseFortressTilesOptions) {
  const [dbOverrides, setDbOverrides] = useState<Map<string, Partial<FortressTile>>>(new Map());
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchKey = useRef<string>('');

  // Create deriver once per seed + civId
  const deriver = useMemo<FortressDeriver | null>(() => {
    if (worldSeed == null || !civId) return null;
    return createFortressDeriver(worldSeed, civId);
  }, [worldSeed, civId]);

  // Fetch modified tiles from DB
  useEffect(() => {
    if (!civId) return;

    const buffer = Math.max(viewportCols, viewportRows);
    const x0 = Math.max(0, offsetX - buffer);
    const y0 = Math.max(0, offsetY - buffer);
    const x1 = Math.min(FORTRESS_SIZE, offsetX + viewportCols + buffer);
    const y1 = Math.min(FORTRESS_SIZE, offsetY + viewportRows + buffer);

    const key = `${civId}:${zLevel}:${x0}:${y0}:${x1}:${y1}`;
    if (key === lastFetchKey.current) return;

    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      lastFetchKey.current = key;

      const { data, error } = await supabase
        .from('fortress_tiles')
        .select('x, y, z, tile_type, material, is_revealed, is_mined')
        .eq('civilization_id', civId)
        .eq('z', zLevel)
        .gte('x', x0)
        .lt('x', x1)
        .gte('y', y0)
        .lt('y', y1)
        .limit(5000);

      if (error) {
        console.error('[useFortressTiles] fetch error:', error.message);
        return;
      }

      if (data) {
        const newOverrides = new Map<string, Partial<FortressTile>>();
        for (const tile of data) {
          newOverrides.set(`${tile.x},${tile.y}`, tile as Partial<FortressTile>);
        }
        setDbOverrides(newOverrides);
      }
    }, 100);

    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [civId, zLevel, offsetX, offsetY, viewportCols, viewportRows]);

  // Build tile map
  const tileMap = useMemo(() => {
    if (!deriver || !civId) return new Map<string, FortressViewTile>();

    const map = new Map<string, FortressViewTile>();
    const buffer = Math.max(viewportCols, viewportRows);
    const x0 = Math.max(0, offsetX - buffer);
    const y0 = Math.max(0, offsetY - buffer);
    const x1 = Math.min(FORTRESS_SIZE, offsetX + viewportCols + buffer);
    const y1 = Math.min(FORTRESS_SIZE, offsetY + viewportRows + buffer);

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const key = `${x},${y}`;
        const derived = deriver.deriveTile(x, y, zLevel);
        const override = dbOverrides.get(key);

        map.set(key, {
          x,
          y,
          z: zLevel,
          tileType: (override?.tile_type as FortressTileType) ?? derived.tileType,
          material: override?.material ?? derived.material,
          isRevealed: override?.is_revealed ?? false,
          isMined: override?.is_mined ?? false,
        });
      }
    }
    return map;
  }, [deriver, civId, zLevel, offsetX, offsetY, viewportCols, viewportRows, dbOverrides]);

  const getTile = useCallback(
    (x: number, y: number): FortressViewTile | null => {
      return tileMap.get(`${x},${y}`) ?? null;
    },
    [tileMap],
  );

  return { tileMap, getTile, deriver };
}
