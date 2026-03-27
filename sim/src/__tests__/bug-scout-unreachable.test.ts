import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill, makeItem, makeStructure } from "./test-helpers.js";
import { createWorldDeriver, createFortressDeriver, WORK_SCOUT_CAVE, SKILL_NAMES } from "@pwarf/shared";

/**
 * Bug reproduction for bug report 51020ece — "dwarf didnt scout cave"
 *
 * The player's fortress is in a **forest** biome with ~8% pond coverage.
 * Cave entrance #7 at (32, 448) is 438 Manhattan tiles from spawn (272, 250).
 * The direct path crosses ~89 pond tiles, forcing A* into massive detours
 * that exhaust the 20k node limit. The dwarf claims the task but pathfinding
 * returns null every tick, leaving work_progress stuck at 0.
 *
 * World seed: 5837771263264388, Civ ID: 14f577a0-d787-4633-b01e-dfdb7879c4ff
 * World tile (30, 8) → forest terrain
 */

const WORLD_SEED = 5837771263264388n;
const CIV_ID = "14f577a0-d787-4633-b01e-dfdb7879c4ff";

function makeBugReproScenario(ticks: number) {
  // Derive the same terrain as the bug report
  const wd = createWorldDeriver(WORLD_SEED);
  const worldTile = wd.deriveTile(30, 8);
  // worldTile.terrain === "forest"

  const deriver = createFortressDeriver(WORLD_SEED, CIV_ID, worldTile.terrain);
  const entrance = deriver.entrances[7]!; // (32, 448) at z=-8

  const dwarf = makeDwarf({
    civilization_id: CIV_ID,
    position_x: 272,
    position_y: 250,
    position_z: 0,
    need_food: 100,
    need_drink: 100,
    need_sleep: 100,
  });

  const skills = SKILL_NAMES.map(s => makeSkill(dwarf.id, s, 2));

  // Place food/drink near spawn so needs don't interfere
  const items = [];
  for (let i = 0; i < 20; i++) {
    items.push(makeItem({
      name: "Plump helmet", category: "food", material: "plant",
      located_in_civ_id: CIV_ID, position_x: 270, position_y: 252, position_z: 0,
    }));
    items.push(makeItem({
      name: "Dwarven ale", category: "drink", material: "plant",
      located_in_civ_id: CIV_ID, position_x: 271, position_y: 252, position_z: 0,
    }));
  }

  const stockpileTiles = [];
  for (let sx = 269; sx <= 272; sx++) {
    for (let sy = 252; sy <= 254; sy++) {
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
      position_x: 268, position_y: 252, position_z: 0,
    }),
    makeStructure({
      civilization_id: CIV_ID, type: "well", completion_pct: 100,
      position_x: 274, position_y: 252, position_z: 0,
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

  return {
    deriver,
    entrance,
    terrain: worldTile.terrain,
    config: {
      dwarves: [dwarf],
      dwarfSkills: skills,
      items,
      structures,
      stockpileTiles,
      fortressDeriver: deriver,
      tasks: [scoutTask],
      ticks,
      seed: 42,
    },
  };
}

describe("bug: scout cave unreachable due to pond-heavy terrain", () => {
  it("confirms forest terrain with ponds blocking the path", () => {
    const { deriver, entrance, terrain } = makeBugReproScenario(1);

    expect(terrain).toBe("forest");

    // Entrance #7 is far from spawn — distance should be 300+ Manhattan
    const dist = Math.abs(entrance.x - 272) + Math.abs(entrance.y - 250);
    expect(dist).toBeGreaterThan(300);

    // Count ponds along the straight-line path from dwarf to entrance
    let pondCount = 0;
    const steps = 500;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(272 + (entrance.x - 272) * t);
      const y = Math.round(250 + (entrance.y - 250) * t);
      const tile = deriver.deriveTile(x, y, 0);
      if (tile.tileType === "pond") pondCount++;
    }

    // Significant pond coverage blocks the direct path
    expect(pondCount).toBeGreaterThan(50);
  });

  it("dwarf reaches distant cave entrance despite pond-heavy forest", async () => {
    const { config } = makeBugReproScenario(2000);

    const result = await runScenario(config);

    const task = result.tasks.find(t => t.task_type === "scout_cave");
    expect(task).toBeDefined();

    // With path caching, the dwarf should eventually reach the entrance
    // even through pond-heavy terrain (the path is computed once and cached).
    // Previously this was unreachable due to A* node limit per tick.
    expect(task!.status).toBe("completed");
  }, 180_000);
});
