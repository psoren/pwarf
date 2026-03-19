import { useState, useCallback, useEffect, useRef } from "react";
import type { TaskType } from "@pwarf/shared";
import {
  WORK_MINE_BASE,
  WORK_CHOP_TREE,
  WORK_CLEAR_ROCK,
  WORK_CLEAR_BUSH,
  WORK_BUILD_WALL,
  WORK_BUILD_FLOOR,
} from "@pwarf/shared";
import { supabase } from "../lib/supabase";
import type { FortressViewTile } from "./useFortressTiles";
import type { OptimisticDesignation } from "./useTasks";

export type DesignationMode = "none" | "mine" | "build_wall" | "build_floor";

const BUILD_WORK: Record<string, number> = {
  build_wall: WORK_BUILD_WALL,
  build_floor: WORK_BUILD_FLOOR,
};

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

  // Optimistic designations — shown immediately before poll picks them up
  const [optimisticTiles, setOptimisticTiles] = useState<Map<string, string>>(new Map());
  const prevDesignatedTiles = useRef(designatedTiles);

  // Clear optimistic tiles once the real data arrives (designatedTiles changes)
  useEffect(() => {
    if (designatedTiles !== prevDesignatedTiles.current) {
      prevDesignatedTiles.current = designatedTiles;
      if (optimisticTiles.size > 0) {
        setOptimisticTiles(new Map());
      }
    }
  }, [designatedTiles, optimisticTiles.size]);

  const handleDesignateArea = useCallback(async (x1: number, y1: number, x2: number, y2: number) => {
    if (designationMode === 'none' || !civId) return;

    const mineable: string[] = ['stone', 'ore', 'gem', 'soil', 'cavern_wall', 'tree', 'rock', 'bush'];
    const buildable: string[] = ['open_air', 'grass', 'constructed_floor', 'cavern_floor'];
    const isMine = designationMode === 'mine';
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

    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        if (designatedTiles.has(`${x},${y}`)) continue;

        const tile = getFortressTile(x, y);
        if (!tile) continue;

        if (isMine) {
          if (!mineable.includes(tile.tileType)) continue;
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

    if (tasks.length === 0) return;

    // Show blueprints immediately — the next poll will reconcile with real data
    addOptimistic(tasks.map((t) => ({ x: t.target_x, y: t.target_y, taskType: t.task_type })));

    const { error } = await supabase.from('tasks').insert(tasks);
    if (error) {
      console.error('[designate] Failed to create tasks:', error.message);
    } else {
      // Optimistically show the new designations immediately
      setOptimisticTiles((prev) => {
        const next = new Map(prev);
        for (const t of tasks) {
          next.set(`${t.target_x},${t.target_y}`, t.task_type);
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
    toggleBuildMenu,
    togglePriorities,
    cancelDesignation,
  };
}
