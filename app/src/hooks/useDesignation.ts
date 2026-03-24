import { useState, useCallback, useEffect, useMemo } from "react";
import type { TaskType } from "@pwarf/shared";
import {
  WORK_MINE_BASE,
  WORK_CHOP_TREE,
  WORK_CLEAR_ROCK,
  WORK_CLEAR_BUSH,
  WORK_BUILD_WALL,
  WORK_BUILD_FLOOR,
  WORK_BUILD_BED,
  WORK_BUILD_WELL,
  WORK_BUILD_MUSHROOM_GARDEN,
  WORK_BUILD_DOOR,
  WORK_DECONSTRUCT,
  WORK_FARM_TILL_BASE,
} from "@pwarf/shared";
import { supabase } from "../lib/supabase";
import type { FortressViewTile } from "./useFortressTiles";
import type { OptimisticDesignation } from "./useTasks";

export type DesignationMode = "none" | "mine" | "farm_till" | "build_wall" | "build_floor" | "build_bed" | "build_well" | "build_mushroom_garden" | "build_door" | "stockpile" | "deconstruct";

const BUILD_WORK: Record<string, number> = {
  build_wall: WORK_BUILD_WALL,
  build_floor: WORK_BUILD_FLOOR,
  build_bed: WORK_BUILD_BED,
  build_well: WORK_BUILD_WELL,
  build_mushroom_garden: WORK_BUILD_MUSHROOM_GARDEN,
  build_door: WORK_BUILD_DOOR,
  farm_till: WORK_FARM_TILL_BASE,
};

/** Tile types that can be deconstructed. */
const DECONSTRUCTIBLE: ReadonlySet<string> = new Set([
  'constructed_wall', 'constructed_floor', 'bed', 'well', 'mushroom_garden', 'door',
]);

/** Tile types that can be designated as farm plots. */
const FARMABLE: ReadonlySet<string> = new Set([
  'grass',
  'soil',
]);

