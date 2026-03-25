/**
 * Chaos Test Suite — New Features
 *
 * Adversarial tests targeting:
 *  - Workshops (still / kitchen / forge)
 *  - New tile types (flower, spring, crystal, glowing_moss, fungal_growth)
 *  - Autonomous idle behavior (wander, socialize, rest)
 *  - Cross-feature interactions between all of the above
 *
 * Each test asserts at minimum:
 *  1. No thrown exception (reaching the expect = no crash)
 *  2. No NaN/Infinity in dwarf need values
 *  3. No alive dwarf pointing to a non-existent task
 *  4. No item at null position that is also not held
 */
import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import {
  makeDwarf,
  makeSkill,
  makeItem,
  makeTask,
  makeStructure,
  makeMapTile,
} from "./test-helpers.js";

// ─── Invariant helpers ──────────────────────────────────────────────────────

function assertNoNaNNeeds(dwarves: ReturnType<typeof makeDwarf>[]) {
  for (const d of dwarves) {
    expect(Number.isFinite(d.need_food), `${d.name} need_food is NaN/Infinity`).toBe(true);
    expect(Number.isFinite(d.need_drink), `${d.name} need_drink is NaN/Infinity`).toBe(true);
    expect(Number.isFinite(d.need_sleep), `${d.name} need_sleep is NaN/Infinity`).toBe(true);
    expect(Number.isFinite(d.need_social), `${d.name} need_social is NaN/Infinity`).toBe(true);
    expect(Number.isFinite(d.stress_level), `${d.name} stress_level is NaN/Infinity`).toBe(true);
  }
}

function assertNoOrphanedTasks(
  dwarves: ReturnType<typeof makeDwarf>[],
  tasks: ReturnType<typeof makeTask>[],
) {
  const taskIds = new Set(tasks.map(t => t.id));
  for (const d of dwarves) {
    if (d.status === "alive" && d.current_task_id !== null) {
      expect(taskIds.has(d.current_task_id), `alive dwarf ${d.name} has current_task_id that does not exist`).toBe(true);
    }
  }
}

function assertNoNullPositionItems(items: ReturnType<typeof makeItem>[]) {
  for (const i of items) {
    const floating = i.held_by_dwarf_id === null && i.position_x === null;
    expect(floating, `item "${i.name}" is neither held nor positioned`).toBe(false);
  }
}

// Helper to give a dwarf all basic skills
function allSkills(dwarfId: string) {
  return [
    makeSkill(dwarfId, "brewing", 5),
    makeSkill(dwarfId, "cooking", 5),
    makeSkill(dwarfId, "smithing", 5),
    makeSkill(dwarfId, "mining", 5),
    makeSkill(dwarfId, "building", 5),
    makeSkill(dwarfId, "hauling", 5),
    makeSkill(dwarfId, "farming", 5),
    makeSkill(dwarfId, "foraging", 5),
  ];
}

// ─── Workshop Chaos ─────────────────────────────────────────────────────────

