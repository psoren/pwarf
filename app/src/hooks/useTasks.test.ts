import { describe, it, expect } from "vitest";
import type { ActiveTask, OptimisticDesignation } from "./useTasks";

/**
 * Mirrors the designatedTiles merge logic from useTasks.
 * Extracted here for testability.
 */
function buildDesignatedTiles(
  tasks: ActiveTask[],
  optimistic: OptimisticDesignation[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const task of tasks) {
    if (task.target_x !== null && task.target_y !== null) {
      map.set(`${task.target_x},${task.target_y}`, task.task_type);
    }
  }
  for (const o of optimistic) {
    const key = `${o.x},${o.y}`;
    if (!map.has(key)) {
      map.set(key, o.taskType);
    }
  }
  return map;
}

describe("designatedTiles merge", () => {
  it("includes optimistic designations when no real tasks exist", () => {
    const result = buildDesignatedTiles([], [
      { x: 5, y: 10, taskType: "mine" },
      { x: 6, y: 10, taskType: "mine" },
    ]);
    expect(result.size).toBe(2);
    expect(result.get("5,10")).toBe("mine");
    expect(result.get("6,10")).toBe("mine");
  });

  it("real tasks take precedence over optimistic for the same tile", () => {
    const tasks: ActiveTask[] = [{
      id: "real-1",
      task_type: "mine",
      status: "claimed",
      target_x: 5,
      target_y: 10,
      target_z: 0,
      work_progress: 3,
      work_required: 10,
    }];
    const optimistic: OptimisticDesignation[] = [
      { x: 5, y: 10, taskType: "build_wall" },
    ];
    const result = buildDesignatedTiles(tasks, optimistic);
    expect(result.size).toBe(1);
    expect(result.get("5,10")).toBe("mine");
  });

  it("merges real and optimistic for different tiles", () => {
    const tasks: ActiveTask[] = [{
      id: "real-1",
      task_type: "mine",
      status: "pending",
      target_x: 1,
      target_y: 1,
      target_z: 0,
      work_progress: 0,
      work_required: 10,
    }];
    const optimistic: OptimisticDesignation[] = [
      { x: 2, y: 2, taskType: "build_floor" },
    ];
    const result = buildDesignatedTiles(tasks, optimistic);
    expect(result.size).toBe(2);
    expect(result.get("1,1")).toBe("mine");
    expect(result.get("2,2")).toBe("build_floor");
  });

  it("returns empty map when no tasks and no optimistic", () => {
    const result = buildDesignatedTiles([], []);
    expect(result.size).toBe(0);
  });

  it("skips tasks with null coordinates", () => {
    const tasks: ActiveTask[] = [{
      id: "t1",
      task_type: "eat",
      status: "in_progress",
      target_x: null,
      target_y: null,
      target_z: null,
      work_progress: 0,
      work_required: 5,
    }];
    const result = buildDesignatedTiles(tasks, []);
    expect(result.size).toBe(0);
  });
});
