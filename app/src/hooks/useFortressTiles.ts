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
  /** Tile overrides from the live sim snapshot — applied on top of DB overrides
   * so builds/mines appear immediately without waiting for the DB flush. */
  snapshotTileOverrides?: FortressTile[];
}

const CACHE_MAX = 20_000;

import { overridesEqual } from './tile-override-helpers';

export function useFortressTiles({
  civId,
  worldSeed,
  terrain,
  offsetX,
  offsetY,
  zLevel,
  viewportCols,
  viewportRows,
  snapshotTileOverrides,
}: UseFortressTilesOptions) {
  const [dbOverrides, setDbOverrides] = useState<Map<string, Partial<FortressTile>>>(new Map());
  const lastFetchKey = useRef<string>('');

  // Create deriver once per seed + civId
  const deriver = useMemo<FortressDeriver | null>(() => {
    if (worldSeed == null || !civId) return null;
    return createFortressDeriver(worldSeed, civId, terrain ?? "plains");
  }, [worldSeed, civId, terrain]);

  // Tile cache — keyed "x,y"
  const cacheRef = useRef(new Map<string, FortressViewTile>());

  // Map of snapshot overrides at the current z-level for O(1) lookup.
  // Rebuild only when the snapshot changes. Use a ref so getTile can read it
  // without re-creating the callback.
  const snapshotMapRef = useRef<Map<string, FortressTile>>(new Map());
  const prevSnapshotRef = useRef<FortressTile[] | undefined>(undefined);

  if (snapshotTileOverrides !== prevSnapshotRef.current) {
    prevSnapshotRef.current = snapshotTileOverrides;
    const next = new Map<string, FortressTile>();
    for (const tile of snapshotTileOverrides ?? []) {
      if (tile.z === zLevel) {
        next.set(`${tile.x},${tile.y}`, tile);
      }
    }
    // Selectively evict cache entries whose snapshot tile changed
    for (const [key, tile] of next) {
      const prev = snapshotMapRef.current.get(key);
      if (!prev || prev.tile_type !== tile.tile_type || prev.is_mined !== tile.is_mined) {
        cacheRef.current.delete(key);
      }
    }
    // Also evict keys that were in snapshot but are now gone (tile removed)
    for (const key of snapshotMapRef.current.keys()) {
      if (!next.has(key)) {
        cacheRef.current.delete(key);
      }
    }
    snapshotMapRef.current = next;
  }

  // Clear entire cache when underlying data sources change (deriver, DB, z-level)
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
      // Only update state if overrides actually changed — avoids clearing the tile cache
      setDbOverrides((prev) =>
        overridesEqual(prev, newOverrides) ? prev : newOverrides,
      );
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

      // Snapshot overrides (sim in-memory state) take priority over DB overrides
      // so built/mined tiles appear immediately before the next DB flush.
      const snapshotOverride = snapshotMapRef.current.get(key);
      const dbOverride = dbOverrides.get(key);
      const override = snapshotOverride ?? dbOverride;

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
