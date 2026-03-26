import { describe, it, expect } from "vitest";
import { runScenario } from "./run-scenario.js";
import { makeDwarf, makeSkill, makeTask, makeMapTile, makeItem } from "./__tests__/test-helpers.js";

function stoneBlock() {
  return makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "test-civ", held_by_dwarf_id: null });
}
function woodLog() {
  return makeItem({ name: "Wood log", category: "raw_material", material: "wood", located_in_civ_id: "test-civ", held_by_dwarf_id: null });
}
import {
  FOOD_DECAY_PER_TICK,
  NEED_INTERRUPT_FOOD,
  WORK_BUILD_WALL,
  WORK_BUILD_FLOOR,
  WORK_BUILD_BED,
  WORK_BUILD_WELL,
  WORK_BUILD_MUSHROOM_GARDEN,
  WORK_BUILD_DOOR,
  WORK_MINE_BASE,
} from "@pwarf/shared";

describe("runScenario", () => {
  it("returns correct tick and year counts", async () => {
    const dwarf = makeDwarf();
    const result = await runScenario({ dwarves: [dwarf], ticks: 10 });
    expect(result.ticks).toBe(10);
    expect(result.year).toBe(1);
  });

  it("advances year after stepsPerYear ticks", async () => {
    const result = await runScenario({ dwarves: [makeDwarf()], ticks: 200, stepsPerYear: 200, stepsPerDay: 10 });
    expect(result.year).toBe(2);
  });

  it("need_food decays each tick until eat task fires", async () => {
    // Start with high needs — food decays at FOOD_DECAY_PER_TICK per tick
    // It should drop until it hits NEED_INTERRUPT_FOOD, then eat tasks kick in
    const dwarf = makeDwarf({ need_food: 100, need_drink: 100, need_sleep: 100 });
    const ticks = Math.ceil((100 - NEED_INTERRUPT_FOOD) / FOOD_DECAY_PER_TICK) - 1;
    const result = await runScenario({ dwarves: [dwarf], ticks, seed: 1 });
    // After enough ticks, food should have decayed from 100
    expect(result.dwarves[0].need_food).toBeLessThan(100);
    expect(result.dwarves[0].need_food).toBeGreaterThanOrEqual(0);
  });

  it("dead dwarves are included in the result", async () => {
    // A dwarf already marked dead should remain dead through the run
    const dead = makeDwarf({ status: "dead", cause_of_death: "starvation" });
    const result = await runScenario({ dwarves: [dead], ticks: 5 });
    expect(result.dwarves).toHaveLength(1);
    expect(result.dwarves[0].status).toBe("dead");
  });

  it("runs deterministically with same seed", async () => {
    const dwarf = makeDwarf();
    const a = await runScenario({ dwarves: [dwarf], ticks: 100, seed: 42 });
    const b = await runScenario({ dwarves: [makeDwarf({ ...dwarf })], ticks: 100, seed: 42 });
    expect(a.dwarves[0].position_x).toBe(b.dwarves[0].position_x);
    expect(a.dwarves[0].position_y).toBe(b.dwarves[0].position_y);
    expect(a.dwarves[0].need_food).toBe(b.dwarves[0].need_food);
    expect(a.dwarves[0].stress_level).toBe(b.dwarves[0].stress_level);
  });

  it("does not mutate caller's input dwarves", async () => {
    const dwarf = makeDwarf({ need_food: 100 });
    const originalFood = dwarf.need_food;
    await runScenario({ dwarves: [dwarf], ticks: 50, seed: 1 });
    // Input object should be unchanged after the run
    expect(dwarf.need_food).toBe(originalFood);
  });

  it("same seed produces identical results (deterministic)", async () => {
    const makeBase = () => makeDwarf({ position_x: 100, position_y: 100 });
    const a = await runScenario({ dwarves: [makeBase()], ticks: 200, seed: 42 });
    const b = await runScenario({ dwarves: [makeBase()], ticks: 200, seed: 42 });
    expect(a.dwarves[0].need_food).toBe(b.dwarves[0].need_food);
    expect(a.dwarves[0].need_drink).toBe(b.dwarves[0].need_drink);
    expect(a.dwarves[0].position_x).toBe(b.dwarves[0].position_x);
    expect(a.dwarves[0].position_y).toBe(b.dwarves[0].position_y);
  });
});

