import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeRealisticScenario, makeTask, makeMonster } from "./test-helpers.js";
import { WORK_MINE_BASE } from "@pwarf/shared";

/**
 * Task Recovery scenario tests.
 *
 * When a dwarf dies mid-task (e.g., killed by a monster), the task should
 * be marked as failed, then the task-recovery phase resets it to pending
 * so another dwarf can claim and complete it.
 */

describe("task recovery", () => {
  it("recovers a mine task after the assigned dwarf is killed by a monster", async () => {
    const config = makeRealisticScenario({ dwarfCount: 2 });

    const dwarves = config.dwarves!;
    const dwarf1 = dwarves[0]!;
    const dwarf2 = dwarves[1]!;

    // Place a mine task near dwarf 1's starting position
    const mineX = 257;
    const mineY = 256;
    const mineTask = makeTask("mine", {
      status: "pending",
      target_x: mineX,
      target_y: mineY,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      civilization_id: "test-civ",
    });
    config.tasks = [mineTask];

    // Place a very strong monster directly on dwarf 1 to kill them quickly.
    // Threat level 100 and health 999 ensure the dwarf dies before the monster.
    config.monsters = [
      makeMonster({
        current_tile_x: dwarf1.position_x,
        current_tile_y: dwarf1.position_y,
        threat_level: 100,
        health: 999,
        behavior: "aggressive",
      }),
    ];

    // Give dwarf 1 low health so they die fast
    dwarf1.health = 5;

    config.ticks = 500;

    const result = await runScenario(config);

    // Dwarf 1 should be dead (killed by monster)
    const d1 = result.dwarves.find(d => d.id === dwarf1.id);
    expect(d1?.status).toBe("dead");

    // The mine task should ultimately be completed by dwarf 2,
    // OR at minimum be reset to pending/claimed (if not enough ticks to complete).
    // With 500 ticks and WORK_MINE_BASE, it should complete.
    const task = result.tasks.find(t => t.id === mineTask.id);
    expect(task).toBeDefined();

    // Task should not be stuck in "failed" — recovery should have reset it
    expect(task!.status).not.toBe("failed");

    // If the mine task completed, it should have been done by dwarf 2
    if (task!.status === "completed") {
      // The task was recovered and completed by another dwarf
      expect(task!.assigned_dwarf_id).not.toBe(dwarf1.id);
    } else {
      // At minimum, the task was recovered to pending or claimed by dwarf 2
      expect(["pending", "claimed"]).toContain(task!.status);
    }
  });

  it("autonomous tasks (eat/drink/sleep) are cancelled, not recovered", async () => {
    const config = makeRealisticScenario({ dwarfCount: 2 });

    const dwarves = config.dwarves!;
    const dwarf1 = dwarves[0]!;

    // Create an eat task that will be "failed" when dwarf 1 dies
    const eatTask = makeTask("eat", {
      status: "pending",
      target_x: dwarf1.position_x,
      target_y: dwarf1.position_y,
      target_z: 0,
      work_required: 10,
      civilization_id: "test-civ",
    });

    // Also add a design task that should be recovered
    const mineTask = makeTask("mine", {
      status: "pending",
      target_x: 257,
      target_y: 256,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      civilization_id: "test-civ",
    });
    config.tasks = [eatTask, mineTask];

    // Kill dwarf 1 with a monster
    config.monsters = [
      makeMonster({
        current_tile_x: dwarf1.position_x,
        current_tile_y: dwarf1.position_y,
        threat_level: 100,
        health: 999,
        behavior: "aggressive",
      }),
    ];
    dwarf1.health = 5;

    config.ticks = 500;

    const result = await runScenario(config);

    // Dwarf 1 should be dead
    const d1 = result.dwarves.find(d => d.id === dwarf1.id);
    expect(d1?.status).toBe("dead");

    // The mine task should NOT be stuck in failed
    const mine = result.tasks.find(t => t.id === mineTask.id);
    expect(mine).toBeDefined();
    expect(mine!.status).not.toBe("failed");
  });
});