export function useDesignation(opts: {
  civId: string | null;
  zLevel: number;
  getFortressTile: (x: number, y: number) => FortressViewTile | null;
  designatedTiles: Map<string, string>;
  addOptimistic: (tiles: OptimisticDesignation[]) => void;
}) {
  const { civId, zLevel, getFortressTile, designatedTiles, addOptimistic } = opts;

  const [designationMode, setDesignationMode] = useState<DesignationMode>("none");
  const [buildMenuOpen, setBuildMenuOpen] = useState(false);
  const [prioritiesOpen, setPrioritiesOpen] = useState(false);
  const [taskPriorities, setTaskPriorities] = useState<Record<string, number>>({});

  // Optimistic designations — keyed by "x,y,z" to avoid cross-z-level bleed (#513)
  const [optimisticTilesRaw, setOptimisticTilesRaw] = useState<Map<string, string>>(new Map());

  // Expose only entries matching the current zLevel, keyed by "x,y" for rendering
  const optimisticTiles = useMemo(() => {
    const filtered = new Map<string, string>();
    const suffix = `,${zLevel}`;
    for (const [key, val] of optimisticTilesRaw) {
      if (key.endsWith(suffix)) {
        // Strip the z component: "x,y,z" → "x,y"
        filtered.set(key.slice(0, key.lastIndexOf(',')), val);
      }
    }
    return filtered;
  }, [optimisticTilesRaw, zLevel]);

  // Clear optimistic tiles one-by-one as each key appears in the real designatedTiles.
  // Content-based so a new array reference on every sim tick doesn't wipe all optimistic
  // state before the sim has picked up the newly inserted task.
  useEffect(() => {
    if (optimisticTilesRaw.size === 0) return;
    let changed = false;
    const next = new Map(optimisticTilesRaw);
    for (const key of optimisticTilesRaw.keys()) {
      if (!key.endsWith(`,${zLevel}`)) continue;
      const xyKey = key.slice(0, key.lastIndexOf(','));
      if (designatedTiles.has(xyKey)) {
        next.delete(key);
        changed = true;
      }
    }
    if (changed) setOptimisticTilesRaw(next);
  }, [designatedTiles, optimisticTilesRaw, zLevel]);

  const handleDesignateArea = useCallback(async (x1: number, y1: number, x2: number, y2: number) => {
    if (designationMode === 'none' || !civId) return;

    // Stockpile designation — insert directly into stockpile_tiles
    if (designationMode === 'stockpile') {
      const walkable: string[] = ['open_air', 'grass', 'constructed_floor', 'cavern_floor', 'sand', 'mud', 'ice', 'cave_entrance', 'soil'];
      const rows: Array<{ civilization_id: string; x: number; y: number; z: number }> = [];
      for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
          const tile = getFortressTile(x, y);
          if (!tile || !walkable.includes(tile.tileType)) continue;
          rows.push({ civilization_id: civId, x, y, z: zLevel });
        }
      }
      if (rows.length === 0) return;
      const { error } = await supabase.from('stockpile_tiles').upsert(rows, { onConflict: 'civilization_id,x,y,z' });
      if (error) {
        console.error('[designate] Failed to create stockpile tiles:', error.message);
      }
      return;
    }

    const mineable: string[] = ['stone', 'ore', 'gem', 'soil', 'cavern_wall', 'tree', 'rock', 'bush'];
    const buildable: string[] = ['open_air', 'grass', 'constructed_floor', 'cavern_floor'];
    const isMine = designationMode === 'mine';
    const isDeconstruct = designationMode === 'deconstruct';
    const isFarm = designationMode === 'farm_till';
    const taskType = designationMode as TaskType;
    const baseBuildWork = BUILD_WORK[designationMode] ?? WORK_BUILD_WALL;
    const priority = taskPriorities[taskType] ?? 5;

    const tasks: Array<{
      civilization_id: string;
      task_type: string;
      status: string;
      priority: number;
      target_x: number;
      target_y: number;
      target_z: number;
      work_required: number;
    }> = [];

    // Deconstruct mode: collect pending build tasks to cancel immediately (#512)
    const cancelBuildCoords: Array<{ x: number; y: number }> = [];

    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        if (designatedTiles.has(`${x},${y}`)) {
          // In deconstruct mode, cancel any existing pending build task at this tile
          if (isDeconstruct) {
            const existing = designatedTiles.get(`${x},${y}`)!;
            if (existing.startsWith('build_')) {
              cancelBuildCoords.push({ x, y });
            }
          }
          continue;
        }

        const tile = getFortressTile(x, y);
        if (!tile) continue;

        if (isMine) {
          if (!mineable.includes(tile.tileType)) continue;
        } else if (isDeconstruct) {
          if (!DECONSTRUCTIBLE.has(tile.tileType)) continue;
        } else if (isFarm) {
          if (!FARMABLE.has(tile.tileType)) continue;
        } else {
          if (!buildable.includes(tile.tileType)) continue;
        }

        let workRequired = baseBuildWork;
        if (isMine) {
          switch (tile.tileType) {
            case 'tree': workRequired = WORK_CHOP_TREE; break;
            case 'rock': workRequired = WORK_CLEAR_ROCK; break;
            case 'bush': workRequired = WORK_CLEAR_BUSH; break;
            default: workRequired = WORK_MINE_BASE; break;
          }
        } else if (isDeconstruct) {
          workRequired = WORK_DECONSTRUCT;
        }

        tasks.push({
          civilization_id: civId,
          task_type: taskType,
          status: 'pending',
          priority,
          target_x: x,
          target_y: y,
          target_z: zLevel,
          work_required: workRequired,
        });
      }
    }

    // Cancel pending build tasks that were targeted for deconstruction (#512)
    if (cancelBuildCoords.length > 0) {
      for (const coord of cancelBuildCoords) {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('civilization_id', civId)
          .eq('target_x', coord.x)
          .eq('target_y', coord.y)
          .eq('target_z', zLevel)
          .in('status', ['pending', 'claimed', 'in_progress'])
          .like('task_type', 'build_%');
        if (error) {
          console.error('[designate] Failed to cancel build task:', error.message);
        }
      }
    }

    if (tasks.length === 0 && cancelBuildCoords.length === 0) return;
    if (tasks.length === 0) return; // Only cancellations, already handled above

    // Show blueprints immediately — the next poll will reconcile with real data
    addOptimistic(tasks.map((t) => ({ x: t.target_x, y: t.target_y, taskType: t.task_type })));

    const { error } = await supabase.from('tasks').insert(tasks);
    if (error) {
      console.error('[designate] Failed to create tasks:', error.message);
    } else {
      // Optimistically show the new designations immediately (keyed with z)
      setOptimisticTilesRaw((prev) => {
        const next = new Map(prev);
        for (const t of tasks) {
          next.set(`${t.target_x},${t.target_y},${t.target_z}`, t.task_type);
        }
        return next;
      });
    }
  }, [designationMode, civId, zLevel, getFortressTile, designatedTiles, taskPriorities, addOptimistic]);

  const handleCancelArea = useCallback(async (x1: number, y1: number, x2: number, y2: number) => {
    if (!civId) return;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('civilization_id', civId)
      .eq('status', 'pending')
      .eq('target_z', zLevel)
      .gte('target_x', x1)
      .lte('target_x', x2)
      .gte('target_y', y1)
      .lte('target_y', y2);

    if (error) {
      console.error('[designate] Failed to cancel tasks:', error.message);
    }
  }, [civId, zLevel]);

  const handleBuildSelect = useCallback((taskType: TaskType) => {
    setBuildMenuOpen(false);
    setDesignationMode(taskType as DesignationMode);
  }, []);

  const handlePriorityChange = useCallback((taskType: TaskType, priority: number) => {
    setTaskPriorities((prev) => ({ ...prev, [taskType]: priority }));
  }, []);

  const toggleMine = useCallback(() => {
    setBuildMenuOpen(false);
    setDesignationMode((m) => (m === "mine" ? "none" : "mine"));
  }, []);

  const toggleStockpile = useCallback(() => {
    setBuildMenuOpen(false);
    setPrioritiesOpen(false);
    setDesignationMode((m) => (m === "stockpile" ? "none" : "stockpile"));
  }, []);

  const toggleDeconstruct = useCallback(() => {
    setBuildMenuOpen(false);
    setPrioritiesOpen(false);
    setDesignationMode((m) => (m === "deconstruct" ? "none" : "deconstruct"));
  }, []);

  const toggleFarm = useCallback(() => {
    setBuildMenuOpen(false);
    setPrioritiesOpen(false);
    setDesignationMode((m) => (m === "farm_till" ? "none" : "farm_till"));
  }, []);

  const toggleBuildMenu = useCallback(() => {
    setDesignationMode("none");
    setPrioritiesOpen(false);
    setBuildMenuOpen((o) => !o);
  }, []);

  const togglePriorities = useCallback(() => {
    setDesignationMode("none");
    setBuildMenuOpen(false);
    setPrioritiesOpen((o) => !o);
  }, []);

  const cancelDesignation = useCallback(() => {
    setDesignationMode("none");
    setBuildMenuOpen(false);
    setPrioritiesOpen(false);
  }, []);

  return {
    designationMode,
    setDesignationMode,
    buildMenuOpen,
    setBuildMenuOpen,
    prioritiesOpen,
    taskPriorities,
    optimisticTiles,
    handleDesignateArea,
    handleCancelArea,
    handleBuildSelect,
    handlePriorityChange,
    toggleMine,
    toggleStockpile,
    toggleDeconstruct,
    toggleFarm,
    toggleBuildMenu,
    togglePriorities,
    cancelDesignation,
  };
}
