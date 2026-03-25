/**
 * Aggressive fuzz runner — varied scenarios across many seeds.
 * Run with: npx tsx sim/src/__tests__/fuzz-runner.ts
 */
import { runScenario, type ScenarioConfig, type ScenarioResult } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeTask, makeItem, makeMapTile } from "./test-helpers.js";
import type { Dwarf, Task, Item, FortressTile, DwarfSkill } from "@pwarf/shared";

const TICKS = 3000;

// ─── Scenario builders ───────────────────────────────────────────────────────

function grassGrid(size: number): FortressTile[] {
  return Array.from({ length: size }, (_, x) =>
    Array.from({ length: size }, (_, y) => makeMapTile(x, y, 0, "grass")),
  ).flat();
}

/** Scenario 1: Starvation pressure — 5 dwarves, no food, must forage to survive */
function starvation(seed: number): ScenarioConfig {
  const dwarves = Array.from({ length: 5 }, (_, i) =>
    makeDwarf({ name: `Dwarf${i}`, position_x: 5 + i, position_y: 5, position_z: 0,
      need_food: 15, need_drink: 15, need_sleep: 80, need_social: 50 }),
  );
  return {
    dwarves,
    dwarfSkills: [],
    items: [], // No starting food — must forage or die
    tasks: [],
    fortressTileOverrides: grassGrid(15),
    ticks: TICKS, seed,
  };
}

/** Scenario 2: Crowded corridor — 6 dwarves in a 1-wide hallway with tasks at both ends */
function crowdedCorridor(seed: number): ScenarioConfig {
  const corridor = Array.from({ length: 20 }, (_, y) => makeMapTile(5, y, 0, "grass"));
  const dwarves = Array.from({ length: 6 }, (_, i) =>
    makeDwarf({ name: `Dwarf${i}`, position_x: 5, position_y: 3 + i, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100, need_social: 50 }),
  );
  const tasks = [
    makeTask("mine", { status: "pending", target_x: 5, target_y: 0, target_z: 0, work_required: 100, priority: 10 }),
    makeTask("mine", { status: "pending", target_x: 5, target_y: 19, target_z: 0, work_required: 100, priority: 10 }),
  ];
  // Add rock at the mine targets
  corridor.push(makeMapTile(5, 0, 0, "rock"));
  corridor.push(makeMapTile(5, 19, 0, "rock"));
  return {
    dwarves,
    dwarfSkills: dwarves.map(d => makeSkill(d.id, "mining", 2)),
    items: [],
    tasks,
    fortressTileOverrides: corridor,
    ticks: TICKS, seed,
  };
}

/** Scenario 3: Build frenzy — 1 dwarf, tons of build tasks, limited resources */
function buildFrenzy(seed: number): ScenarioConfig {
  const dwarf = makeDwarf({ name: "Builder", position_x: 7, position_y: 7, position_z: 0,
    need_food: 100, need_drink: 100, need_sleep: 100 });
  const tiles = [
    ...grassGrid(15),
    // Trees and rocks scattered
    ...[1,2,3,4].map(y => makeMapTile(1, y, 0, "tree")),
    ...[1,2,3,4,5,6].map(y => makeMapTile(13, y, 0, "rock")),
  ];
  // Override the grass tiles at tree/rock positions
  for (const t of tiles) {
    if (t.tile_type === "tree" || t.tile_type === "rock") {
      const idx = tiles.findIndex(g => g.x === t.x && g.y === t.y && g.tile_type === "grass");
      if (idx !== -1) tiles.splice(idx, 1);
    }
  }
  const tasks = [
    // Mine everything
    ...[1,2,3,4].map(y => makeTask("mine", { status: "pending", target_x: 1, target_y: y, target_z: 0, work_required: 100, priority: 10 })),
    ...[1,2,3,4,5,6].map(y => makeTask("mine", { status: "pending", target_x: 13, target_y: y, target_z: 0, work_required: 100, priority: 10 })),
    // Build structures
    makeTask("build_wall", { status: "pending", target_x: 7, target_y: 10, target_z: 0, work_required: 40, priority: 6 }),
    makeTask("build_floor", { status: "pending", target_x: 8, target_y: 10, target_z: 0, work_required: 25, priority: 6 }),
    makeTask("build_door", { status: "pending", target_x: 7, target_y: 11, target_z: 0, work_required: 35, priority: 6 }),
    makeTask("build_well", { status: "pending", target_x: 8, target_y: 11, target_z: 0, work_required: 60, priority: 5 }),
    makeTask("build_mushroom_garden", { status: "pending", target_x: 7, target_y: 12, target_z: 0, work_required: 50, priority: 5 }),
    makeTask("build_bed", { status: "pending", target_x: 8, target_y: 12, target_z: 0, work_required: 30, priority: 5 }),
    // Deconstruct after building
    makeTask("deconstruct", { status: "pending", target_x: 7, target_y: 10, target_z: 0, work_required: 30, priority: 2 }),
    makeTask("deconstruct", { status: "pending", target_x: 8, target_y: 10, target_z: 0, work_required: 30, priority: 2 }),
  ];
  return {
    dwarves: [dwarf],
    dwarfSkills: [makeSkill(dwarf.id, "mining", 3), makeSkill(dwarf.id, "building", 3)],
    items: [],
    tasks,
    fortressTileOverrides: tiles,
    ticks: TICKS, seed,
  };
}

