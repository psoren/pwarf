import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill } from "./test-helpers.js";
import {
  createFortressDeriver,
  generateCaveName,
  getCaveSeed,
  WORK_SCOUT_CAVE,
  WORK_MINE_BASE,
} from "@pwarf/shared";
import type { Cave } from "@pwarf/shared";

/**
 * Scenario tests for the caves table integration.
 *
 * Verifies:
 * - Scouting a cave sets discovered=true on the cave row
 * - discovered_by is set to the scouting dwarf's ID
 * - After scouting, ore inside the cave can be mined
 * - Cave row data persists correctly through the scenario
 */

const SEED = 42n;
const CIV_ID = "test-civ";

/** Create cave rows matching what embark.ts would insert. */
function makeCaveRows(deriver: ReturnType<typeof createFortressDeriver>): Cave[] {
  return deriver.entrances.map((entrance, i) => {
    const nameSeed = getCaveSeed(SEED, CIV_ID, entrance.x, entrance.y);
    return {
      id: `cave-${i}`,
      civilization_id: CIV_ID,
      entrance_x: entrance.x,
      entrance_y: entrance.y,
      z_level: entrance.z,
      name: generateCaveName(nameSeed),
      discovered: false,
      discovered_by: null,
      discovered_at: null,
      danger_level: 10,
      resource_type: null,
      created_at: new Date().toISOString(),
    };
  });
}

describe("caves table integration", () => {
  it("scouting a cave sets discovered=true and discovered_by on the cave row", async () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0]!;
    const caves = makeCaveRows(deriver);

    const dwarf = makeDwarf({
      id: "scout-d1",
      civilization_id: CIV_ID,
      position_x: entrance.x,
      position_y: entrance.y,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const scoutTask = makeTask("scout_cave", {
      civilization_id: CIV_ID,
      status: "pending",
      target_x: entrance.x,
      target_y: entrance.y,
      target_z: 0,
      work_progress: 0,
      work_required: WORK_SCOUT_CAVE,
    });

    const skills = [
      makeSkill(dwarf.id, "mining", 1),
      makeSkill(dwarf.id, "building", 1),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      tasks: [scoutTask],
      caves,
      fortressDeriver: deriver,
      ticks: 300,
      seed: 42,
    });

    // Scout task should be completed
    const task = result.tasks.find(t => t.task_type === "scout_cave");
    expect(task).toBeDefined();
    expect(task!.status).toBe("completed");

    // The first cave should now be discovered
    const cave = result.caves.find(c => c.entrance_x === entrance.x && c.entrance_y === entrance.y);
    expect(cave).toBeDefined();
    expect(cave!.discovered).toBe(true);
    expect(cave!.discovered_by).toBe(dwarf.id);
    expect(cave!.discovered_at).toBeTruthy();

    // Other caves should remain undiscovered
    const otherCaves = result.caves.filter(c => c.entrance_x !== entrance.x || c.entrance_y !== entrance.y);
    for (const other of otherCaves) {
      expect(other.discovered).toBe(false);
    }
  });

  it("after scouting, ore inside the cave can be mined", async () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0]!;
    const caveZ = deriver.getZForEntrance(entrance.x, entrance.y)!;
    const caves = makeCaveRows(deriver);

    // Find an ore tile in this cave
    let oreX = -1, oreY = -1;
    let oreMaterial = "";
    for (let x = 192; x < 320 && oreX < 0; x++) {
      for (let y = 192; y < 320 && oreX < 0; y++) {
        const tile = deriver.deriveTile(x, y, caveZ);
        if (tile.tileType === "ore" && tile.material) {
          oreX = x;
          oreY = y;
          oreMaterial = tile.material;
        }
      }
    }
    expect(oreX).toBeGreaterThan(0);

    // Two dwarves: one scouts, one will mine after
    const scout = makeDwarf({
      id: "scout-d2",
      civilization_id: CIV_ID,
      position_x: entrance.x,
      position_y: entrance.y,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const miner = makeDwarf({
      id: "miner-d1",
      civilization_id: CIV_ID,
      position_x: oreX,
      position_y: oreY,
      position_z: caveZ,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const scoutTask = makeTask("scout_cave", {
      id: "scout-first",
      civilization_id: CIV_ID,
      status: "pending",
      target_x: entrance.x,
      target_y: entrance.y,
      target_z: 0,
      work_progress: 0,
      work_required: WORK_SCOUT_CAVE,
    });

    const mineTask = makeTask("mine", {
      id: "mine-ore",
      civilization_id: CIV_ID,
      status: "pending",
      target_x: oreX,
      target_y: oreY,
      target_z: caveZ,
      work_progress: 0,
      work_required: WORK_MINE_BASE,
    });

    const skills = [
      makeSkill(scout.id, "mining", 1),
      makeSkill(scout.id, "building", 1),
      makeSkill(miner.id, "mining", 3),
      makeSkill(miner.id, "building", 1),
    ];

    const result = await runScenario({
      dwarves: [scout, miner],
      dwarfSkills: skills,
      tasks: [scoutTask, mineTask],
      caves,
      fortressDeriver: deriver,
      ticks: 600,
      seed: 42,
    });

    // Scout task completed
    const sTask = result.tasks.find(t => t.id === "scout-first");
    expect(sTask!.status).toBe("completed");

    // Mine task completed
    const mTask = result.tasks.find(t => t.id === "mine-ore");
    expect(mTask).toBeDefined();
    expect(mTask!.status).toBe("completed");

    // Ore item was produced
    const expectedName = `${oreMaterial.charAt(0).toUpperCase() + oreMaterial.slice(1)} ore`;
    const oreItem = result.items.find(i => i.name === expectedName);
    expect(oreItem).toBeDefined();
    expect(oreItem!.material).toBe(oreMaterial);

    // Cave is discovered
    const cave = result.caves.find(c => c.z_level === caveZ);
    expect(cave!.discovered).toBe(true);
  });
});