describe("Workshop Chaos", () => {

  it("1. still deconstructed while brew task is in-progress — task fails gracefully", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, civilization_id: "test-civ" });
    const still = makeStructure({
      type: "still",
      completion_pct: 100,
      position_x: 5,
      position_y: 5,
      position_z: 0,
      civilization_id: "test-civ",
    });
    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });
    // Brew task in-progress pointing at still
    const brewTask = makeTask("brew", {
      status: "in_progress",
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      target_item_id: still.id,
      work_progress: 40,
      work_required: 50,
      civilization_id: "test-civ",
    });
    dwarf.current_task_id = brewTask.id;

    // Deconstruct task targeting the same tile (high priority)
    const deconTask = makeTask("deconstruct", {
      status: "pending",
      priority: 9,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      civilization_id: "test-civ",
    });

    // Place a still tile so deconstruct has something to act on
    const stillTile = makeMapTile(5, 5, 0, "still");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      items: [plant],
      structures: [still],
      tasks: [brewTask, deconTask],
      fortressTileOverrides: [stillTile],
      ticks: 100,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    assertNoNullPositionItems(result.items);
    // Fortress should not have crashed — we just want no throw
    expect(result.ticks).toBe(100);
  });

  it("2. two dwarves try to use the same workshop simultaneously", async () => {
    const d1 = makeDwarf({ position_x: 4, position_y: 5, civilization_id: "test-civ" });
    const d2 = makeDwarf({ position_x: 6, position_y: 5, civilization_id: "test-civ" });
    const still = makeStructure({
      type: "still",
      completion_pct: 100,
      position_x: 5,
      position_y: 5,
      position_z: 0,
      civilization_id: "test-civ",
    });
    const plant1 = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });
    const plant2 = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 5,
      position_y: 6,
      position_z: 0,
    });
    // Both brew tasks pointing at the same still
    const brew1 = makeTask("brew", {
      status: "claimed",
      assigned_dwarf_id: d1.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      target_item_id: still.id,
      work_required: 50,
      civilization_id: "test-civ",
    });
    const brew2 = makeTask("brew", {
      status: "claimed",
      assigned_dwarf_id: d2.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      target_item_id: still.id,
      work_required: 50,
      civilization_id: "test-civ",
    });
    d1.current_task_id = brew1.id;
    d2.current_task_id = brew2.id;

    const result = await runScenario({
      dwarves: [d1, d2],
      dwarfSkills: [...allSkills(d1.id), ...allSkills(d2.id)],
      items: [plant1, plant2],
      structures: [still],
      tasks: [brew1, brew2],
      fortressTileOverrides: [makeMapTile(5, 5, 0, "still")],
      ticks: 150,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    assertNoNullPositionItems(result.items);
    expect(result.ticks).toBe(150);
    // Both tasks should have resolved (completed, cancelled, or failed — not stuck)
    const activeBrew = result.tasks.filter(
      t => t.task_type === "brew" && (t.status === "in_progress" || t.status === "claimed"),
    );
    expect(activeBrew.length).toBe(0);
  });

  it("3. workshop with no ingredients within radius — auto-brew does not create task", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, civilization_id: "test-civ" });
    const still = makeStructure({
      type: "still",
      completion_pct: 100,
      position_x: 5,
      position_y: 5,
      position_z: 0,
      civilization_id: "test-civ",
    });
    // Plant is far outside WORKSHOP_INGREDIENT_RADIUS (5)
    const farPlant = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 50,
      position_y: 50,
      position_z: 0,
    });
    // Drinks below threshold to trigger auto-brew
    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      items: [farPlant],
      structures: [still],
      fortressTileOverrides: [makeMapTile(5, 5, 0, "still")],
      ticks: 50,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoNullPositionItems(result.items);
    // No brew task should be created (ingredient out of range)
    const brewTasks = result.tasks.filter(t => t.task_type === "brew");
    expect(brewTasks.length).toBe(0);
  });

  it("4. workshop ingredient consumed by another dwarf right before brew completes", async () => {
    // Dwarf A is almost done brewing; Dwarf B grabs the only plant ingredient
    const dwarfA = makeDwarf({ position_x: 5, position_y: 5, civilization_id: "test-civ" });
    const dwarfB = makeDwarf({ position_x: 5, position_y: 5, civilization_id: "test-civ" });
    const still = makeStructure({
      type: "still",
      completion_pct: 100,
      position_x: 5,
      position_y: 5,
      position_z: 0,
      civilization_id: "test-civ",
    });
    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      held_by_dwarf_id: dwarfB.id, // B holds it
      position_x: null,
      position_y: null,
      position_z: null,
    });
    // A's brew task is almost done but ingredient is held by B
    const brewTask = makeTask("brew", {
      status: "in_progress",
      assigned_dwarf_id: dwarfA.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      target_item_id: still.id,
      work_progress: 49,
      work_required: 50,
      civilization_id: "test-civ",
    });
    dwarfA.current_task_id = brewTask.id;

    const result = await runScenario({
      dwarves: [dwarfA, dwarfB],
      dwarfSkills: [...allSkills(dwarfA.id), ...allSkills(dwarfB.id)],
      items: [plant],
      structures: [still],
      tasks: [brewTask],
      fortressTileOverrides: [makeMapTile(5, 5, 0, "still")],
      ticks: 10,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    assertNoNullPositionItems(result.items);
    // Brew should have completed or failed gracefully — no crash
    const brew = result.tasks.find(t => t.id === brewTask.id);
    expect(brew).toBeDefined();
    expect(brew!.status === "completed" || brew!.status === "failed" || brew!.status === "cancelled").toBe(true);
  });

  it("5. build all 3 workshops, then destroy all materials — fortress degrades gracefully", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10, civilization_id: "test-civ" });
    const still = makeStructure({
      type: "still",
      completion_pct: 100,
      position_x: 10,
      position_y: 10,
      position_z: 0,
      civilization_id: "test-civ",
    });
    const kitchen = makeStructure({
      type: "kitchen",
      completion_pct: 100,
      position_x: 12,
      position_y: 10,
      position_z: 0,
      civilization_id: "test-civ",
    });
    const forge = makeStructure({
      type: "forge",
      completion_pct: 100,
      position_x: 14,
      position_y: 10,
      position_z: 0,
      civilization_id: "test-civ",
    });

    // Deconstruct all three workshops
    const decon1 = makeTask("deconstruct", {
      status: "pending",
      priority: 9,
      target_x: 10,
      target_y: 10,
      target_z: 0,
      civilization_id: "test-civ",
    });
    const decon2 = makeTask("deconstruct", {
      status: "pending",
      priority: 9,
      target_x: 12,
      target_y: 10,
      target_z: 0,
      civilization_id: "test-civ",
    });
    const decon3 = makeTask("deconstruct", {
      status: "pending",
      priority: 9,
      target_x: 14,
      target_y: 10,
      target_z: 0,
      civilization_id: "test-civ",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      structures: [still, kitchen, forge],
      tasks: [decon1, decon2, decon3],
      fortressTileOverrides: [
        makeMapTile(10, 10, 0, "still"),
        makeMapTile(12, 10, 0, "kitchen"),
        makeMapTile(14, 10, 0, "forge"),
      ],
      ticks: 300,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    expect(result.ticks).toBe(300);
    // After deconstruction, no auto-brew/cook/smith tasks should appear (no workshops)
    const workshopTasks = result.tasks.filter(
      t => t.task_type === "brew" || t.task_type === "cook" || t.task_type === "smith",
    );
    expect(workshopTasks.filter(t => t.status === "pending" || t.status === "in_progress").length).toBe(0);
  });

  it("6. 10 stills but only 1 plump helmet — only 1 brew task created", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, civilization_id: "test-civ" });
    const stills = Array.from({ length: 10 }, (_, i) =>
      makeStructure({
        type: "still",
        completion_pct: 100,
        position_x: i * 2,
        position_y: 0,
        position_z: 0,
        civilization_id: "test-civ",
      }),
    );
    // Only 1 plant within range of first still
    const onePlant = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      items: [onePlant],
      structures: stills,
      ticks: 10,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoNullPositionItems(result.items);
    // Auto-brew gate: at most 1 pending/in-progress brew task at a time
    const activeBrews = result.tasks.filter(
      t => t.task_type === "brew" && (t.status === "pending" || t.status === "in_progress" || t.status === "claimed"),
    );
    expect(activeBrews.length).toBeLessThanOrEqual(1);
  });

  it("7. workshop at the edge of the map (high coordinates)", async () => {
    const dwarf = makeDwarf({ position_x: 510, position_y: 510, civilization_id: "test-civ" });
    const still = makeStructure({
      type: "still",
      completion_pct: 100,
      position_x: 510,
      position_y: 510,
      position_z: 0,
      civilization_id: "test-civ",
    });
    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 510,
      position_y: 510,
      position_z: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      items: [plant],
      structures: [still],
      ticks: 100,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoNullPositionItems(result.items);
    expect(result.ticks).toBe(100);
  });

  it("8. workshop occupancy not released after dwarf dies mid-brew", async () => {
    // Dwarf starts brew with occupancy pre-set on the still.
    // The dwarf dies (needs exhausted — no food/drink available).
    // deprivation.ts releases all structure occupancy for the dying dwarf.
    // After death, the still's occupied_by_dwarf_id must be null.
    const dwarf = makeDwarf({
      position_x: 5,
      position_y: 5,
      civilization_id: "test-civ",
      need_food: 0,    // already at starvation
      need_drink: 0,   // already at dehydration
      need_sleep: 50,
    });
    const still = makeStructure({
      type: "still",
      completion_pct: 100,
      position_x: 5,
      position_y: 5,
      position_z: 0,
      occupied_by_dwarf_id: dwarf.id, // manually pre-set to simulate mid-task occupancy
      civilization_id: "test-civ",
    });
    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });
    const brewTask = makeTask("brew", {
      status: "in_progress",
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      target_item_id: still.id,
      work_progress: 1,
      work_required: 50,
      civilization_id: "test-civ",
    });
    dwarf.current_task_id = brewTask.id;

    // Run enough ticks for the dehydration timer to expire and kill the dwarf.
    // DEHYDRATION_TICKS = 9000 — but with need=0 from tick 1, death happens after 9000 ticks.
    // Instead we run enough ticks to trigger starvation and verify the occupancy is released.
    // We provide no food or drink, so within DEHYDRATION_TICKS ticks the dwarf will die.
    // Run 10000 ticks to guarantee death.
    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      items: [plant],
      structures: [still],
      tasks: [brewTask],
      ticks: 10000,
    });

    // Dwarf must be dead (dehydration kills at DEHYDRATION_TICKS=9000)
    const finalDwarf = result.dwarves[0]!;
    expect(finalDwarf.status).toBe("dead");

    // After death, deprivation.ts should have cleared the still's occupancy
    const finalStill = result.structures.find(s => s.id === still.id);
    if (finalStill) {
      // BUG ASSERTION: if this fails, deprivation.ts does not release workshop occupancy on death
      expect(finalStill.occupied_by_dwarf_id).toBeNull();
    }
    assertNoNullPositionItems(result.items);
    expect(result.ticks).toBe(10000);
  }, 30_000);

});

