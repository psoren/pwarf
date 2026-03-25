import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill, makeMapTile, makeItem } from "../__tests__/test-helpers.js";
import { WORK_MINE_BASE } from "@pwarf/shared";

describe("occupancy deadlock prevention", () => {
  it("dwarves do not deadlock when clustered near mine targets", async () => {
    // Place 3 dwarves in a tight cluster next to 3 mine targets
    const dwarves = [
      makeDwarf({ id: "d0", position_x: 100, position_y: 100, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 }),
      makeDwarf({ id: "d1", position_x: 101, position_y: 100, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 }),
      makeDwarf({ id: "d2", position_x: 102, position_y: 100, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 }),
    ];

    const skills = dwarves.flatMap(d => [
      makeSkill(d.id, "mining", 2),
    ]);

    // Rock tiles to mine — right next to the dwarves
    const tiles = [
      makeMapTile(100, 101, 0, "rock"),
      makeMapTile(101, 101, 0, "rock"),
      makeMapTile(102, 101, 0, "rock"),
    ];
    // Grass around for pathfinding
    for (let x = 98; x <= 104; x++) {
      for (let y = 98; y <= 103; y++) {
        if (y === 101 && x >= 100 && x <= 102) continue; // skip rock tiles
        tiles.push(makeMapTile(x, y, 0, "grass"));
      }
    }

    const tasks = [
      makeTask("mine", { status: "pending", priority: 8, target_x: 100, target_y: 101, target_z: 0, work_required: WORK_MINE_BASE }),
      makeTask("mine", { status: "pending", priority: 8, target_x: 101, target_y: 101, target_z: 0, work_required: WORK_MINE_BASE }),
      makeTask("mine", { status: "pending", priority: 8, target_x: 102, target_y: 101, target_z: 0, work_required: WORK_MINE_BASE }),
    ];

    // Suppress autonomous needs
    const drinks = Array.from({ length: 15 }, (_, i) =>
      makeItem({ name: "Dwarven ale", category: "drink", material: "plant", position_x: 98, position_y: 98 + i, position_z: 0, located_in_civ_id: "test-civ" }),
    );
    const food = Array.from({ length: 15 }, (_, i) =>
      makeItem({ name: "Prepared meal", category: "food", material: "cooked", position_x: 97, position_y: 98 + i, position_z: 0, located_in_civ_id: "test-civ" }),
    );

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      tasks,
      items: [...drinks, ...food],
      fortressTileOverrides: tiles,
      ticks: 500,
    });

    // At least some mine tasks should complete — before the fix, all 3 stayed
    // at 0% progress forever due to occupancy deadlock
    const completedMines = result.tasks.filter(
      t => t.task_type === "mine" && t.status === "completed",
    );
    expect(completedMines.length, "at least 1 mine task should complete").toBeGreaterThanOrEqual(1);

    // All dwarves should be alive
    for (const d of result.dwarves) {
      expect(d.status).toBe("alive");
    }
  });
});
