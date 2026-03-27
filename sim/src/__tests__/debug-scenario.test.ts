import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeMapTile } from "./test-helpers.js";

describe("sim debug mode in scenarios", () => {
  it("produces tick_timing entries when debug is enabled", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const result = await runScenario({
      dwarves: [dwarf],
      fortressTileOverrides: [
        makeMapTile(5, 5, 0, "grass"),
      ],
      ticks: 3,
      debug: true,
    });

    const timingEntries = result.debugEntries.filter(e => e.category === "tick_timing");
    expect(timingEntries).toHaveLength(3);
    for (const entry of timingEntries) {
      expect(entry.data).toHaveProperty("totalMs");
      expect(entry.data).toHaveProperty("phases");
    }
  });

  it("produces pathfinding failure entries for unreachable targets", async () => {
    // Place dwarf at (0,0,0) boxed in by walls and map edge
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 });
    const task = makeTask("mine", {
      status: "claimed",
      assigned_dwarf_id: dwarf.id,
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 100,
    });
    dwarf.current_task_id = task.id;

    // Place dwarf in corner (0,0,0) — x<0 and y<0 return null (off-map).
    // Wall off the only two walkable neighbors (1,0) and (0,1).
    const tiles = [
      makeMapTile(0, 0, 0, "grass"),
      makeMapTile(1, 0, 0, "cavern_wall"),
      makeMapTile(0, 1, 0, "cavern_wall"),
      makeMapTile(10, 10, 0, "rock"),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      fortressTileOverrides: tiles,
      ticks: 3,
      debug: true,
    });

    const pathEntries = result.debugEntries.filter(e => e.category === "pathfinding");
    expect(pathEntries.length).toBeGreaterThan(0);
    expect(pathEntries[0].data?.taskType).toBe("mine");

    const failEntries = result.debugEntries.filter(e => e.category === "task_failure");
    expect(failEntries.length).toBeGreaterThan(0);
  });

  it("does not produce debug entries when debug is disabled", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const result = await runScenario({
      dwarves: [dwarf],
      fortressTileOverrides: [
        makeMapTile(5, 5, 0, "grass"),
      ],
      ticks: 3,
      debug: false,
    });

    expect(result.debugEntries).toHaveLength(0);
  });
});
