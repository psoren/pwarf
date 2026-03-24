import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill } from "./test-helpers.js";
import { WORK_MINE_BASE } from "@pwarf/shared";
import type { FortressTile } from "@pwarf/shared";

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

describe("dwarf collision", () => {
  it("two dwarves heading to the same area don't stack on one tile", async () => {
    // Two dwarves start at different positions and move toward nearby mine tasks
    const dwarf1 = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const dwarf2 = makeDwarf({ position_x: 5, position_y: 6, position_z: 0 });
    const skill1 = makeSkill(dwarf1.id, "mining", 1);
    const skill2 = makeSkill(dwarf2.id, "mining", 1);

    // Both tasks target the same tile — dwarves stand adjacent for mine tasks
    const tile = makeMinableTile(8, 5, 0);
    const task1 = makeTask("mine", {
      status: "pending",
      target_x: 8, target_y: 5, target_z: 0,
      work_required: WORK_MINE_BASE,
    });
    const task2 = makeTask("mine", {
      status: "pending",
      target_x: 8, target_y: 5, target_z: 0,
      work_required: WORK_MINE_BASE,
    });

    const result = await runScenario({
      dwarves: [dwarf1, dwarf2],
      dwarfSkills: [skill1, skill2],
      tasks: [task1, task2],
      fortressTileOverrides: [tile],
      ticks: 10, // enough to move a few steps
    });

    // The two dwarves should NOT be on the same tile
    const pos1 = `${result.dwarves[0]!.position_x},${result.dwarves[0]!.position_y}`;
    const pos2 = `${result.dwarves[1]!.position_x},${result.dwarves[1]!.position_y}`;
    expect(pos1).not.toBe(pos2);
  });

  it("dwarves on the same starting tile spread out when given tasks", async () => {
    // Start 3 dwarves on the exact same tile
    const dwarves = [
      makeDwarf({ position_x: 10, position_y: 10, position_z: 0 }),
      makeDwarf({ position_x: 10, position_y: 10, position_z: 0 }),
      makeDwarf({ position_x: 10, position_y: 10, position_z: 0 }),
    ];
    const skills = dwarves.map(d => makeSkill(d.id, "mining", 1));

    // Tasks at different locations
    const tiles = [
      makeMinableTile(15, 10, 0),
      makeMinableTile(10, 15, 0),
      makeMinableTile(5, 10, 0),
    ];
    const tasks = tiles.map(t => makeTask("mine", {
      status: "pending",
      target_x: t.x, target_y: t.y, target_z: t.z,
      work_required: WORK_MINE_BASE,
    }));

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      tasks,
      fortressTileOverrides: tiles,
      ticks: 5, // a few steps to spread out
    });

    // After a few ticks, not all 3 should still be on the same tile
    const positions = result.dwarves.map(d => `${d.position_x},${d.position_y}`);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBeGreaterThan(1);
  });
});
