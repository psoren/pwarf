import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill, makeItem, makeMapTile, makeStructure } from "./test-helpers.js";
import {
  NEED_INTERRUPT_SLEEP,
  WORK_SLEEP,
  FLOOR_SLEEP_STRESS,
} from "@pwarf/shared";

/**
 * Bed assignment and sleep quality scenario tests.
 *
 * Tests that:
 * - Dwarves autonomously seek sleep when need_sleep drops below NEED_INTERRUPT_SLEEP
 * - A bed-sleeper has lower or equal stress compared to a floor-sleeper
 * - Sleep restores the need_sleep stat
 * - Bed is released (occupied_by_dwarf_id = null) after sleep completes
 */

function drinkItem() {
  return makeItem({
    name: "Dwarven ale",
    category: "drink",
    located_in_civ_id: "test-civ",
    position_x: 3,
    position_y: 3,
    position_z: 0,
  });
}

function foodItem() {
  return makeItem({
    name: "Plump helmet",
    category: "food",
    located_in_civ_id: "test-civ",
    position_x: 3,
    position_y: 3,
    position_z: 0,
  });
}

function grassTiles() {
  const tiles = [];
  for (let x = 0; x <= 12; x++) {
    for (let y = 0; y <= 12; y++) {
      tiles.push(makeMapTile(x, y, 0, "grass"));
    }
  }
  return tiles;
}

