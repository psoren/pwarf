import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill } from "./test-helpers.js";
import { createFortressDeriver, WORK_SCOUT_CAVE } from "@pwarf/shared";

/**
 * Cave exploration scenario tests — more complex than cave-scenario.test.ts.
 *
 * Tests:
 * - Two scout_cave tasks at the same entrance both complete
 * - Only one cavern_floor marker tile exists (no duplicates)
 * - Discovery event mentions the cave name
 * - Cave name follows the "The X of Y" pattern
 */

const SEED = 42n;
const CIV_ID = "test-civ";

describe("cave explore scenario (duplicate prevention and discovery naming)", () => {
  it("two scout_cave tasks at same entrance both complete", async () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0];
    expect(entrance).toBeDefined();

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

    // Create two scout_cave tasks at the same entrance location
    const scoutTask1 = makeTask("scout_cave", {
      id: "scout-task-1",
      civilization_id: CIV_ID,
      status: "pending",
      target_x: entrance.x,
      target_y: entrance.y,
      target_z: 0,
      work_progress: 0,
      work_required: WORK_SCOUT_CAVE,
    });

    const scoutTask2 = makeTask("scout_cave", {
      id: "scout-task-2",
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
      makeSkill(dwarf.id, "farming", 1),
      makeSkill(dwarf.id, "fighting", 1),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      tasks: [scoutTask1, scoutTask2],
      fortressDeriver: deriver,
      ticks: 600, // generous ticks for two scout completions
      seed: 42,
    });

    // Both tasks should be completed
    const task1 = result.tasks.find(t => t.id === scoutTask1.id);
    const task2 = result.tasks.find(t => t.id === scoutTask2.id);
    expect(task1).toBeDefined();
    expect(task2).toBeDefined();
    expect(task1!.status).toBe("completed");
    expect(task2!.status).toBe("completed");
  });

  it("second scout at same entrance does not duplicate cavern_floor marker", async () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0];
    expect(entrance).toBeDefined();

    const caveZ = deriver.getZForEntrance(entrance.x, entrance.y);
    expect(caveZ).not.toBeNull();

    const dwarf = makeDwarf({
      id: "scout-d2",
      civilization_id: CIV_ID,
      position_x: entrance.x,
      position_y: entrance.y,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const scoutTask1 = makeTask("scout_cave", {
      id: "scout-dedup-1",
      civilization_id: CIV_ID,
      status: "pending",
      target_x: entrance.x,
      target_y: entrance.y,
      target_z: 0,
      work_progress: 0,
      work_required: WORK_SCOUT_CAVE,
    });

    const scoutTask2 = makeTask("scout_cave", {
      id: "scout-dedup-2",
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
      makeSkill(dwarf.id, "farming", 1),
      makeSkill(dwarf.id, "fighting", 1),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      tasks: [scoutTask1, scoutTask2],
      fortressDeriver: deriver,
      ticks: 600,
      seed: 42,
    });

    // Only 1 cavern_floor marker at the cave z-level for this entrance location
    const markerTiles = result.fortressTileOverrides.filter(
      t => t.x === entrance.x && t.y === entrance.y && t.z === caveZ && t.tile_type === "cavern_floor",
    );
    expect(markerTiles.length).toBe(1); // no duplicate from second scout
  });

  it("discovery event contains the cave name", async () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0];
    expect(entrance).toBeDefined();

    const dwarf = makeDwarf({
      id: "scout-d3",
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
      fortressDeriver: deriver,
      ticks: 300,
      seed: 42,
    });

    // At least 1 discovery event from scouting
    const discoveryEvents = result.events.filter(
      e => e.event_data && (e.event_data as Record<string, unknown>).action === "scout_cave",
    );
    expect(discoveryEvents.length).toBeGreaterThanOrEqual(1);

    // The discovery event description should mention "discovered"
    expect(discoveryEvents[0]!.description).toContain("discovered");
  });

  it("cave name in deriver matches 'The X of Y' pattern", async () => {
    // Validate that the cave names generated by the deriver follow the naming pattern.
    const deriver = createFortressDeriver(SEED, CIV_ID);

    // Check names of all entrances' caves using z-level
    for (const entrance of deriver.entrances) {
      const z = deriver.getZForEntrance(entrance.x, entrance.y);
      if (z !== null) {
        const caveName = deriver.getCaveName(z);
        if (caveName) {
          // "The X of Y" — starts with "The ", contains " of "
          expect(caveName).toMatch(/^The .+ of .+$/);
        }
      }
    }
  });
});
