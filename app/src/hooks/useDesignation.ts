import { useState, useCallback } from "react";
import type { TaskType } from "@pwarf/shared";
import {
  WORK_MINE_BASE,
  WORK_CHOP_TREE,
  WORK_CLEAR_ROCK,
  WORK_CLEAR_BUSH,
  WORK_BUILD_WALL,
  WORK_BUILD_FLOOR,
  WORK_BUILD_STAIRS,
} from "@pwarf/shared";
import { supabase } from "../lib/supabase";
import type { FortressViewTile } from "./useFortressTiles";

export type DesignationMode = "none" | "mine" | "build_wall" | "build_floor" | "build_stairs_up" | "build_stairs_down" | "build_stairs_both";

const BUILD_WORK: Record<string, number> = {
  build_wall: WORK_BUILD_WALL,
  build_floor: WORK_BUILD_FLOOR,
  build_stairs_up: WORK_BUILD_STAIRS,
  build_stairs_down: WORK_BUILD_STAIRS,
  build_stairs_both: WORK_BUILD_STAIRS,
};

export function useDesignation(opts: {
  civId: string | null;
  zLevel: number;
  getFortressTile: (x: number, y: number) => FortressViewTile | null;
  designatedTiles: Map<string, string>;
}) {
  const { civId, zLevel, getFortressTile, designatedTiles } = opts;

  const [designationMode, setDesignationMode] = useState<DesignationMode>("none");
  const [buildMenuOpen, setBuildMenuOpen] = useState(false);
  const [prioritiesOpen, setPrioritiesOpen] = useState(false);
  const [taskPriorities, setTaskPriorities] = useState<Record<string, number>>({});

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

    const { error } = await supabase.from('tasks').insert(tasks);
    if (error) {
      console.error('[designate] Failed to create tasks:', error.message);
    }
  }, [designationMode, civId, zLevel, getFortressTile, designatedTiles, taskPriorities]);

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
    handleDesignateArea,
    handleBuildSelect,
    handlePriorityChange,
    toggleMine,
    toggleBuildMenu,
    togglePriorities,
    cancelDesignation,
  };
}