describe("building tasks", () => {
  // Dwarf starting position — all adjacent/nearby tiles are open_air (no deriver fallback returns open_air)
  const DX = 10;
  const DY = 10;
  const DZ = 0;

  it("build_wall completes and changes tile to constructed_wall", async () => {
    const dwarf = makeDwarf({ position_x: DX, position_y: DY, position_z: DZ });
    const skill = makeSkill(dwarf.id, 'building');
    // Target at (DX, DY+1) — adjacent to dwarf, so no movement needed
    const task = makeTask('build_wall', {
      status: 'pending',
      assigned_dwarf_id: null,
      target_x: DX,
      target_y: DY + 1,
      target_z: DZ,
      work_required: WORK_BUILD_WALL,
      work_progress: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      items: [stoneBlock()],
      ticks: WORK_BUILD_WALL + 20,
      seed: 1,
    });

    const builtTile = result.fortressTileOverrides.find(
      t => t.x === DX && t.y === DY + 1 && t.z === DZ,
    );
    expect(builtTile).toBeDefined();
    expect(builtTile?.tile_type).toBe('constructed_wall');

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe('completed');
  });

  it("build_floor completes and changes tile to constructed_floor", async () => {
    const dwarf = makeDwarf({ position_x: DX, position_y: DY, position_z: DZ });
    const skill = makeSkill(dwarf.id, 'building');
    // Target 3 steps away — dwarf must walk there first (not adjacent task type)
    const task = makeTask('build_floor', {
      status: 'pending',
      assigned_dwarf_id: null,
      target_x: DX + 3,
      target_y: DY,
      target_z: DZ,
      work_required: WORK_BUILD_FLOOR,
      work_progress: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      items: [stoneBlock()],
      ticks: WORK_BUILD_FLOOR + 20,
      seed: 1,
    });

    const builtTile = result.fortressTileOverrides.find(
      t => t.x === DX + 3 && t.y === DY && t.z === DZ,
    );
    expect(builtTile).toBeDefined();
    expect(builtTile?.tile_type).toBe('constructed_floor');
  });

  it("build_bed completes and creates a bed structure", async () => {
    const dwarf = makeDwarf({ position_x: DX, position_y: DY, position_z: DZ });
    const skill = makeSkill(dwarf.id, 'building');
    const task = makeTask('build_bed', {
      status: 'pending',
      assigned_dwarf_id: null,
      target_x: DX + 2,
      target_y: DY,
      target_z: DZ,
      work_required: WORK_BUILD_BED,
      work_progress: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      items: [woodLog()],
      ticks: WORK_BUILD_BED + 20,
      seed: 1,
    });

    const bed = result.structures.find(
      s => s.type === 'bed' && s.position_x === DX + 2 && s.position_y === DY,
    );
    expect(bed).toBeDefined();
    expect(bed?.completion_pct).toBe(100);

    const builtTile = result.fortressTileOverrides.find(
      t => t.x === DX + 2 && t.y === DY && t.z === DZ,
    );
    expect(builtTile?.tile_type).toBe('bed');
  });

  it("build_well completes and creates a well structure", async () => {
    const dwarf = makeDwarf({ position_x: DX, position_y: DY, position_z: DZ });
    const skill = makeSkill(dwarf.id, 'building');
    const task = makeTask('build_well', {
      status: 'pending',
      assigned_dwarf_id: null,
      target_x: DX + 2,
      target_y: DY,
      target_z: DZ,
      work_required: WORK_BUILD_WELL,
      work_progress: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      items: [stoneBlock(), stoneBlock()],
      ticks: WORK_BUILD_WELL + 20,
      seed: 1,
    });

    const well = result.structures.find(
      s => s.type === 'well' && s.position_x === DX + 2 && s.position_y === DY,
    );
    expect(well).toBeDefined();
  });

  it("build_mushroom_garden completes and creates a mushroom_garden structure", async () => {
    const dwarf = makeDwarf({ position_x: DX, position_y: DY, position_z: DZ });
    const skill = makeSkill(dwarf.id, 'building');
    const task = makeTask('build_mushroom_garden', {
      status: 'pending',
      assigned_dwarf_id: null,
      target_x: DX + 2,
      target_y: DY,
      target_z: DZ,
      work_required: WORK_BUILD_MUSHROOM_GARDEN,
      work_progress: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      items: [woodLog()],
      ticks: WORK_BUILD_MUSHROOM_GARDEN + 20,
      seed: 1,
    });

    const garden = result.structures.find(
      s => s.type === 'mushroom_garden' && s.position_x === DX + 2 && s.position_y === DY,
    );
    expect(garden).toBeDefined();
  });

  it("build_door completes and creates a door structure and tile", async () => {
    const dwarf = makeDwarf({ position_x: DX, position_y: DY, position_z: DZ });
    const skill = makeSkill(dwarf.id, 'building');
    const task = makeTask('build_door', {
      status: 'pending',
      assigned_dwarf_id: null,
      target_x: DX + 2,
      target_y: DY,
      target_z: DZ,
      work_required: WORK_BUILD_DOOR,
      work_progress: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      items: [woodLog()],
      ticks: WORK_BUILD_DOOR + 20,
      seed: 1,
    });

    const door = result.structures.find(
      s => s.type === 'door' && s.position_x === DX + 2 && s.position_y === DY,
    );
    expect(door).toBeDefined();

    const doorTile = result.fortressTileOverrides.find(
      t => t.x === DX + 2 && t.y === DY && t.tile_type === 'door',
    );
    expect(doorTile).toBeDefined();
  });

  it("mine task completes and changes tile to open_air, creates stone item", async () => {
    const dwarf = makeDwarf({ position_x: DX, position_y: DY, position_z: DZ });
    const skill = makeSkill(dwarf.id, 'mining');
    // Place a stone tile adjacent to the dwarf
    const stoneTile = makeMapTile(DX, DY + 1, DZ, 'stone');
    const task = makeTask('mine', {
      status: 'pending',
      assigned_dwarf_id: null,
      target_x: DX,
      target_y: DY + 1,
      target_z: DZ,
      work_required: WORK_MINE_BASE,
      work_progress: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [stoneTile],
      ticks: WORK_MINE_BASE + 20,
      seed: 1,
    });

    const minedTile = result.fortressTileOverrides.find(
      t => t.x === DX && t.y === DY + 1 && t.z === DZ,
    );
    expect(minedTile?.tile_type).toBe('grass'); // z=0 surface mine → grass
    expect(minedTile?.is_mined).toBe(true);

    const stoneItem = result.items.find(i => i.name === 'Stone block');
    expect(stoneItem).toBeDefined();
  });

  it("dwarf without skill can still claim and complete build task", async () => {
    // No building skill — but any dwarf can do any task
    const dwarf = makeDwarf({ position_x: DX, position_y: DY, position_z: DZ });
    const task = makeTask('build_wall', {
      status: 'pending',
      assigned_dwarf_id: null,
      target_x: DX,
      target_y: DY + 1,
      target_z: DZ,
      work_required: WORK_BUILD_WALL,
      work_progress: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [], // no skills — still works
      tasks: [task],
      items: [stoneBlock()],
      ticks: WORK_BUILD_WALL + 10,
      seed: 1,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe('completed');
  });
});