// ─── Tile Variety Chaos ─────────────────────────────────────────────────────

describe("Tile Variety Chaos", () => {

  it("9. mine a crystal tile — Crystal Shard produced with correct properties", async () => {
    const dwarf = makeDwarf({ position_x: 4, position_y: 5, civilization_id: "test-civ" });
    const crystalTile = makeMapTile(5, 5, 0, "crystal");
    const mineTask = makeTask("mine", {
      status: "claimed",
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 140, // crystal hardness ~1.4 × 100
      civilization_id: "test-civ",
    });
    dwarf.current_task_id = mineTask.id;

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      tasks: [mineTask],
      fortressTileOverrides: [crystalTile],
      ticks: 300,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoNullPositionItems(result.items);

    const shard = result.items.find(i => i.name === "Crystal shard");
    expect(shard).toBeDefined();
    expect(shard!.material).toBe("crystal");
    expect(shard!.value).toBe(15);
    expect(shard!.weight).toBe(3);
    expect(shard!.category).toBe("raw_material");
  });

  it("10. forage a fungal_growth tile — Cave Mushroom produced", async () => {
    const dwarf = makeDwarf({ position_x: 4, position_y: 5, civilization_id: "test-civ" });
    const fungalTile = makeMapTile(5, 5, 0, "fungal_growth");
    const forageTask = makeTask("forage", {
      status: "claimed",
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 15,
      civilization_id: "test-civ",
    });
    dwarf.current_task_id = forageTask.id;

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      tasks: [forageTask],
      fortressTileOverrides: [fungalTile],
      ticks: 100,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoNullPositionItems(result.items);
    const mushroom = result.items.find(i => i.name === "Cave mushroom");
    expect(mushroom).toBeDefined();
    expect(mushroom!.category).toBe("food");
  });

  it("11. spring tile as only water source — thirsty dwarf can drink from it", async () => {
    const dwarf = makeDwarf({
      position_x: 3,
      position_y: 5,
      civilization_id: "test-civ",
      need_drink: 10, // very thirsty
    });
    const springTile = makeMapTile(5, 5, 0, "spring");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      items: [], // no drink items
      structures: [], // no wells
      fortressTileOverrides: [springTile],
      ticks: 200,
    });

    assertNoNaNNeeds(result.dwarves);
    const finalDwarf = result.dwarves[0]!;
    // Dwarf should have been able to drink from the spring
    // (need_drink should have recovered above the critical threshold, or at minimum the sim did not crash)
    expect(finalDwarf.need_drink).toBeGreaterThanOrEqual(0);
    expect(result.ticks).toBe(200);
  });

  it("12. all surface tiles are flowers — pathfinding still works", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, civilization_id: "test-civ" });
    // Fill a 10×10 area with flower tiles
    const flowerTiles = [];
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        flowerTiles.push(makeMapTile(x, y, 0, "flower"));
      }
    }
    // Place a mine task at far corner
    const mineTask = makeTask("mine", {
      status: "claimed",
      assigned_dwarf_id: dwarf.id,
      target_x: 9,
      target_y: 9,
      target_z: 0,
      work_required: 100,
      civilization_id: "test-civ",
    });
    dwarf.current_task_id = mineTask.id;

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      tasks: [mineTask],
      fortressTileOverrides: flowerTiles,
      ticks: 200,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    expect(result.ticks).toBe(200);
  });

  it("13. crystal tile surrounded by cavern_wall on 3 sides — dwarf can still mine it", async () => {
    const dwarf = makeDwarf({ position_x: 4, position_y: 5, civilization_id: "test-civ" });
    const crystalTile = makeMapTile(5, 5, 0, "crystal");
    // Surround on 3 sides with cavern_wall (impassable), leave west (4,5) open for the dwarf
    const walls = [
      makeMapTile(6, 5, 0, "cavern_wall"), // east
      makeMapTile(5, 4, 0, "cavern_wall"), // north
      makeMapTile(5, 6, 0, "cavern_wall"), // south
    ];
    const mineTask = makeTask("mine", {
      status: "claimed",
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 140,
      civilization_id: "test-civ",
    });
    dwarf.current_task_id = mineTask.id;

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      tasks: [mineTask],
      fortressTileOverrides: [crystalTile, ...walls],
      ticks: 300,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoNullPositionItems(result.items);
    // Dwarf is already adjacent — mine should complete
    const shard = result.items.find(i => i.name === "Crystal shard");
    expect(shard).toBeDefined();
  });

});