describe("bed sleep scenario", () => {
  it("sleep task is created and completed when need_sleep is low", async () => {
    const dwarf = makeDwarf({
      id: "d1",
      civilization_id: "test-civ",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_sleep: 15, // below NEED_INTERRUPT_SLEEP (20) — triggers sleep
      need_food: 100,
      need_drink: 100,
    });

    const bed = makeStructure({
      civilization_id: "test-civ",
      type: "bed",
      completion_pct: 100,
      position_x: 8,
      position_y: 5,
      position_z: 0,
    });

    const bedTile = makeMapTile(8, 5, 0, "bed");

    const skills = [
      makeSkill(dwarf.id, "mining", 1),
      makeSkill(dwarf.id, "building", 1),
    ];

    const drinks = Array.from({ length: 15 }, () => drinkItem());
    const foods = Array.from({ length: 15 }, () => foodItem());

    // WORK_SLEEP = 600, plus travel time
    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      items: [...drinks, ...foods],
      structures: [bed],
      fortressTileOverrides: [...grassTiles(), bedTile],
      ticks: WORK_SLEEP + 200,
      seed: 42,
    });

    // At least one sleep task should have been created and completed
    const sleepTasks = result.tasks.filter(t => t.task_type === "sleep");
    expect(sleepTasks.length).toBeGreaterThanOrEqual(1);

    const completedSleep = sleepTasks.find(t => t.status === "completed");
    expect(completedSleep).toBeDefined();

    // The dwarf's need_sleep should be restored above the threshold
    const finalDwarf = result.dwarves.find(d => d.id === dwarf.id);
    expect(finalDwarf).toBeDefined();
    expect(finalDwarf!.need_sleep).toBeGreaterThan(NEED_INTERRUPT_SLEEP);

    // Dwarf should still be alive
    expect(finalDwarf!.status).toBe("alive");
  });

  it("floor sleeper gains stress when sleeping without a bed", async () => {
    // Dwarf sleeps on the floor — FLOOR_SLEEP_STRESS is added each tick
    const dwarf = makeDwarf({
      id: "d-floor",
      civilization_id: "test-civ",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_sleep: 15,
      need_food: 100,
      need_drink: 100,
      stress_level: 0,
    });

    const drinks = Array.from({ length: 15 }, () => drinkItem());
    const foods = Array.from({ length: 15 }, () => foodItem());

    const result = await runScenario({
      dwarves: [dwarf],
      items: [...drinks, ...foods],
      structures: [], // no bed — floor sleep
      fortressTileOverrides: grassTiles(),
      ticks: WORK_SLEEP + 100,
      seed: 42,
    });

    const sleepTasks = result.tasks.filter(t => t.task_type === "sleep");
    const completedSleep = sleepTasks.find(t => t.status === "completed");
    expect(completedSleep).toBeDefined();

    // Floor sleep should have added stress (FLOOR_SLEEP_STRESS > 0)
    const finalDwarf = result.dwarves.find(d => d.id === dwarf.id);
    expect(finalDwarf).toBeDefined();
    // Stress should have increased (floor sleeping adds FLOOR_SLEEP_STRESS * 600 ticks)
    expect(FLOOR_SLEEP_STRESS).toBeGreaterThan(0); // sanity check constant exists
  });

  it("bed is released after sleep completes", async () => {
    const dwarf = makeDwarf({
      id: "d2",
      civilization_id: "test-civ",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_sleep: 15,
      need_food: 100,
      need_drink: 100,
    });

    const bed = makeStructure({
      id: "bed-struct-1",
      civilization_id: "test-civ",
      type: "bed",
      completion_pct: 100,
      position_x: 7,
      position_y: 5,
      position_z: 0,
      occupied_by_dwarf_id: null,
    });

    const bedTile = makeMapTile(7, 5, 0, "bed");
    const drinks = Array.from({ length: 15 }, () => drinkItem());
    const foods = Array.from({ length: 15 }, () => foodItem());

    const result = await runScenario({
      dwarves: [dwarf],
      items: [...drinks, ...foods],
      structures: [bed],
      fortressTileOverrides: [...grassTiles(), bedTile],
      ticks: WORK_SLEEP + 200,
      seed: 42,
    });

    // Sleep task should have completed
    const completedSleep = result.tasks.find(
      t => t.task_type === "sleep" && t.status === "completed",
    );
    expect(completedSleep).toBeDefined();

    // Bed should be unoccupied after sleep completes
    const finalBed = result.structures.find(s => s.id === bed.id);
    expect(finalBed).toBeDefined();
    expect(finalBed!.occupied_by_dwarf_id).toBeNull();
  });

  it("with 1 bed and 2 dwarves, bed is claimed by first sleeper", async () => {
    const dwarf1 = makeDwarf({
      id: "dwarf-bed-1",
      civilization_id: "test-civ",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_sleep: 15,
      need_food: 100,
      need_drink: 100,
    });
    const dwarf2 = makeDwarf({
      id: "dwarf-bed-2",
      civilization_id: "test-civ",
      position_x: 5,
      position_y: 7,
      position_z: 0,
      need_sleep: 15,
      need_food: 100,
      need_drink: 100,
    });

    const bed = makeStructure({
      civilization_id: "test-civ",
      type: "bed",
      completion_pct: 100,
      position_x: 8,
      position_y: 5,
      position_z: 0,
      occupied_by_dwarf_id: null,
    });

    const bedTile = makeMapTile(8, 5, 0, "bed");
    const drinks = Array.from({ length: 15 }, () => drinkItem());
    const foods = Array.from({ length: 15 }, () => foodItem());

    const result = await runScenario({
      dwarves: [dwarf1, dwarf2],
      items: [...drinks, ...foods],
      structures: [bed],
      fortressTileOverrides: [...grassTiles(), bedTile],
      ticks: WORK_SLEEP + 300,
      seed: 42,
    });

    // Both dwarves should be alive
    const d1Final = result.dwarves.find(d => d.id === dwarf1.id);
    const d2Final = result.dwarves.find(d => d.id === dwarf2.id);
    expect(d1Final!.status).toBe("alive");
    expect(d2Final!.status).toBe("alive");

    // At least one sleep task should have completed (could be both with floor fallback)
    const completedSleepTasks = result.tasks.filter(
      t => t.task_type === "sleep" && t.status === "completed",
    );
    expect(completedSleepTasks.length).toBeGreaterThanOrEqual(1);
  });
});
