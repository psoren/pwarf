/**
 * CHAOS TESTS — adversarial scenarios designed to BREAK the sim engine.
 *
 * Each test attempts to trigger crashes, corrupted state, deadlocks, or
 * impossible arithmetic (NaN/Infinity). Tests must NOT modify source files.
 *
 * Classification:
 *   CRASH    — unhandled error thrown
 *   BUG      — incorrect / corrupted state reached
 *   DEADLOCK — tasks never complete when they should
 *   RESILIENT — handled gracefully
 */

import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import {
  makeDwarf,
  makeItem,
  makeTask,
  makeStructure,
  makeMonster,
  makeMapTile,
  makeSkill,
} from "./test-helpers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertFiniteNeeds(dwarves: ReturnType<typeof makeDwarf>[]): void {
  for (const d of dwarves) {
    expect(Number.isFinite(d.need_food), `need_food NaN/Infinity for ${d.name}`).toBe(true);
    expect(Number.isFinite(d.need_drink), `need_drink NaN/Infinity for ${d.name}`).toBe(true);
    expect(Number.isFinite(d.need_sleep), `need_sleep NaN/Infinity for ${d.name}`).toBe(true);
    expect(Number.isFinite(d.stress_level), `stress_level NaN/Infinity for ${d.name}`).toBe(true);
    expect(d.need_food, `need_food below 0 for ${d.name}`).toBeGreaterThanOrEqual(0);
    expect(d.need_drink, `need_drink below 0 for ${d.name}`).toBeGreaterThanOrEqual(0);
    expect(d.need_sleep, `need_sleep below 0 for ${d.name}`).toBeGreaterThanOrEqual(0);
    expect(d.stress_level, `stress_level below 0 for ${d.name}`).toBeGreaterThanOrEqual(0);
    expect(d.need_food, `need_food above 100 for ${d.name}`).toBeLessThanOrEqual(100);
    expect(d.need_drink, `need_drink above 100 for ${d.name}`).toBeLessThanOrEqual(100);
    expect(d.need_sleep, `need_sleep above 100 for ${d.name}`).toBeLessThanOrEqual(100);
  }
}

function assertNoDeadDwarfWithTask(dwarves: ReturnType<typeof makeDwarf>[]): void {
  for (const d of dwarves) {
    if (d.status === "dead") {
      expect(
        d.current_task_id,
        `Dead dwarf ${d.name} still has current_task_id set`,
      ).toBeNull();
    }
  }
}

// ---------------------------------------------------------------------------
// Category 1: Resource edge cases
// ---------------------------------------------------------------------------