/** Scenario 4: Sleep deprivation — dwarves with zero sleep, must find/build beds */
function sleepDeprived(seed: number): ScenarioConfig {
  const dwarves = Array.from({ length: 3 }, (_, i) =>
    makeDwarf({ name: `Zombie${i}`, position_x: 5 + i, position_y: 5, position_z: 0,
      need_food: 80, need_drink: 80, need_sleep: 3, need_social: 50 }),
  );
  const items = [
    makeItem({ name: "Wood log", category: "raw_material", material: "wood", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
    makeItem({ name: "Wood log", category: "raw_material", material: "wood", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
    makeItem({ name: "Wood log", category: "raw_material", material: "wood", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
  ];
  const tasks = [
    makeTask("build_bed", { status: "pending", target_x: 5, target_y: 8, target_z: 0, work_required: 30, priority: 10 }),
    makeTask("build_bed", { status: "pending", target_x: 6, target_y: 8, target_z: 0, work_required: 30, priority: 10 }),
    makeTask("build_bed", { status: "pending", target_x: 7, target_y: 8, target_z: 0, work_required: 30, priority: 10 }),
  ];
  return {
    dwarves,
    dwarfSkills: dwarves.map(d => makeSkill(d.id, "building", 2)),
    items,
    tasks,
    fortressTileOverrides: grassGrid(12),
    ticks: TICKS, seed,
  };
}

/** Scenario 5: Many dwarves fighting over few resources */
function resourceContention(seed: number): ScenarioConfig {
  const dwarves = Array.from({ length: 7 }, (_, i) =>
    makeDwarf({ name: `Worker${i}`, position_x: 5 + (i % 3), position_y: 5 + Math.floor(i / 3), position_z: 0,
      need_food: 60, need_drink: 60, need_sleep: 80, need_social: 50 }),
  );
  // Only 2 food items for 7 dwarves
  const items = [
    makeItem({ name: "Plump helmet", category: "food", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
    makeItem({ name: "Plump helmet", category: "food", position_x: 6, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
    makeItem({ name: "Plump helmet brew", category: "drink", material: "plant", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
    makeItem({ name: "Plump helmet brew", category: "drink", material: "plant", position_x: 6, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
  ];
  // All 7 dwarves competing for 2 mine tasks
  const tiles = [
    ...grassGrid(15),
    makeMapTile(2, 5, 0, "rock"),
    makeMapTile(12, 5, 0, "rock"),
  ];
  const tasks = [
    makeTask("mine", { status: "pending", target_x: 2, target_y: 5, target_z: 0, work_required: 100, priority: 10 }),
    makeTask("mine", { status: "pending", target_x: 12, target_y: 5, target_z: 0, work_required: 100, priority: 10 }),
  ];
  return {
    dwarves,
    dwarfSkills: dwarves.map(d => makeSkill(d.id, "mining", 1)),
    items,
    tasks,
    fortressTileOverrides: tiles,
    ticks: TICKS, seed,
  };
}

/** Scenario 6: Empty world — no tasks, no items, just dwarves idle */
function emptyWorld(seed: number): ScenarioConfig {
  const dwarves = Array.from({ length: 3 }, (_, i) =>
    makeDwarf({ name: `Idle${i}`, position_x: 5 + i, position_y: 5, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100, need_social: 50 }),
  );
  return {
    dwarves,
    dwarfSkills: [],
    items: [],
    tasks: [],
    fortressTileOverrides: grassGrid(10),
    ticks: TICKS, seed,
  };
}

// ─── Invariant checks ────────────────────────────────────────────────────────

function checkInvariants(label: string, result: ScenarioResult, config: ScenarioConfig): string[] {
  const errors: string[] = [];

  // Dwarf state invariants
  for (const d of result.dwarves) {
    if (d.status !== "alive") continue;
    if (d.need_food < 0 || d.need_food > 100) errors.push(`${label}: ${d.name} food=${d.need_food.toFixed(1)} out of [0,100]`);
    if (d.need_drink < 0 || d.need_drink > 100) errors.push(`${label}: ${d.name} drink=${d.need_drink.toFixed(1)} out of [0,100]`);
    if (d.need_sleep < 0 || d.need_sleep > 100) errors.push(`${label}: ${d.name} sleep=${d.need_sleep.toFixed(1)} out of [0,100]`);
    if (d.stress_level < 0) errors.push(`${label}: ${d.name} stress=${d.stress_level.toFixed(1)} negative`);
    if (d.health < 0 || d.health > 100) errors.push(`${label}: ${d.name} health=${d.health} out of [0,100]`);

    // A living dwarf with current_task_id should have a matching task
    if (d.current_task_id) {
      const task = result.tasks.find(t => t.id === d.current_task_id);
      if (!task) errors.push(`${label}: ${d.name} has current_task_id=${d.current_task_id.slice(0,8)} but task not found`);
      else if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
        errors.push(`${label}: ${d.name} assigned to ${task.task_type} which is ${task.status}`);
      }
    }
  }

  // Task state invariants
  for (const t of result.tasks) {
    if (t.work_progress < 0) errors.push(`${label}: task ${t.task_type}@(${t.target_x},${t.target_y}) has negative progress=${t.work_progress}`);
    if (t.work_progress > t.work_required * 1.5) errors.push(`${label}: task ${t.task_type} progress=${t.work_progress.toFixed(1)} >> required=${t.work_required} (overshoot)`);

    // Claimed/in_progress tasks should have an assigned dwarf
    if ((t.status === "claimed" || t.status === "in_progress") && !t.assigned_dwarf_id) {
      errors.push(`${label}: task ${t.task_type} is ${t.status} but has no assigned_dwarf_id`);
    }

    // Completed tasks should not have negative progress
    if (t.status === "completed" && t.work_progress < t.work_required * 0.9) {
      errors.push(`${label}: task ${t.task_type} completed but progress=${t.work_progress.toFixed(1)} < required=${t.work_required}`);
    }
  }

  // No duplicate IDs
  const taskIds = result.tasks.map(t => t.id);
  if (new Set(taskIds).size !== taskIds.length) errors.push(`${label}: duplicate task IDs`);
  const itemIds = result.items.map(i => i.id);
  if (new Set(itemIds).size !== itemIds.length) errors.push(`${label}: duplicate item IDs`);

  // Items should have valid fields
  for (const item of result.items) {
    if (!item.name) errors.push(`${label}: item with empty name`);
    if (!item.category) errors.push(`${label}: item ${item.name} has empty category`);
  }

  // Bounded growth check
  if (result.tasks.length > 2000) errors.push(`${label}: ${result.tasks.length} tasks — possible unbounded growth`);
  if (result.items.length > 500) errors.push(`${label}: ${result.items.length} items — possible unbounded growth`);

  return errors;
}

// ─── Runner ──────────────────────────────────────────────────────────────────

const scenarios: [string, (seed: number) => ScenarioConfig][] = [
  ["starvation", starvation],
  ["corridor", crowdedCorridor],
  ["buildFrenzy", buildFrenzy],
  ["sleepDeprived", sleepDeprived],
  ["contention", resourceContention],
  ["emptyWorld", emptyWorld],
];

async function run() {
  const SEEDS_PER_SCENARIO = 20;
  const failures: string[] = [];
  const startAll = Date.now();
  let totalTicks = 0;

  for (const [name, builder] of scenarios) {
    process.stdout.write(`\n${name}: `);
    for (let seed = 1; seed <= SEEDS_PER_SCENARIO; seed++) {
      const config = builder(seed);
      try {
        const result = await runScenario(config);
        totalTicks += config.ticks;
        const errs = checkInvariants(`${name}/seed${seed}`, result, config);
        if (errs.length > 0) {
          failures.push(...errs);
          process.stdout.write("!");
        } else {
          process.stdout.write(".");
        }
      } catch (err) {
        failures.push(`${name}/seed${seed}: CRASH — ${err}`);
        process.stdout.write("X");
      }
    }
  }

  const elapsed = Date.now() - startAll;
  console.log(`\n\n${scenarios.length} scenarios × ${SEEDS_PER_SCENARIO} seeds × ${TICKS} ticks = ${totalTicks} total ticks in ${(elapsed / 1000).toFixed(1)}s`);

  if (failures.length === 0) {
    console.log(`\n✅ All passed — zero invariant violations`);
  } else {
    console.log(`\n❌ ${failures.length} failure(s):`);
    for (const f of failures) console.log(`  ${f}`);
    process.exit(1);
  }
}

run().catch(console.error);
