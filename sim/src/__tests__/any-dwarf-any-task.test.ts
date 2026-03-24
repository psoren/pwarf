import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill } from "./test-helpers.js";
import { WORK_MINE_BASE } from "@pwarf/shared";
import type { FortressTile } from "@pwarf/shared";

/**
 * Any-dwarf-any-task tests (issue #560)
 *
 * Verifies that dwarves WITHOUT a matching skill record can still
 * claim and complete skilled tasks. Skills only affect speed, not eligibility.
 */

function makeMinableTile(x: number, y: number, z: number): FortressTile {
  return {
    id: `tile-${x}-${y}-${z}`,
    civilization_id: "civ-1",
    x, y, z,
    tile_type: "stone",
    material: "granite",
    is_revealed: true,
    is_mined: false,
    created_at: new Date().toISOString(),
  };
}

describe("any dwarf can do any task", () => {
  it("dwarf without mining skill can claim and complete a mine task", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10, position_z: 0 });
    // Dwarf has building skill but NOT mining
    const buildSkill = makeSkill(dwarf.id, "building", 2);

    const stoneTile = makeMinableTile(11, 10, 0);
    const mineTask = makeTask("mine", {
      status: "pending",
      target_x: 11,
      target_y: 10,
      target_z: 0,
      work_required: WORK_MINE_BASE,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill], // no mining skill!
      tasks: [mineTask],
      fortressTileOverrides: [stoneTile],
      ticks: WORK_MINE_BASE + 20,
    });

    const task = result.tasks.find(t => t.id === mineTask.id);
    expect(task?.status).toBe("completed");
  });

  it("dwarf with no skill records at all can claim a build task", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10, position_z: 0 });

    const buildTask = makeTask("build_well", {
      status: "pending",
      target_x: 11,
      target_y: 10,
      target_z: 0,
      work_required: 60,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [], // no skills at all!
      tasks: [buildTask],
      ticks: 80,
    });

    const task = result.tasks.find(t => t.id === buildTask.id);
    expect(task?.status).toBe("completed");
  });

  it("all 7 dwarves mine when 20 blocks designated, not just miners", async () => {
    // Simulate embark-like setup: 2 miners + 5 non-miners
    const dwarves = Array.from({ length: 7 }, (_, i) =>
      makeDwarf({ position_x: 10 + i, position_y: 10, position_z: 0 }),
    );
    const skills = [
      makeSkill(dwarves[0]!.id, "mining", 2),
      makeSkill(dwarves[1]!.id, "mining", 2),
      makeSkill(dwarves[2]!.id, "farming", 1),
      makeSkill(dwarves[3]!.id, "farming", 1),
      makeSkill(dwarves[4]!.id, "building", 1),
      makeSkill(dwarves[5]!.id, "building", 1),
      makeSkill(dwarves[6]!.id, "building", 1),
    ];

    // 20 mine tasks spread along y=12
    const tasks = Array.from({ length: 20 }, (_, i) =>
      makeTask("mine", {
        status: "pending",
        target_x: 5 + i,
        target_y: 12,
        target_z: 0,
        work_required: WORK_MINE_BASE,
      }),
    );
    const tiles = Array.from({ length: 20 }, (_, i) =>
      makeMinableTile(5 + i, 12, 0),
    );

    // Run enough ticks for all dwarves to claim and start working
    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      tasks,
      fortressTileOverrides: tiles,
      ticks: 10, // just enough for job claiming + 1 tick of work
    });

    // Count how many dwarves have a current task (are working)
    const workingDwarves = result.dwarves.filter(d => d.current_task_id !== null);
    // All 7 should be working, not just the 2 miners
    expect(workingDwarves.length).toBe(7);
  });
});