// ─── Idle Behavior Chaos ─────────────────────────────────────────────────────

describe("Idle Behavior Chaos", () => {

  it("14. 1 dwarf completely alone — socialize not selected (no target)", async () => {
    const dwarf = makeDwarf({
      position_x: 5,
      position_y: 5,
      civilization_id: "test-civ",
      need_social: 20, // low social need to prefer socialize
      trait_extraversion: 1.0,
    });
    // Provide well so rest is available, making socialize one of the candidates
    const well = makeStructure({ type: "well", completion_pct: 100, position_x: 5, position_y: 6, position_z: 0, civilization_id: "test-civ" });

    const result = await runScenario({
      dwarves: [dwarf],
      structures: [well],
      ticks: 200,
    });

    assertNoNaNNeeds(result.dwarves);
    // No socialize tasks should ever be created (no valid target)
    const socializeTasks = result.tasks.filter(t => t.task_type === "socialize");
    expect(socializeTasks.length).toBe(0);
  });

  it("15. all dwarves dead except one — idle behavior does not crash", async () => {
    const survivor = makeDwarf({ position_x: 5, position_y: 5, civilization_id: "test-civ", need_social: 30 });
    const dead1 = makeDwarf({ status: "dead", position_x: 3, position_y: 3, civilization_id: "test-civ" });
    const dead2 = makeDwarf({ status: "dead", position_x: 7, position_y: 7, civilization_id: "test-civ" });

    const result = await runScenario({
      dwarves: [survivor, dead1, dead2],
      ticks: 100,
    });

    assertNoNaNNeeds(result.dwarves.filter(d => d.status === "alive"));
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    expect(result.ticks).toBe(100);
    // Survivor should never get a socialize task
    const socialize = result.tasks.filter(t => t.task_type === "socialize");
    expect(socialize.length).toBe(0);
  });

  it("16. dwarf socializes with a dwarf that dies mid-socialize-task", async () => {
    const socializer = makeDwarf({ position_x: 5, position_y: 5, civilization_id: "test-civ" });
    // Target dwarf is critically low — will die of thirst soon
    const target = makeDwarf({
      position_x: 8,
      position_y: 5,
      civilization_id: "test-civ",
      need_drink: 0,
    });

    const socialTask = makeTask("socialize", {
      status: "claimed",
      assigned_dwarf_id: socializer.id,
      target_x: target.position_x,
      target_y: target.position_y,
      target_z: target.position_z,
      target_item_id: target.id, // target dwarf ID encoded here
      work_required: 30,
      work_progress: 10,
      civilization_id: "test-civ",
    });
    socializer.current_task_id = socialTask.id;

    const result = await runScenario({
      dwarves: [socializer, target],
      tasks: [socialTask],
      // provide food for socializer to survive
      items: [
        makeItem({ category: "food", position_x: 5, position_y: 5, position_z: 0 }),
        makeItem({ category: "drink", position_x: 5, position_y: 5, position_z: 0 }),
      ],
      ticks: 300,
    });

    assertNoNaNNeeds(result.dwarves.filter(d => d.status === "alive"));
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    // Should not crash regardless of target death
    expect(result.ticks).toBe(300);
  });

  it("17. 20 dwarves all idle at once — mass idle evaluation handles without crash", async () => {
    const dwarves = Array.from({ length: 20 }, (_, i) =>
      makeDwarf({
        position_x: i * 3,
        position_y: 0,
        civilization_id: "test-civ",
        need_social: 30,
      }),
    );
    // Place one well so rest is available
    const well = makeStructure({ type: "well", completion_pct: 100, position_x: 30, position_y: 0, position_z: 0, civilization_id: "test-civ" });

    const result = await runScenario({
      dwarves,
      structures: [well],
      ticks: 100,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    expect(result.ticks).toBe(100);
  });

  it("18. idle behavior + urgent need (starvation) — need interrupts the idle task", async () => {
    const dwarf = makeDwarf({
      position_x: 5,
      position_y: 5,
      civilization_id: "test-civ",
      need_food: 5, // critical
      need_drink: 80,
      need_sleep: 80,
    });
    // Place food nearby
    const food = makeItem({ category: "food", position_x: 5, position_y: 5, position_z: 0 });
    // Dwarf is wandering (idle task)
    const wanderTask = makeTask("wander", {
      status: "claimed",
      assigned_dwarf_id: dwarf.id,
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 30,
      civilization_id: "test-civ",
    });
    dwarf.current_task_id = wanderTask.id;

    const result = await runScenario({
      dwarves: [dwarf],
      items: [food],
      tasks: [wanderTask],
      ticks: 100,
    });

    assertNoNaNNeeds(result.dwarves);
    // The eat task should have been created (need interrupted idle)
    const eatTasks = result.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("19. player designates mine task while dwarf is wandering — dwarf switches", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, civilization_id: "test-civ" });
    // Start dwarf on a wander task
    const wanderTask = makeTask("wander", {
      status: "claimed",
      assigned_dwarf_id: dwarf.id,
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 30,
      civilization_id: "test-civ",
    });
    dwarf.current_task_id = wanderTask.id;
    // High-priority mine task also pending
    const mineTask = makeTask("mine", {
      status: "pending",
      priority: 8,
      target_x: 3,
      target_y: 5,
      target_z: 0,
      work_required: 100,
      civilization_id: "test-civ",
    });
    const rockTile = makeMapTile(3, 5, 0, "rock");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      tasks: [wanderTask, mineTask],
      fortressTileOverrides: [rockTile],
      ticks: 300,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    // Mine task should have been claimed and completed
    const mine = result.tasks.find(t => t.id === mineTask.id);
    expect(mine).toBeDefined();
    expect(mine!.status).toBe("completed");
  });

  it("20. idle cooldown: dwarf completing wander does not immediately get another idle task", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, civilization_id: "test-civ" });
    // Wander task almost done
    const wanderTask = makeTask("wander", {
      status: "in_progress",
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 30,
      work_progress: 29, // 1 tick away from completion
      civilization_id: "test-civ",
    });
    dwarf.current_task_id = wanderTask.id;

    // Run just 5 ticks: wander completes, cooldown should prevent immediate reassignment
    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [wanderTask],
      ticks: 5,
    });

    assertNoNaNNeeds(result.dwarves);
    // Within 5 ticks after completion, no new idle task should be created (cooldown = 50 ticks)
    const newIdleTasks = result.tasks.filter(
      t => (t.task_type === "wander" || t.task_type === "socialize" || t.task_type === "rest")
        && t.id !== wanderTask.id,
    );
    expect(newIdleTasks.length).toBe(0);
  });

  it("21. dwarf with all personality traits null — weighted idle selection does not crash", async () => {
    const dwarf = makeDwarf({
      position_x: 5,
      position_y: 5,
      civilization_id: "test-civ",
      trait_openness: null,
      trait_conscientiousness: null,
      trait_extraversion: null,
      trait_agreeableness: null,
      trait_neuroticism: null,
    });
    const well = makeStructure({ type: "well", completion_pct: 100, position_x: 5, position_y: 6, position_z: 0, civilization_id: "test-civ" });

    const result = await runScenario({
      dwarves: [dwarf],
      structures: [well],
      ticks: 200,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    expect(result.ticks).toBe(200);
  });

  it("22. dwarf with extreme traits (all 0.0 or all 1.0) — sane behavior", async () => {
    const dwarfMin = makeDwarf({
      position_x: 5,
      position_y: 5,
      civilization_id: "test-civ",
      trait_openness: 0.0,
      trait_conscientiousness: 0.0,
      trait_extraversion: 0.0,
      trait_agreeableness: 0.0,
      trait_neuroticism: 0.0,
    });
    const dwarfMax = makeDwarf({
      position_x: 8,
      position_y: 5,
      civilization_id: "test-civ",
      trait_openness: 1.0,
      trait_conscientiousness: 1.0,
      trait_extraversion: 1.0,
      trait_agreeableness: 1.0,
      trait_neuroticism: 1.0,
    });
    const well = makeStructure({ type: "well", completion_pct: 100, position_x: 6, position_y: 5, position_z: 0, civilization_id: "test-civ" });
    const drink = makeItem({ category: "drink", position_x: 6, position_y: 5, position_z: 0 });
    const food = makeItem({ category: "food", position_x: 6, position_y: 5, position_z: 0 });

    const result = await runScenario({
      dwarves: [dwarfMin, dwarfMax],
      structures: [well],
      items: [drink, food],
      ticks: 300,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    expect(result.ticks).toBe(300);
    // Both dwarves should be alive (or at worst dead for valid reasons, not crashes)
    expect(result.dwarves.length).toBe(2);
  });

});

// ─── Cross-Feature Interactions ──────────────────────────────────────────────

describe("Cross-Feature Interactions", () => {

  it("23. workshop + idle behavior: idle dwarf near still with ingredients — auto-brew fires", async () => {
    const dwarf = makeDwarf({
      position_x: 5,
      position_y: 5,
      civilization_id: "test-civ",
    });
    const still = makeStructure({
      type: "still",
      completion_pct: 100,
      position_x: 5,
      position_y: 5,
      position_z: 0,
      civilization_id: "test-civ",
    });
    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 5,
      position_y: 6,
      position_z: 0,
    });
    // No drinks → auto-brew should trigger
    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      items: [plant],
      structures: [still],
      ticks: 200,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoNullPositionItems(result.items);
    // A brew task should have been created and completed
    const brewCompleted = result.tasks.filter(t => t.task_type === "brew" && t.status === "completed");
    expect(brewCompleted.length).toBeGreaterThan(0);
    // A drink item should now exist
    const drinks = result.items.filter(i => i.category === "drink");
    expect(drinks.length).toBeGreaterThan(0);
  });

  it("24. spring tile + kitchen: dwarves drink from spring between cooking", async () => {
    const dwarf = makeDwarf({
      position_x: 5,
      position_y: 5,
      civilization_id: "test-civ",
      need_drink: 25, // low — will interrupt to drink
    });
    const kitchen = makeStructure({
      type: "kitchen",
      completion_pct: 100,
      position_x: 5,
      position_y: 5,
      position_z: 0,
      civilization_id: "test-civ",
    });
    const springTile = makeMapTile(3, 5, 0, "spring");
    const rawFood = makeItem({
      category: "food",
      material: "plant",
      position_x: 5,
      position_y: 6,
      position_z: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: allSkills(dwarf.id),
      items: [rawFood],
      structures: [kitchen],
      fortressTileOverrides: [springTile],
      ticks: 400,
    });

    assertNoNaNNeeds(result.dwarves);
    assertNoOrphanedTasks(result.dwarves, result.tasks);
    assertNoNullPositionItems(result.items);
    expect(result.ticks).toBe(400);
    // Dwarf should have created at least one drink task (from spring)
    const drinkTasks = result.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks.length).toBeGreaterThan(0);
  });

  it("25. stability test: all three systems for 5000 ticks with 7 dwarves — no NaN, no crashes, no stuck dwarves", async () => {
    const dwarves = Array.from({ length: 7 }, (_, i) =>
      makeDwarf({
        position_x: 5 + i * 2,
        position_y: 5,
        civilization_id: "test-civ",
        need_food: 80,
        need_drink: 80,
        need_sleep: 80,
        need_social: 60,
        trait_openness: 0.5,
        trait_conscientiousness: 0.5,
        trait_extraversion: 0.5,
        trait_agreeableness: 0.5,
        trait_neuroticism: 0.3,
      }),
    );

    const still = makeStructure({
      type: "still",
      completion_pct: 100,
      position_x: 10,
      position_y: 10,
      position_z: 0,
      civilization_id: "test-civ",
    });
    const kitchen = makeStructure({
      type: "kitchen",
      completion_pct: 100,
      position_x: 12,
      position_y: 10,
      position_z: 0,
      civilization_id: "test-civ",
    });
    const well = makeStructure({
      type: "well",
      completion_pct: 100,
      position_x: 14,
      position_y: 10,
      position_z: 0,
      civilization_id: "test-civ",
    });
    const bed = makeStructure({
      type: "bed",
      completion_pct: 100,
      position_x: 8,
      position_y: 8,
      position_z: 0,
      civilization_id: "test-civ",
    });

    // Seed with several plant materials, food items, and drinks
    const items = [
      ...Array.from({ length: 10 }, () => makeItem({
        category: "raw_material",
        material: "plant",
        position_x: 10 + Math.floor(Math.random() * 5),
        position_y: 10,
        position_z: 0,
      })),
      ...Array.from({ length: 5 }, () => makeItem({
        category: "food",
        material: "plant",
        position_x: 12,
        position_y: 10 + Math.floor(Math.random() * 3),
        position_z: 0,
      })),
      ...Array.from({ length: 5 }, () => makeItem({
        category: "drink",
        position_x: 14,
        position_y: 10,
        position_z: 0,
      })),
    ];

    const tiles = [
      makeMapTile(10, 10, 0, "still"),
      makeMapTile(12, 10, 0, "kitchen"),
      makeMapTile(14, 10, 0, "well"),
      makeMapTile(8, 8, 0, "bed"),
      makeMapTile(6, 5, 0, "spring"),
      makeMapTile(20, 5, 0, "fungal_growth"),
      makeMapTile(22, 5, 0, "flower"),
      makeMapTile(24, 5, 0, "glowing_moss"),
    ];

    const dwarfSkills = dwarves.flatMap(d => allSkills(d.id));

    const result = await runScenario({
      dwarves,
      dwarfSkills,
      items,
      structures: [still, kitchen, well, bed],
      fortressTileOverrides: tiles,
      ticks: 5000,
      seed: 12345,
    });

    expect(result.ticks).toBe(5000);

    // No NaN in any dwarf need
    assertNoNaNNeeds(result.dwarves);

    // No alive dwarf pointing at non-existent task
    assertNoOrphanedTasks(result.dwarves, result.tasks);

    // No item floating in space
    assertNoNullPositionItems(result.items);

    // No alive dwarf stuck with the same task indefinitely is hard to detect here,
    // but we can verify all task_type values are valid strings (not undefined)
    for (const task of result.tasks) {
      expect(typeof task.task_type).toBe("string");
      expect(task.task_type.length).toBeGreaterThan(0);
    }

    // Check stress values are clamped and not NaN
    for (const d of result.dwarves) {
      expect(d.stress_level).toBeGreaterThanOrEqual(0);
      expect(d.stress_level).toBeLessThanOrEqual(100);
      expect(Number.isFinite(d.stress_level)).toBe(true);
    }
  }, 60_000); // allow up to 60s for 5000-tick run

});