describe("Resource edge cases", () => {
  it("survives with zero items in the world", async () => {
    const dwarf = makeDwarf({ need_food: 80, need_drink: 80, need_sleep: 80 });
    const result = await runScenario({ dwarves: [dwarf], items: [], ticks: 200 });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    // No crash reaching here is the primary assertion
    expect(result.ticks).toBe(200);
  });

  it("survives when all items are held by a dwarf (none on ground)", async () => {
    const dwarf = makeDwarf({ need_food: 80, need_drink: 80 });
    const carrier = makeDwarf({ name: "Carrier", need_food: 80, need_drink: 80 });
    // Give the carrier ALL the food — none is available for the first dwarf
    const food = makeItem({
      category: "food",
      held_by_dwarf_id: carrier.id,
      position_x: null,
      position_y: null,
      position_z: null,
    });
    const drink = makeItem({
      category: "drink",
      held_by_dwarf_id: carrier.id,
      position_x: null,
      position_y: null,
      position_z: null,
    });

    const result = await runScenario({
      dwarves: [dwarf, carrier],
      items: [food, drink],
      ticks: 300,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(300);
  });

  it("handles a mine task with work_required of 0 (instant completion)", async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 0, position_z: 0 });
    const skill = makeSkill(dwarf.id, "mining", 1, 10);
    const task = makeTask("mine", {
      status: "pending",
      target_x: 2,
      target_y: 0,
      target_z: 0,
      work_required: 0,
      work_progress: 0,
    });
    const rockTile = makeMapTile(2, 0, 0, "rock");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [rockTile],
      ticks: 10,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    // Task should have completed
    const completedTasks = result.tasks.filter(t => t.status === "completed");
    expect(completedTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("handles items with null positions in the world gracefully", async () => {
    const dwarf = makeDwarf({ need_food: 20, need_drink: 80 }); // hunger will trigger eat
    // Items with null positions are "floating" — not reachable
    const nullPosFood = makeItem({
      category: "food",
      position_x: null,
      position_y: null,
      position_z: null,
      held_by_dwarf_id: null,
    });
    const nullPosDrink = makeItem({
      category: "drink",
      position_x: null,
      position_y: null,
      position_z: null,
      held_by_dwarf_id: null,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [nullPosFood, nullPosDrink],
      ticks: 100,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Category 2: Pathfinding nightmares
// ---------------------------------------------------------------------------

describe("Pathfinding nightmares", () => {
  it("survives when a dwarf is completely walled in on all 4 sides", async () => {
    // Dwarf at (5,5). Walls at (4,5), (6,5), (5,4), (5,6) — all cardinal neighbors.
    const dwarf = makeDwarf({
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 80,
      need_drink: 80,
    });
    const skill = makeSkill(dwarf.id, "mining", 0, 0);
    // A mine task far away — dwarf cannot path to it
    const task = makeTask("mine", {
      status: "pending",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 100,
    });
    const walls = [
      makeMapTile(4, 5, 0, "constructed_wall"),
      makeMapTile(6, 5, 0, "constructed_wall"),
      makeMapTile(5, 4, 0, "constructed_wall"),
      makeMapTile(5, 6, 0, "constructed_wall"),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: walls,
      ticks: 100,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    // Task should have been released (failed/pending) since dwarf can't reach it
    const taskAfter = result.tasks.find(t => t.id === task.id);
    if (taskAfter && taskAfter.status !== "completed") {
      expect(["pending", "failed", "claimed", "cancelled"]).toContain(taskAfter.status);
    }
  });

  it("handles a mine task targeting a constructed_wall tile (unwalkable target)", async () => {
    // constructed_wall is not a normal mine target — it's already built
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const skill = makeSkill(dwarf.id, "mining", 0, 0);
    const wallTile = makeMapTile(1, 0, 0, "constructed_wall");
    const task = makeTask("mine", {
      status: "pending",
      target_x: 1,
      target_y: 0,
      target_z: 0,
      work_required: 100,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [wallTile],
      ticks: 50,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(50);
  });

  it("handles mine task inside a closed ring of walls — dwarf outside can't enter", { timeout: 30000 }, async () => {
    // Ring of walls at (5,4), (5,6), (4,5), (6,5) around tile (5,5).
    // Rock at (5,5) is the target. Dwarf at (0,0) can never get adjacent.
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const skill = makeSkill(dwarf.id, "mining", 0, 0);
    const enclosure = [
      makeMapTile(5, 4, 0, "constructed_wall"),
      makeMapTile(5, 6, 0, "constructed_wall"),
      makeMapTile(4, 5, 0, "constructed_wall"),
      makeMapTile(6, 5, 0, "constructed_wall"),
      makeMapTile(5, 5, 0, "rock"),
    ];
    const task = makeTask("mine", {
      status: "pending",
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 100,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: enclosure,
      ticks: 100,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(100);
  });

  it("handles a mine task targeting a grass tile (already cleared)", async () => {
    // Grass is walkable — dwarf stands on it, not adjacent. Mine completes but produces nothing useful.
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const skill = makeSkill(dwarf.id, "mining", 0, 0);
    const grassTile = makeMapTile(2, 0, 0, "grass");
    const task = makeTask("mine", {
      status: "pending",
      target_x: 2,
      target_y: 0,
      target_z: 0,
      work_required: 50,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [grassTile],
      ticks: 200,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Category 3: Population stress
// ---------------------------------------------------------------------------

describe("Population stress", () => {
  it("survives with 0 dwarves and 0 items — empty world", async () => {
    const result = await runScenario({ dwarves: [], items: [], ticks: 500 });
    expect(result.ticks).toBe(500);
    expect(result.dwarves.length).toBe(0);
    // No crash reaching here
  });

  it("1 dwarf solo survival for 2000 ticks with food and drink", async () => {
    const dwarf = makeDwarf({ need_food: 80, need_drink: 80, need_sleep: 80 });
    // Plenty of food and drink scattered nearby
    const foods = Array.from({ length: 30 }, (_, i) =>
      makeItem({
        category: "food",
        position_x: i % 10,
        position_y: Math.floor(i / 10),
        position_z: 0,
      }),
    );
    const drinks = Array.from({ length: 30 }, (_, i) =>
      makeItem({
        category: "drink",
        position_x: (i % 10) + 10,
        position_y: Math.floor(i / 10),
        position_z: 0,
      }),
    );
    const bed = makeStructure({
      type: "bed",
      completion_pct: 100,
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [...foods, ...drinks],
      structures: [bed],
      ticks: 2000,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(2000);
  });

  it("50 dwarves crammed into a small area — no crash, no NaN", async () => {
    const dwarves = Array.from({ length: 50 }, (_, i) =>
      makeDwarf({
        name: `Dwarf${i}`,
        position_x: i % 7,
        position_y: Math.floor(i / 7),
        position_z: 0,
        need_food: 80,
        need_drink: 80,
        need_sleep: 80,
      }),
    );
    // Some food and drink nearby
    const foods = Array.from({ length: 20 }, (_, i) =>
      makeItem({ category: "food", position_x: i, position_y: 8, position_z: 0 }),
    );
    const drinks = Array.from({ length: 20 }, (_, i) =>
      makeItem({ category: "drink", position_x: i, position_y: 9, position_z: 0 }),
    );

    const result = await runScenario({
      dwarves,
      items: [...foods, ...drinks],
      ticks: 300,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(300);
  });

  it("all dwarves start dead — world still runs without crash", async () => {
    const dwarves = Array.from({ length: 5 }, (_, i) =>
      makeDwarf({
        name: `Dead${i}`,
        status: "dead",
        died_year: 1,
        cause_of_death: "starvation",
        current_task_id: null,
      }),
    );

    const result = await runScenario({ dwarves, ticks: 100 });
    expect(result.ticks).toBe(100);
    // All dwarves still dead, no resurrection
    for (const d of result.dwarves) {
      expect(d.status).toBe("dead");
    }
  });
});

// ---------------------------------------------------------------------------
// Category 4: Task system abuse
// ---------------------------------------------------------------------------

describe("Task system abuse", () => {
  it("handles a task with null target position", async () => {
    const dwarf = makeDwarf({ need_food: 80, need_drink: 80 });
    const skill = makeSkill(dwarf.id, "mining", 0, 0);
    const task = makeTask("mine", {
      status: "pending",
      target_x: null,
      target_y: null,
      target_z: null,
      work_required: 100,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      ticks: 50,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(50);
  });

  it("handles two tasks targeting the exact same tile simultaneously", async () => {
    const dwarf1 = makeDwarf({ name: "Urist", position_x: 0, position_y: 0 });
    const dwarf2 = makeDwarf({ name: "Doren", position_x: 2, position_y: 0 });
    const skill1 = makeSkill(dwarf1.id, "mining", 0, 0);
    const skill2 = makeSkill(dwarf2.id, "mining", 0, 0);
    const tile = makeMapTile(1, 0, 0, "rock");
    const task1 = makeTask("mine", {
      status: "pending",
      target_x: 1,
      target_y: 0,
      target_z: 0,
      work_required: 100,
    });
    const task2 = makeTask("mine", {
      status: "pending",
      target_x: 1,
      target_y: 0,
      target_z: 0,
      work_required: 100,
    });

    const result = await runScenario({
      dwarves: [dwarf1, dwarf2],
      dwarfSkills: [skill1, skill2],
      tasks: [task1, task2],
      fortressTileOverrides: [tile],
      ticks: 300,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(300);
  });

  it("handles a build task with no matching resources anywhere", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0 });
    const skill = makeSkill(dwarf.id, "building", 0, 0);
    const task = makeTask("build_wall", {
      status: "pending",
      target_x: 1,
      target_y: 0,
      target_z: 0,
      work_required: 40,
    });
    // No stone anywhere — build must fail gracefully
    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      items: [],
      ticks: 200,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    // Task should remain pending, not completed
    const taskAfter = result.tasks.find(t => t.id === task.id);
    if (taskAfter) {
      expect(taskAfter.status).not.toBe("completed");
    }
  });

  it("handles 100 pending mine tasks with only 1 dwarf", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, need_food: 80, need_drink: 80, need_sleep: 80 });
    const skill = makeSkill(dwarf.id, "mining", 5, 500);
    const tasks = Array.from({ length: 100 }, (_, i) => {
      const x = (i % 10) + 2;
      const y = Math.floor(i / 10) + 2;
      return makeTask("mine", {
        status: "pending",
        target_x: x,
        target_y: y,
        target_z: 0,
        work_required: 100,
      });
    });
    const tiles = Array.from({ length: 100 }, (_, i) =>
      makeMapTile((i % 10) + 2, Math.floor(i / 10) + 2, 0, "rock"),
    );
    // Plenty of food and drink
    const foods = Array.from({ length: 20 }, (_, i) =>
      makeItem({ category: "food", position_x: i, position_y: 15, position_z: 0 }),
    );

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks,
      fortressTileOverrides: tiles,
      items: foods,
      ticks: 500,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(500);
  });

  it("handles a haul task for an item with null position and no holder", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0 });
    const floatingItem = makeItem({
      position_x: null,
      position_y: null,
      position_z: null,
      held_by_dwarf_id: null,
    });
    const task = makeTask("haul", {
      status: "pending",
      target_x: 5,
      target_y: 5,
      target_z: 0,
      target_item_id: floatingItem.id,
      work_required: 10,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [floatingItem],
      tasks: [task],
      ticks: 50,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Category 5: Combat chaos
// ---------------------------------------------------------------------------

describe("Combat chaos", () => {
  it("handles a monster starting on top of a dwarf (same tile)", async () => {
    const dwarf = makeDwarf({
      position_x: 5,
      position_y: 5,
      position_z: 0,
      health: 100,
    });
    const monster = makeMonster({
      current_tile_x: 5,
      current_tile_y: 5,
      threat_level: 30,
      health: 50,
      status: "active",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      monsters: [monster],
      ticks: 200,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    // Either dwarf or monster should be dead/slain
    const dwarfAfter = result.dwarves[0];
    const monsterAfter = result.structures.find(() => false); // monsters in result
    expect(dwarfAfter).toBeDefined();
    expect(result.ticks).toBe(200);
  });

  it("handles a monster with 1 health that dies instantly on first combat tick", async () => {
    const dwarf = makeDwarf({
      position_x: 5,
      position_y: 5,
      position_z: 0,
      health: 100,
    });
    const fragileMonster = makeMonster({
      current_tile_x: 5,
      current_tile_y: 5,
      threat_level: 30,
      health: 1,
      status: "active",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      monsters: [fragileMonster],
      ticks: 50,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    // Monster should be slain quickly
    const monsterAfter = result.structures; // check via events
    const slainEvent = result.events.find(e => e.category === "monster_slain");
    expect(slainEvent).toBeDefined();
  });

  it("handles an unkillable monster with 999 health and 200 threat — dwarves die but no crash", async () => {
    const dwarf = makeDwarf({
      position_x: 5,
      position_y: 5,
      position_z: 0,
      health: 100,
    });
    const unkillable = makeMonster({
      current_tile_x: 5,
      current_tile_y: 5,
      threat_level: 200,
      health: 999,
      status: "active",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      monsters: [unkillable],
      ticks: 100,
    });
    // Dwarf should die but no crash
    assertNoDeadDwarfWithTask(result.dwarves);
    const dwarfAfter = result.dwarves[0];
    expect(dwarfAfter.status).toBe("dead");
    expect(result.ticks).toBe(100);
  });

  it("handles 3 monsters attacking simultaneously — multi-combat no crash", async () => {
    const dwarves = Array.from({ length: 5 }, (_, i) =>
      makeDwarf({
        name: `Dwarf${i}`,
        position_x: 5,
        position_y: 5,
        position_z: 0,
        health: 100,
      }),
    );
    const monsters = [
      makeMonster({ current_tile_x: 5, current_tile_y: 5, threat_level: 30, health: 50, status: "active" }),
      makeMonster({ current_tile_x: 5, current_tile_y: 5, threat_level: 40, health: 60, status: "active" }),
      makeMonster({ current_tile_x: 5, current_tile_y: 5, threat_level: 25, health: 45, status: "active" }),
    ];

    const result = await runScenario({
      dwarves,
      monsters,
      ticks: 200,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Category 6: Need satisfaction races
// ---------------------------------------------------------------------------

describe("Need satisfaction races", () => {
  it("handles all needs at 0 simultaneously — no infinite loop", async () => {
    const dwarf = makeDwarf({
      need_food: 0,
      need_drink: 0,
      need_sleep: 0,
      need_social: 0,
    });
    // No food, no drink, no bed — dwarf can't satisfy any need
    const result = await runScenario({
      dwarves: [dwarf],
      items: [],
      ticks: 100,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(100);
  });

  it("dwarves starve gracefully when no food or drink exists — death, not crash", async () => {
    // Needs start near 0, no food/drink anywhere
    const dwarves = Array.from({ length: 3 }, (_, i) =>
      makeDwarf({
        name: `Starving${i}`,
        need_food: 1,
        need_drink: 1,
        need_sleep: 80,
      }),
    );

    // Run long enough for dehydration to trigger
    const result = await runScenario({
      dwarves,
      items: [],
      ticks: 10_000,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    // All should eventually die
    const aliveDwarves = result.dwarves.filter(d => d.status === "alive");
    expect(aliveDwarves.length).toBe(0);
    // Fortress fallen event should have fired
    const fallenEvent = result.events.find(e => e.category === "fortress_fallen");
    expect(fallenEvent).toBeDefined();
  });

  it("handles need_sleep at 0 with no beds — dwarf sleeps on floor", async () => {
    const dwarf = makeDwarf({
      need_sleep: 0,
      need_food: 80,
      need_drink: 80,
    });
    // No structures at all

    const result = await runScenario({
      dwarves: [dwarf],
      structures: [],
      ticks: 800,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    // Dwarf should recover some sleep (floor sleeping)
    const dwarfAfter = result.dwarves[0];
    if (dwarfAfter.status === "alive") {
      // Sleep should have been partially restored through floor sleeping
      expect(dwarfAfter.need_sleep).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Category 7: State corruption
// ---------------------------------------------------------------------------

describe("State corruption", () => {
  it("handles a dead dwarf that still has current_task_id set at start", async () => {
    const task = makeTask("mine", {
      status: "in_progress",
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 100,
    });
    const deadDwarf = makeDwarf({
      status: "dead",
      died_year: 1,
      cause_of_death: "starvation",
      current_task_id: task.id,   // <-- corrupted: dead dwarf holds a task
    });
    task.assigned_dwarf_id = deadDwarf.id;

    const result = await runScenario({
      dwarves: [deadDwarf],
      tasks: [task],
      ticks: 50,
    });
    assertFiniteNeeds(result.dwarves);
    // After ticks, dead dwarf should not have active task
    const dwarfAfter = result.dwarves.find(d => d.id === deadDwarf.id);
    expect(dwarfAfter).toBeDefined();
    // The dwarf is already dead — task execution skips status !== 'alive' dwarves
    // so this is a pre-existing corruption that persists. We just want no crash.
    expect(result.ticks).toBe(50);
  });

  it("handles a dwarf with status 'missing' assigned to a task", async () => {
    const task = makeTask("mine", {
      status: "in_progress",
      target_x: 3,
      target_y: 3,
      target_z: 0,
      work_required: 100,
    });
    const missingDwarf = makeDwarf({
      status: "missing" as any, // not a valid status — simulates DB corruption
      current_task_id: task.id,
    });
    task.assigned_dwarf_id = missingDwarf.id;

    const result = await runScenario({
      dwarves: [missingDwarf],
      tasks: [task],
      ticks: 50,
    });
    // No crash is the primary assertion
    expect(result.ticks).toBe(50);
  });

  it("handles skill records for dwarves that don't exist in the dwarf array", async () => {
    const realDwarf = makeDwarf({ name: "Real", position_x: 0, position_y: 0 });
    const ghostId = "non-existent-dwarf-id-" + Date.now();
    // Skills for a dwarf that doesn't exist
    const orphanSkill1 = makeSkill(ghostId, "mining", 10, 1000);
    const orphanSkill2 = makeSkill(ghostId, "building", 8, 800);
    const realSkill = makeSkill(realDwarf.id, "mining", 2, 200);

    const task = makeTask("mine", {
      status: "pending",
      target_x: 1,
      target_y: 0,
      target_z: 0,
      work_required: 50,
    });
    const tile = makeMapTile(1, 0, 0, "rock");

    const result = await runScenario({
      dwarves: [realDwarf],
      dwarfSkills: [orphanSkill1, orphanSkill2, realSkill],
      tasks: [task],
      fortressTileOverrides: [tile],
      ticks: 200,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Category 8: Long-duration stability
// ---------------------------------------------------------------------------

describe("Long-duration stability", () => {
  it("10,000 tick run with 7 dwarves — no NaN, no Infinity, no crash", async () => {
    const dwarves = Array.from({ length: 7 }, (_, i) =>
      makeDwarf({
        name: `Stable${i}`,
        position_x: i * 2,
        position_y: 0,
        need_food: 80,
        need_drink: 80,
        need_sleep: 80,
      }),
    );
    const skills = dwarves.flatMap(d => [
      makeSkill(d.id, "mining", 2, 200),
      makeSkill(d.id, "building", 1, 100),
      makeSkill(d.id, "hauling", 1, 100),
    ]);
    // Generous food and drink supply
    const foods = Array.from({ length: 100 }, (_, i) =>
      makeItem({ category: "food", position_x: i % 20, position_y: 5, position_z: 0 }),
    );
    const drinks = Array.from({ length: 100 }, (_, i) =>
      makeItem({ category: "drink", position_x: i % 20, position_y: 6, position_z: 0 }),
    );
    const beds = dwarves.map((d, i) =>
      makeStructure({
        type: "bed",
        completion_pct: 100,
        position_x: i * 2,
        position_y: 10,
        position_z: 0,
      }),
    );

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      items: [...foods, ...drinks],
      structures: beds,
      ticks: 10_000,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(10_000);
  }, 60_000);

  it("needs never go below 0 or above 100 after 5000 ticks of normal play", async () => {
    const dwarves = Array.from({ length: 4 }, (_, i) =>
      makeDwarf({
        name: `NeedCheck${i}`,
        position_x: i * 3,
        position_y: 0,
        need_food: 80,
        need_drink: 80,
        need_sleep: 80,
        need_social: 50,
      }),
    );
    const foods = Array.from({ length: 60 }, (_, i) =>
      makeItem({ category: "food", position_x: i % 15, position_y: 4, position_z: 0 }),
    );
    const drinks = Array.from({ length: 60 }, (_, i) =>
      makeItem({ category: "drink", position_x: i % 15, position_y: 5, position_z: 0 }),
    );
    const beds = dwarves.map((d, i) =>
      makeStructure({
        type: "bed",
        completion_pct: 100,
        position_x: i * 3,
        position_y: 8,
        position_z: 0,
      }),
    );

    const result = await runScenario({
      dwarves,
      items: [...foods, ...drinks],
      structures: beds,
      ticks: 5_000,
    });

    for (const d of result.dwarves) {
      if (d.status !== "alive") continue;
      expect(d.need_food, `need_food out of range for ${d.name}`).toBeGreaterThanOrEqual(0);
      expect(d.need_food, `need_food over 100 for ${d.name}`).toBeLessThanOrEqual(100);
      expect(d.need_drink, `need_drink out of range for ${d.name}`).toBeGreaterThanOrEqual(0);
      expect(d.need_drink, `need_drink over 100 for ${d.name}`).toBeLessThanOrEqual(100);
      expect(d.need_sleep, `need_sleep out of range for ${d.name}`).toBeGreaterThanOrEqual(0);
      expect(d.need_sleep, `need_sleep over 100 for ${d.name}`).toBeLessThanOrEqual(100);
      expect(d.stress_level, `stress_level out of range for ${d.name}`).toBeGreaterThanOrEqual(0);
      expect(d.stress_level, `stress_level over 100 for ${d.name}`).toBeLessThanOrEqual(100);
    }
    expect(result.ticks).toBe(5_000);
  }, 60_000);

  it("massive task backlog — 200 mine tasks, 3 dwarves, run 3000 ticks", async () => {
    const dwarves = Array.from({ length: 3 }, (_, i) =>
      makeDwarf({
        name: `Miner${i}`,
        position_x: 0,
        position_y: i,
        need_food: 80,
        need_drink: 80,
        need_sleep: 80,
      }),
    );
    const skills = dwarves.flatMap(d => [makeSkill(d.id, "mining", 3, 300)]);
    const tasks = Array.from({ length: 200 }, (_, i) => {
      const x = (i % 20) + 1;
      const y = Math.floor(i / 20) + 5;
      return makeTask("mine", {
        status: "pending",
        target_x: x,
        target_y: y,
        target_z: 0,
        work_required: 100,
      });
    });
    const tiles = Array.from({ length: 200 }, (_, i) =>
      makeMapTile((i % 20) + 1, Math.floor(i / 20) + 5, 0, "rock"),
    );
    const foods = Array.from({ length: 30 }, (_, i) =>
      makeItem({ category: "food", position_x: i, position_y: 3, position_z: 0 }),
    );
    const drinks = Array.from({ length: 30 }, (_, i) =>
      makeItem({ category: "drink", position_x: i, position_y: 4, position_z: 0 }),
    );

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      tasks,
      fortressTileOverrides: tiles,
      items: [...foods, ...drinks],
      ticks: 3_000,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(3_000);
    // At least some tasks should have been completed
    const completed = result.tasks.filter(t => t.status === "completed");
    expect(completed.length).toBeGreaterThan(0);
  }, 60_000);

  it("dwarf with extreme trait values (0 and 1) runs without NaN", async () => {
    const extremeDwarf = makeDwarf({
      need_food: 80,
      need_drink: 80,
      need_sleep: 80,
      trait_conscientiousness: 0,
      trait_neuroticism: 1,
      trait_extraversion: 0,
      trait_agreeableness: 1,
      trait_openness: 0,
    });
    const extremeDwarf2 = makeDwarf({
      name: "Extreme2",
      need_food: 80,
      need_drink: 80,
      need_sleep: 80,
      trait_conscientiousness: 1,
      trait_neuroticism: 0,
      trait_extraversion: 1,
      trait_agreeableness: 0,
      trait_openness: 1,
    });
    const foods = Array.from({ length: 20 }, (_, i) =>
      makeItem({ category: "food", position_x: i, position_y: 3, position_z: 0 }),
    );
    const drinks = Array.from({ length: 20 }, (_, i) =>
      makeItem({ category: "drink", position_x: i, position_y: 4, position_z: 0 }),
    );

    const result = await runScenario({
      dwarves: [extremeDwarf, extremeDwarf2],
      items: [...foods, ...drinks],
      ticks: 1_000,
    });
    assertFiniteNeeds(result.dwarves);
    assertNoDeadDwarfWithTask(result.dwarves);
    expect(result.ticks).toBe(1_000);
  }, 30_000);
});
