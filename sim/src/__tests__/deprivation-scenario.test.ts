import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeMapTile } from "./test-helpers.js";
import { DEHYDRATION_TICKS, SKILL_NAMES } from "@pwarf/shared";

/**
 * Deprivation scenario tests
 *
 * Tests that:
 * - A dwarf with no food and no drink dies from dehydration (faster than starvation)
 * - The cause_of_death is "dehydration" and status is "dead"
 * - fortress_fallen event fires when the last dwarf dies
 */

/**
 * Build a tile grid with stone inside and a ring of door tiles around the perimeter.
 * Door tiles block monster pathfinding, preventing monsters from reaching the dwarf
 * so the test can isolate deprivation as the cause of death.
 */
function buildProtectedStoneTiles() {
  const tiles: ReturnType<typeof makeMapTile>[] = [];
  const minX = 250;
  const maxX = 265;
  const minY = 250;
  const maxY = 265;

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const isEdge = x === minX || x === maxX || y === minY || y === maxY;
      tiles.push(makeMapTile(x, y, 0, isEdge ? "door" : "stone"));
    }
  }
  return tiles;
}

/**
 * Create a minimal deprivation scenario config.
 * Uses makeDwarf directly with needs already at 0 so the dehydration counter
 * starts ticking immediately, reducing the required tick count.
 */
function makeDeprivationConfig() {
  const dwarf = makeDwarf({
    civilization_id: "test-civ",
    position_x: 256,
    position_y: 256,
    position_z: 0,
    need_food: 0,
    need_drink: 0,
    need_sleep: 100,
    need_social: 80,
  });

  const dwarfSkills = SKILL_NAMES.map(skill => makeSkill(dwarf.id, skill, 2));

  return {
    dwarves: [dwarf],
    dwarfSkills,
    items: [],
    structures: [],
    fortressTileOverrides: buildProtectedStoneTiles(),
    // With needs already at 0, the dwarf dies after DEHYDRATION_TICKS (9000).
    // Add a small buffer for timing.
    ticks: DEHYDRATION_TICKS + 500,
    seed: 42,
  };
}

describe("deprivation scenario", () => {
  it("dwarf dies from dehydration when no food or drink is available", async () => {
    const config = makeDeprivationConfig();
    const result = await runScenario(config);

    // The dwarf should be dead
    expect(result.dwarves).toHaveLength(1);
    const dwarf = result.dwarves[0]!;
    expect(dwarf.status).toBe("dead");
    expect(dwarf.cause_of_death).toBe("dehydration");
  }, 60_000);

  it("fortress_fallen event fires when the last dwarf dies", async () => {
    const config = makeDeprivationConfig();
    const result = await runScenario(config);

    // fortress_fallen event should have fired
    const fallenEvent = result.events.find(e => e.category === "fortress_fallen");
    expect(fallenEvent).toBeDefined();
    expect(fallenEvent!.description).toContain("fortress has fallen");
  }, 60_000);
});
