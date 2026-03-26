import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill, makeItem, makeStructure } from "./test-helpers.js";
import { createFortressDeriver, WORK_SCOUT_CAVE, SKILL_NAMES } from "@pwarf/shared";

/**
 * Regression tests for #692 — dwarves must be able to pathfind to distant
 * cave entrances. Previously the BFS node limit (10k) prevented reaching
 * any entrance beyond ~140 Manhattan distance from spawn.
 *
 * Uses a minimal scenario: one dwarf, high needs, food/drink placed on
 * stockpile tiles (so no haul tasks compete with scouting).
 */

const CIV_ID = "test-civ";

function makeScoutScenario(entranceIndex: number, ticks: number) {
  const deriver = createFortressDeriver(42n, CIV_ID, "plains");
  const entrance = deriver.entrances[entranceIndex]!;

  const dwarf = makeDwarf({
    civilization_id: CIV_ID,
    position_x: 256,
    position_y: 256,
    position_z: 0,
    need_food: 100,
    need_drink: 100,
    need_sleep: 100,
  });

  const skills = SKILL_NAMES.map(s => makeSkill(dwarf.id, s, 2));

  // Place food/drink on stockpile area so auto-haul doesn't generate distracting tasks
  const items = [];
  for (let i = 0; i < 20; i++) {
    items.push(makeItem({
      name: "Plump helmet", category: "food", material: "plant",
      located_in_civ_id: CIV_ID, position_x: 250, position_y: 262, position_z: 0,
    }));
    items.push(makeItem({
      name: "Dwarven ale", category: "drink", material: "plant",
      located_in_civ_id: CIV_ID, position_x: 251, position_y: 262, position_z: 0,
    }));
  }

  const stockpileTiles = [];
  for (let sx = 250; sx <= 252; sx++) {
    for (let sy = 262; sy <= 264; sy++) {
      stockpileTiles.push({
        id: `sp-${sx}-${sy}`,
        civilization_id: CIV_ID,
        x: sx, y: sy, z: 0,
        priority: 1,
        accepts_categories: null,
        created_at: new Date().toISOString(),
      });
    }
  }

  const structures = [
    makeStructure({
      civilization_id: CIV_ID, type: "bed", completion_pct: 100,
      position_x: 254, position_y: 260, position_z: 0,
    }),
    makeStructure({
      civilization_id: CIV_ID, type: "well", completion_pct: 100,
      position_x: 260, position_y: 258, position_z: 0,
    }),
  ];

  const scoutTask = makeTask("scout_cave", {
    civilization_id: CIV_ID,
    status: "pending",
    target_x: entrance.x,
    target_y: entrance.y,
    target_z: 0,
    work_progress: 0,
    work_required: WORK_SCOUT_CAVE,
  });

  return { deriver, entrance, config: {
    dwarves: [dwarf],
    dwarfSkills: skills,
    items,
    structures,
    stockpileTiles,
    fortressDeriver: deriver,
    tasks: [scoutTask],
    ticks,
    seed: 42,
  }};
}

describe("cave scouting at long distance", () => {
  it("dwarf reaches entrance 160 tiles away (entrance 0)", async () => {
    const { deriver, entrance, config } = makeScoutScenario(0, 600);

    // Entrance 0 at (256, 96) is 160 Manhattan from spawn
    expect(Math.abs(entrance.x - 256) + Math.abs(entrance.y - 256)).toBeGreaterThanOrEqual(100);

    const result = await runScenario(config);

    const task = result.tasks.find(t => t.task_type === "scout_cave");
    expect(task).toBeDefined();
    expect(task!.status).toBe("completed");

    // Discovery event should fire
    const discoveryEvents = result.events.filter(
      e => e.event_data && (e.event_data as Record<string, unknown>).action === "scout_cave",
    );
    expect(discoveryEvents.length).toBe(1);
    expect(discoveryEvents[0]!.description).toContain("discovered");

    // Marker tile at cave z-level
    const caveZ = deriver.getZForEntrance(entrance.x, entrance.y);
    const marker = result.fortressTileOverrides.find(
      t => t.x === entrance.x && t.y === entrance.y && t.z === caveZ,
    );
    expect(marker?.tile_type).toBe("cavern_floor");
  });

  it("dwarf reaches entrance 288 tiles away (entrance 7)", async () => {
    const { entrance, config } = makeScoutScenario(7, 2000);

    // Entrance 7 at (384, 416) is 288 Manhattan from spawn
    expect(Math.abs(entrance.x - 256) + Math.abs(entrance.y - 256)).toBeGreaterThanOrEqual(200);

    const result = await runScenario(config);

    const task = result.tasks.find(t => t.task_type === "scout_cave");
    expect(task).toBeDefined();
    expect(task!.status).toBe("completed");

    const discoveryEvents = result.events.filter(
      e => e.event_data && (e.event_data as Record<string, unknown>).action === "scout_cave",
    );
    expect(discoveryEvents.length).toBe(1);
  }, 60000);
});
