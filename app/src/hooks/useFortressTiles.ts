import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  createFortressDeriver,
  FORTRESS_SIZE,
  POLL_FORTRESS_TILES_MS,
  type FortressDeriver,
  type DerivedFortressTile,
  type FortressTile,
  type FortressTileType,
  type TerrainType,
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
  terrain: TerrainType | null;
  offsetX: number;
  offsetY: number;
  zLevel: number;
  viewportCols: number;
  viewportRows: number;
}

const CACHE_MAX = 20_000;

export function useFortressTiles({
  civId,
  worldSeed,
  terrain,
  offsetX,
  offsetY,
  zLevel,
  viewportCols,
  viewportRows,
}: UseFortressTilesOptions) {
  const [dbOverrides, setDbOverrides] = useState<Map<string, Partial<FortressTile>>>(new Map());
  const lastFetchKey = useRef<string>('');

  // Create deriver once per seed + civId
  const deriver = useMemo<FortressDeriver | null>(() => {
    if (worldSeed == null || !civId) return null;
    return createFortressDeriver(worldSeed, civId, terrain ?? "plains");
  }, [worldSeed, civId, terrain]);

  // Tile cache
  const cacheRef = useRef(new Map<string, FortressViewTile>());

  // Clear cache when underlying data changes
  useEffect(() => {
    cacheRef.current.clear();
  }, [deriver, dbOverrides, zLevel]);

  // Use refs for offset/viewport so fetchOverrides stays stable
  const offsetRef = useRef({ x: offsetX, y: offsetY });
  offsetRef.current = { x: offsetX, y: offsetY };
  const vpRef = useRef({ cols: viewportCols, rows: viewportRows });
  vpRef.current = { cols: viewportCols, rows: viewportRows };

  // Stable fetch function — reads offset/viewport from refs
  const fetchOverrides = useCallback(async (force = false) => {
    if (!civId) return;

    const { x: ox, y: oy } = offsetRef.current;
    const { cols, rows } = vpRef.current;
    const buffer = Math.max(cols, rows);
    const x0 = Math.max(0, ox - buffer);
    const y0 = Math.max(0, oy - buffer);
    const x1 = Math.min(FORTRESS_SIZE, ox + cols + buffer);
    const y1 = Math.min(FORTRESS_SIZE, oy + rows + buffer);

    const key = `${civId}:${zLevel}:${x0}:${y0}:${x1}:${y1}`;
    if (!force && key === lastFetchKey.current) return;
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
  }, [civId, zLevel]); // stable — no offset/viewport deps

  // Fetch on viewport/z-level change
  useEffect(() => {
    if (!civId) return;
    void fetchOverrides();
  }, [civId, fetchOverrides, offsetX, offsetY]);

  // Poll for tile changes (e.g. mining/building completions) — stable interval
  useEffect(() => {
    if (!civId) return;
    const interval = setInterval(() => void fetchOverrides(true), POLL_FORTRESS_TILES_MS);
    return () => clearInterval(interval);
  }, [civId, fetchOverrides]);

  // On-demand tile derivation with cache
  const getTile = useCallback(
    (x: number, y: number): FortressViewTile | null => {
      if (!deriver || !civId) return null;

      const key = `${x},${y}`;
      const cached = cacheRef.current.get(key);
      if (cached) return cached;

      // Evict if cache is too large
      if (cacheRef.current.size >= CACHE_MAX) {
        cacheRef.current.clear();
      }

      const derived = deriver.deriveTile(x, y, zLevel);
      const override = dbOverrides.get(key);

      const tile: FortressViewTile = {
        x,
        y,
        z: zLevel,
        tileType: (override?.tile_type as FortressTileType) ?? derived.tileType,
        material: override?.material ?? derived.material,
        isRevealed: override?.is_revealed ?? false,
        isMined: override?.is_mined ?? false,
      };

      cacheRef.current.set(key, tile);
      return tile;
    },
    [deriver, civId, zLevel, dbOverrides],
  );

  return { getTile, deriver };
}
