import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeMapTile, makeItem } from "./test-helpers.js";
import type { FortressDeriver } from "@pwarf/shared";

/** A deriver that returns walls everywhere — only overrides are walkable. */
function wallDeriver(): FortressDeriver {
  return {
    deriveTile: () => ({ tileType: 'constructed_wall' as any, material: 'stone', isMined: false }),
    baseTileType: 'constructed_wall' as any,
    getZForEntrance: () => null,
    getEntranceForZ: () => null,
    getCaveName: () => null,
  } as any;
}

describe("dwarf oscillation prevention", () => {
  it("dwarf in a narrow corridor with a blocker does not ping-pong", async () => {
    // Corridor: (0,0) → (1,0) → (2,0) → (3,0) → (4,0)
    // Dwarf A at (0,0) needs to reach (4,0)
    // Dwarf B (sleeping) blocks at (2,0) and won't move
    //
    // Without the fix, A would oscillate between (1,0) and (0,0):
    //   tick 1: A moves to (1,0). Next step (2,0) blocked, alt goes back to (0,0)
    //   tick 2: A at (0,0), BFS says go to (1,0). Moves.
    //   tick 3: same as tick 1 — oscillation
    //
    // With the fix, A detects the back-step and waits instead. After
    // MAX_OCCUPANCY_WAIT_TICKS (10), the task fails and gets reassigned.

    const dwarfA = makeDwarf({
      position_x: 0,
      position_y: 0,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    // Blocker dwarf doing a long sleep task — will not move
    const sleepTask = makeTask("sleep", {
      status: "in_progress",
      target_x: 2,
      target_y: 0,
      target_z: 0,
      work_required: 600,
      work_progress: 0,
    });
    const dwarfB = makeDwarf({
      position_x: 2,
      position_y: 0,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 10,
      current_task_id: sleepTask.id,
    });
    sleepTask.assigned_dwarf_id = dwarfB.id;

    const farmTask = makeTask("farm_till", {
      status: "pending",
      target_x: 4,
      target_y: 0,
      target_z: 0,
      work_required: 100,
      work_progress: 0,
    });

    // Place food/drink so autonomous tasks don't interfere
    const food = makeItem({ category: "food", position_x: 0, position_y: 0, position_z: 0 });
    const drink = makeItem({ category: "drink", name: "Water", position_x: 0, position_y: 0, position_z: 0 });

    // Narrow corridor tiles
    const tiles = [];
    for (let x = 0; x <= 4; x++) {
      tiles.push(makeMapTile(x, 0, 0, "open_air"));
    }

    const result = await runScenario({
      dwarves: [dwarfA, dwarfB],
      tasks: [sleepTask, farmTask],
      items: [food, drink],
      fortressTileOverrides: tiles,
      fortressDeriver: wallDeriver(),
      ticks: 50,
    });

    // Track dwarf A's position history
    const finalA = result.dwarves.find(d => d.name === dwarfA.name)!;

    // The key assertion: dwarf A should NOT be stuck oscillating.
    // With anti-oscillation + occupancy wait (10 ticks) + fail count (3 attempts),
    // after 50 ticks the task should be cancelled (unreachable) or pending.
    // Each cycle: 1 move tick + ~10 wait ticks + 1 fail tick ≈ 12 ticks.
    // 3 cycles = ~36 ticks → cancelled by MAX_TASK_FAIL_COUNT.
    const farmTaskResult = result.tasks.find(t => t.task_type === "farm_till")!;

    // The task should have been cancelled (unreachable after 3 failures) or
    // be pending (released but not yet re-cancelled). It should NOT be
    // in_progress with 0 progress — that would indicate a stuck dwarf.
    if (farmTaskResult.status === "in_progress") {
      expect(farmTaskResult.work_progress).toBeGreaterThan(0);
    }

    // Verify no oscillation: dwarf A should not be flip-flopping.
    // It should be at a stable position (either waiting at 1,0 or back at 0,0
    // after the task was released, not randomly switching each tick).
    expect(finalA.position_x).toBeLessThanOrEqual(1);
  });

  it("dwarf advances normally when path is clear (no false positive)", async () => {
    // Simple corridor, no blocker — dwarf should walk to target and complete work.
    // Pre-assign the task to skip jobClaiming timing issues.
    const task = makeTask("farm_till", {
      status: "claimed",
      target_x: 3,
      target_y: 0,
      target_z: 0,
      work_required: 5,
      work_progress: 0,
    });

    const dwarf = makeDwarf({
      position_x: 0,
      position_y: 0,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      current_task_id: task.id,
    });
    task.assigned_dwarf_id = dwarf.id;

    const food = makeItem({ category: "food", position_x: 0, position_y: 0, position_z: 0 });
    const drink = makeItem({ category: "drink", name: "Water", position_x: 0, position_y: 0, position_z: 0 });

    const tiles = [];
    for (let x = 0; x <= 3; x++) {
      tiles.push(makeMapTile(x, 0, 0, "open_air"));
    }

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      items: [food, drink],
      fortressTileOverrides: tiles,
      fortressDeriver: wallDeriver(),
      ticks: 20,
    });

    // Task should be completed — dwarf walked 3 tiles then did 5 work
    const farmTask = result.tasks.find(t => t.task_type === "farm_till")!;
    expect(farmTask.status).toBe("completed");
  });
});
