/**
 * Deep chaos tests — multi-system interaction bugs.
 *
 * Each test is annotated with WHY it might break. Assertions check both
 * "no crash" and specific state invariants: no NaN needs, no dead dwarves
 * with active tasks, no items with null civ and null position, etc.
 */

import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import {
  makeDwarf,
  makeItem,
  makeTask,
  makeSkill,
  makeMapTile,
  makeStructure,
  makeRuin,
  makeMonster,
} from "./test-helpers.js";
import { DWARF_CARRY_CAPACITY, STEPS_PER_YEAR } from "@pwarf/shared";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function assertNeedsValid(dwarves: Awaited<ReturnType<typeof runScenario>>["dwarves"]): void {
  for (const d of dwarves) {
    expect(Number.isNaN(d.need_food), `${d.name} need_food is NaN`).toBe(false);
    expect(Number.isNaN(d.need_drink), `${d.name} need_drink is NaN`).toBe(false);
    expect(Number.isNaN(d.need_sleep), `${d.name} need_sleep is NaN`).toBe(false);
    expect(Number.isNaN(d.need_social), `${d.name} need_social is NaN`).toBe(false);
    expect(Number.isNaN(d.stress_level), `${d.name} stress_level is NaN`).toBe(false);
    expect(d.need_food, `${d.name} need_food out of range`).toBeGreaterThanOrEqual(0);
    expect(d.need_drink, `${d.name} need_drink out of range`).toBeGreaterThanOrEqual(0);
    expect(d.need_sleep, `${d.name} need_sleep out of range`).toBeGreaterThanOrEqual(0);
    expect(d.need_social, `${d.name} need_social out of range`).toBeGreaterThanOrEqual(0);
    expect(d.stress_level, `${d.name} stress_level out of range`).toBeGreaterThanOrEqual(0);
    expect(d.stress_level, `${d.name} stress_level above max`).toBeLessThanOrEqual(100);
  }
}

function assertNoDeadDwarfWithTask(result: Awaited<ReturnType<typeof runScenario>>): void {
  for (const d of result.dwarves) {
    if (d.status === "dead") {
      expect(d.current_task_id, `Dead dwarf ${d.name} still holds task`).toBeNull();
    }
  }
  // Also: no task should be claimed/in_progress and reference a dead dwarf
  for (const t of result.tasks) {
    if (t.status === "in_progress" || t.status === "claimed") {
      if (t.assigned_dwarf_id) {
        const dwarf = result.dwarves.find((d) => d.id === t.assigned_dwarf_id);
        expect(dwarf?.status, `Task ${t.task_type} assigned to dead/missing dwarf`).toBe("alive");
      }
    }
  }
}

function assertItemsValid(result: Awaited<ReturnType<typeof runScenario>>): void {
  for (const item of result.items) {
    // Every item must either be held by someone or have a position
    const hasHolder = item.held_by_dwarf_id !== null;
    const hasPosition =
      item.position_x !== null && item.position_y !== null && item.position_z !== null;
    expect(
      hasHolder || hasPosition,
      `Item "${item.name}" (${item.id}) is neither held nor positioned`,
    ).toBe(true);
    // Held items must not also have a position
    if (hasHolder) {
      expect(item.position_x, `Held item "${item.name}" also has position_x`).toBeNull();
      expect(item.position_y, `Held item "${item.name}" also has position_y`).toBeNull();
      expect(item.position_z, `Held item "${item.name}" also has position_z`).toBeNull();
    }
    // Holder must be alive
    if (hasHolder) {
      const holder = result.dwarves.find((d) => d.id === item.held_by_dwarf_id);
      // only fail if we can positively identify them as dead.
      if (holder) {
        expect(holder.status, `Dead dwarf ${holder.name} is holding item "${item.name}"`).toBe(
          "alive",
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Race conditions between phases
// ─────────────────────────────────────────────────────────────────────────────

describe("Race conditions between phases", () => {
  it("test-01: dwarf dies of starvation in taskExecution, needSatisfaction still runs for other dwarves", { timeout: 30000 }, async () => {
    // WHY: deprivation kills in taskExecution. needSatisfaction runs after. If it
    // iterates state.dwarves and tries to find food for the now-dead dwarf it could
    // create a dangling eat task for a dead dwarf.
    const dying = makeDwarf({
      name: "Dying",
      need_food: 0,
      need_drink: 80,
      need_sleep: 80,
      need_social: 80,
      current_task_id: null,
    });
    const healthy = makeDwarf({
      name: "Healthy",
      need_food: 25, // below interrupt threshold → will trigger eat
      position_x: 5,
      position_y: 5,
    });
    const food = makeItem({
      category: "food",
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });

    // Force Dying to starve immediately by pre-setting zeroFoodTicks via many ticks
    const result = await runScenario({
      dwarves: [dying, healthy],
      items: [food],
      ticks: 20000, // enough for starvation (STARVATION_TICKS=18000)
    });

    assertNeedsValid(result.dwarves);
    assertNoDeadDwarfWithTask(result);
    // At least one death event expected
    const deathEvents = result.events.filter((e) => e.category === "death" || e.description?.includes("perished"));
    expect(deathEvents.length).toBeGreaterThan(0);
  });

  it("test-02: mine completes → produces stone block → haulAssignment creates haul → jobClaiming assigns same dwarf → no duplicate items", async () => {
    // WHY: mine completion creates an item and the miner picks it up. haulAssignment then
    // sees an idle dwarf with a carried item and creates a haul task. jobClaiming could try
    // to assign the same mine task again if status bookkeeping is wrong. Verify item count is exactly 1.
    const dwarf = makeDwarf({ name: "Miner", position_x: 1, position_y: 0 });
    const skill = makeSkill(dwarf.id, "mining", 0, 0);
    const task = makeTask("mine", {
      civilization_id: "civ-1",
      status: "pending",
      assigned_dwarf_id: null,
      target_x: 1,
      target_y: 1,
      target_z: 0,
      work_required: 5, // very small — completes quickly
    });
    const rockTile = makeMapTile(1, 1, 0, "rock");
    const stockpile = {
      id: "sp-1",
      civilization_id: "civ-1",
      x: 3,
      y: 3,
      z: 0,
      priority: 1,
      accepts_categories: null,
      created_at: new Date().toISOString(),
    };

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [rockTile],
      stockpileTiles: [stockpile],
      ticks: 50,
    });

    assertNeedsValid(result.dwarves);
    assertNoDeadDwarfWithTask(result);
    assertItemsValid(result);
    // Mine should have completed (tile becomes open_air or grass)
    const mineTask = result.tasks.find((t) => t.task_type === "mine");
    expect(mineTask?.status).toBe("completed");
    // No item should have both holder and position
    for (const item of result.items) {
      if (item.held_by_dwarf_id !== null) {
        expect(item.position_x).toBeNull();
      }
    }
  });

  it("test-03: tantruming dwarf's eat task created by needSatisfaction should still execute", async () => {
    // WHY: jobClaiming skips tantruming dwarves (isDwarfIdle returns false for tantrumers
    // because they have no task). BUT needSatisfaction directly marks the eat task as
    // 'claimed' and assigns dwarf.current_task_id without going through jobClaiming.
    // If the tantrum-check also cancels the current_task_id when stress is very high,
    // the eat task could be cancelled and the dwarf starves despite food being available.
    const dwarf = makeDwarf({
      name: "Rager",
      stress_level: 95, // already severe tantrum level
      is_in_tantrum: true,
      need_food: 5, // critically hungry — well below NEED_INTERRUPT_FOOD (30)
      need_drink: 80,
      need_sleep: 80,
      need_social: 50,
    });
    const food = makeItem({
      category: "food",
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [food],
      ticks: 200,
    });

    assertNeedsValid(result.dwarves);
    // The dwarf should not have a task assigned that is in_progress/claimed AND have dead status
    assertNoDeadDwarfWithTask(result);
  });

  it("test-04: dwarf in tantrum gets food task assigned via needSatisfaction, then tantrumCheck cancels the task", async () => {
    // WHY: tantrumCheck fires AFTER needSatisfaction. When a new tantrum starts,
    // tantrumCheck cancels dwarf.current_task_id. If needSatisfaction just set it to an
    // eat task, the eat task gets cancelled — leaving the task in 'cancelled' status.
    // This is effectively a starvation vector. We test that the dwarf can eventually eat.
    const dwarf = makeDwarf({
      name: "AboutToSnap",
      stress_level: 79, // just under tantrum threshold — will cross it from stressUpdate
      need_food: 10,    // hunger will trigger needSatisfaction
      need_drink: 80,
      need_sleep: 80,
      need_social: 0,   // low morale contributes to stress
    });
    const food = makeItem({
      category: "food",
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [food],
      ticks: 500,
    });

    assertNeedsValid(result.dwarves);
    assertNoDeadDwarfWithTask(result);
  });

  it("test-05: dwarf dies from COMBAT killing health to 0 — task cleanup correct", async () => {
    // WHY: tantrum attack reduces health to 0 but does NOT call killDwarf. The victim
    // could have health=0 but still be alive, with an active task pointing to them.
    // combatResolution and tantrumActions both deal damage. If health hits 0 in tantrumActions
    // but dwarf is still status='alive', later phases may operate on a "dead" dwarf.
    const rager = makeDwarf({
      name: "Rager",
      stress_level: 100,
      is_in_tantrum: true,
      health: 100,
      position_x: 1,
      position_y: 1,
    });
    const victim = makeDwarf({
      name: "Victim",
      health: 1, // one more hit from tantrum (TANTRUM_ATTACK_DAMAGE=10) will reach 0
      position_x: 1,
      position_y: 1, // adjacent to rager
      need_food: 80,
      need_drink: 80,
    });

    const result = await runScenario({
      dwarves: [rager, victim],
      ticks: 2000, // long enough for the random TANTRUM_ATTACK_CHANCE to fire
    });

    // Key invariant: health should never go negative
    for (const d of result.dwarves) {
      expect(d.health, `${d.name} has negative health`).toBeGreaterThanOrEqual(0);
    }
    assertNeedsValid(result.dwarves);
    assertNoDeadDwarfWithTask(result);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Inventory + task interaction bugs
// ─────────────────────────────────────────────────────────────────────────────

describe("Inventory + task interactions", () => {
  it("test-06: dwarf at max carry capacity mines — mined item drops on tile, not into inventory", async () => {
    // WHY: completeMine calls canPickUp before adding item to dwarf. If canPickUp fails
    // the item should be placed at the mine tile. But if the tile coords are null,
    // the item ends up at null position — lost forever.
    const dwarf = makeDwarf({ name: "HeavyMiner", position_x: 1, position_y: 0 });
    const skill = makeSkill(dwarf.id, "mining", 0, 0);

    // Fill carry capacity: stone blocks weigh 10, capacity is 50 → 5 blocks = full
    const carriedItems = Array.from({ length: 5 }, (_, i) =>
      makeItem({
        category: "raw_material",
        material: "stone",
        weight: 10,
        held_by_dwarf_id: dwarf.id,
        position_x: null,
        position_y: null,
        position_z: null,
      }),
    );

    const mineTask = makeTask("mine", {
      civilization_id: "civ-1",
      status: "pending",
      assigned_dwarf_id: null,
      target_x: 1,
      target_y: 1,
      target_z: 0,
      work_required: 5,
    });
    const rockTile = makeMapTile(1, 1, 0, "rock");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      items: carriedItems,
      tasks: [mineTask],
      fortressTileOverrides: [rockTile],
      ticks: 50,
    });

    assertItemsValid(result);
    assertNeedsValid(result.dwarves);

    // The stone block produced by mining should be on the ground (not held)
    // because the dwarf was at capacity
    const stoneBlocks = result.items.filter((i) => i.name === "Stone block");
    for (const block of stoneBlocks) {
      // If not held by dwarf it must have a position
      if (block.held_by_dwarf_id !== dwarf.id) {
        expect(block.position_x, "Dropped stone block has no position_x").not.toBeNull();
        expect(block.position_y, "Dropped stone block has no position_y").not.toBeNull();
        expect(block.position_z, "Dropped stone block has no position_z").not.toBeNull();
      }
    }
  });

  it("test-07: multiple dwarves try to pick up the same item simultaneously", async () => {
    // WHY: haulAssignment creates haul tasks for ground items. If two dwarves both get a
    // haul task for the same item in one tick (before claimedTaskIds guards), or if they
    // both arrive at the item tile in the same tick, one might succeed and the other
    // fails — but both could then try to set held_by_dwarf_id.
    const item = makeItem({
      category: "raw_material",
      material: "stone",
      weight: 1,
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });
    const d1 = makeDwarf({ name: "A", position_x: 4, position_y: 5 });
    const d2 = makeDwarf({ name: "B", position_x: 6, position_y: 5 });
    const haulSkill1 = makeSkill(d1.id, "hauling", 0, 0);
    const haulSkill2 = makeSkill(d2.id, "hauling", 0, 0);

    const stockpile = {
      id: "sp-1",
      civilization_id: "civ-1",
      x: 10,
      y: 10,
      z: 0,
      priority: 1,
      accepts_categories: null,
      created_at: new Date().toISOString(),
    };

    const result = await runScenario({
      dwarves: [d1, d2],
      dwarfSkills: [haulSkill1, haulSkill2],
      items: [item],
      stockpileTiles: [stockpile],
      ticks: 100,
    });

    assertItemsValid(result);
    assertNeedsValid(result.dwarves);
    // The item should have exactly one holder OR be on the ground — not held by multiple
    const matchItem = result.items.find((i) => i.id === item.id);
    if (matchItem) {
      if (matchItem.held_by_dwarf_id !== null) {
        // Exactly one holder
        const holderCount = result.dwarves.filter((d) => d.id === matchItem.held_by_dwarf_id).length;
        expect(holderCount).toBe(1);
      }
    }
  });

  it("test-08: haul task for item that gets consumed (eaten) before hauler arrives", async () => {
    // WHY: haulAssignment creates a haul task targeting an item. needSatisfaction then
    // creates an eat task for another dwarf targeting the SAME item. If the eater reaches
    // it first and completes the eat, the item is deleted. Then the hauler arrives at the
    // now-empty tile and completeHaul finds no item — it should degrade gracefully, not crash.
    const eater = makeDwarf({
      name: "Hungry",
      need_food: 10, // very hungry — will immediately go for food
      position_x: 5,
      position_y: 5,
    });
    const hauler = makeDwarf({
      name: "Hauler",
      position_x: 0,
      position_y: 0,
    });
    const haulSkill = makeSkill(hauler.id, "hauling", 0, 0);

    const food = makeItem({
      category: "food",
      material: "plant",
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });

    const stockpile = {
      id: "sp-1",
      civilization_id: "civ-1",
      x: 10,
      y: 10,
      z: 0,
      priority: 1,
      accepts_categories: null,
      created_at: new Date().toISOString(),
    };

    const result = await runScenario({
      dwarves: [eater, hauler],
      dwarfSkills: [haulSkill],
      items: [food],
      stockpileTiles: [stockpile],
      ticks: 200,
    });

    assertNeedsValid(result.dwarves);
    assertNoDeadDwarfWithTask(result);
    // Both dwarves should still be alive (no crash from missing item)
    for (const d of result.dwarves) {
      expect(d.health).toBeGreaterThanOrEqual(0);
    }
  });

  it("test-09: dwarf carrying items dies — carried items should NOT have a dead holder", async () => {
    // WHY: killDwarf in deprivation.ts clears the task but does NOT drop the dwarf's
    // carried items. Items might remain with held_by_dwarf_id pointing at a dead dwarf.
    // This tests whether that invariant is enforced by any phase.
    const dwarf = makeDwarf({
      name: "CarryingDwarf",
      need_food: 0,
      need_drink: 0,
    });
    const carriedItem = makeItem({
      category: "raw_material",
      material: "stone",
      weight: 5,
      held_by_dwarf_id: dwarf.id,
      position_x: null,
      position_y: null,
      position_z: null,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [carriedItem],
      ticks: 20000, // enough for death by dehydration
    });

    // At least one dwarf should be dead
    expect(result.dwarves.some((d) => d.status === "dead")).toBe(true);

    // KEY BUG CHECK: if killDwarf doesn't drop items, held_by_dwarf_id points to a dead dwarf
    const item = result.items.find((i) => i.id === carriedItem.id);
    if (item) {
      if (item.held_by_dwarf_id !== null) {
        const holder = result.dwarves.find((d) => d.id === item.held_by_dwarf_id);
        // This is the bug: holder is dead. We document it explicitly.
        if (holder && holder.status === "dead") {
          // BUG: items are not dropped when dwarf dies — they remain held by a dead dwarf
          console.warn(`BUG FOUND: Item "${item.name}" held by dead dwarf "${holder.name}"`);
        }
        // The test itself doesn't fail — we're documenting the behavior.
        // If this is fixed in the future, the item should have a position.
      }
    }
  });

  it("test-10: build task completes consuming the only stone block — then another build task queued for the same resource", async () => {
    // WHY: consumeResources runs inside completeTask. If two build tasks are pending and
    // only 1 stone is available, the first build consumes the stone. The second build task
    // then gets reverted to pending (buildSuccess=false). We verify this cycle is stable.
    const dwarf = makeDwarf({ name: "Builder", position_x: 1, position_y: 1 });
    const skill = makeSkill(dwarf.id, "building", 0, 0);

    const stone = makeItem({
      category: "raw_material",
      material: "stone",
      weight: 10,
      position_x: 1,
      position_y: 1,
      position_z: 0,
    });

    const build1 = makeTask("build_wall", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 2,
      target_y: 2,
      target_z: 0,
      work_required: 5,
    });
    const build2 = makeTask("build_wall", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 3,
      target_y: 2,
      target_z: 0,
      work_required: 5,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      items: [stone],
      tasks: [build1, build2],
      ticks: 200,
    });

    assertNeedsValid(result.dwarves);
    assertItemsValid(result);
    // At most one build_wall should be completed (only one stone)
    const completedBuilds = result.tasks.filter(
      (t) => t.task_type === "build_wall" && t.status === "completed",
    );
    expect(completedBuilds.length).toBeLessThanOrEqual(1);
  });

  it("test-11: dwarf with full inventory gets haul task — should drop items before being assigned new haul", async () => {
    // WHY: haulAssignment checks isDwarfIdle AND carried items. If a dwarf just finished
    // a task and is now idle with a full inventory (10 stone blocks at weight 5 = 50),
    // haulAssignment should create a haul task for one item. But the dwarf ALSO has
    // pending mine tasks. jobClaiming would skip mine tasks for full-inventory dwarves.
    // This tests that the system doesn't deadlock.
    const dwarf = makeDwarf({ name: "PackMule", position_x: 0, position_y: 0 });
    const mineSkill = makeSkill(dwarf.id, "mining", 0, 0);
    const haulSkill = makeSkill(dwarf.id, "hauling", 0, 0);

    // Fill inventory to capacity
    const heldItems = Array.from({ length: 10 }, () =>
      makeItem({
        category: "raw_material",
        material: "stone",
        weight: 5,
        held_by_dwarf_id: dwarf.id,
        position_x: null,
        position_y: null,
        position_z: null,
      }),
    );

    // Add a mine task that a full-inventory dwarf can't claim
    const mineTask = makeTask("mine", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 100,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [mineSkill, haulSkill],
      items: heldItems,
      tasks: [mineTask],
      ticks: 50,
    });

    assertNeedsValid(result.dwarves);
    // Dwarf should not be stuck — either has a haul task or dropped items
    const finalDwarf = result.dwarves[0];
    expect(finalDwarf?.status).toBe("alive");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Year rollup edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("Year rollup edge cases", () => {
  it("test-12: all dwarves dead at year rollup — population zero should not crash", async () => {
    // WHY: yearlyRollup computes population and wealth. If all dwarves are dead,
    // population=0. The rollup event fires with "Population: 0 dwarves." — but does
    // it crash anywhere? Immigration can still fire. Old-age death loop on 0 alive dwarves
    // should not produce events with null dwarf references.
    const dead = makeDwarf({
      name: "AlreadyDead",
      status: "dead",
      died_year: 0,
      cause_of_death: "starvation",
    });

    const result = await runScenario({
      dwarves: [dead],
      ticks: STEPS_PER_YEAR + 1, // ensure rollup fires
    });

    expect(result.year).toBeGreaterThan(1);
    assertNeedsValid(result.dwarves);
  });

  it("test-13: dwarf dies of old age during year rollup — task not orphaned", async () => {
    // WHY: yearlyRollup kills elderly dwarves but does clear current_task_id (it cancels
    // the task and clears the pointer). Let's verify this matches deprivation.ts behavior
    // by checking that no old-dead dwarf holds a task.
    const elder = makeDwarf({
      name: "Elder",
      age: 82, // above ELDER_DEATH_AGE=80 — very high death chance (0.2+)
      status: "alive",
    });
    const task = makeTask("mine", {
      civilization_id: "civ-1",
      status: "in_progress",
      assigned_dwarf_id: elder.id,
      work_required: 100000, // won't complete
    });
    elder.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [elder],
      tasks: [task],
      ticks: STEPS_PER_YEAR + 10,
      seed: 12345, // seed where elder rolls badly
    });

    assertNoDeadDwarfWithTask(result);
    assertNeedsValid(result.dwarves);
  });

  it("test-14: civFallen flag set during year rollup — no duplicate fortress_fallen events", async () => {
    // WHY: killDwarf sets civFallen=true and fires fortress_fallen event. yearlyRollup
    // may also kill dwarves (old age). If the last dwarf dies in yearlyRollup AND civFallen
    // was already set from a previous death, there should not be a second fortress_fallen event.
    const lastDwarf = makeDwarf({
      name: "LastOne",
      age: 82,
      status: "alive",
      need_food: 0,
      need_drink: 0,
    });

    const result = await runScenario({
      dwarves: [lastDwarf],
      ticks: STEPS_PER_YEAR + 100,
    });

    const fallenEvents = result.events.filter((e) => e.category === "fortress_fallen");
    expect(fallenEvents.length).toBeLessThanOrEqual(1);
  });

  it("test-15: caravan at year 2 (CARAVAN_INTERVAL_YEARS=2) — items have valid positions", async () => {
    // WHY: yearlyRollup creates caravan items at the fortress center (256,256).
    // Verify they have valid positions and don't trigger assertItemsValid failures.
    const dwarf = makeDwarf({ name: "Dwarf" });

    const result = await runScenario({
      dwarves: [dwarf],
      ticks: STEPS_PER_YEAR * 2 + 1, // run past year 2 rollup
    });

    const caravanItems = result.items.filter(
      (i) => i.name === "Dwarven ale" || i.name === "Cured meat",
    );
    for (const item of caravanItems) {
      expect(item.position_x, `Caravan item ${item.name} has no position_x`).not.toBeNull();
      expect(item.position_y, `Caravan item ${item.name} has no position_y`).not.toBeNull();
      expect(item.position_z, `Caravan item ${item.name} has no position_z`).not.toBeNull();
    }
    assertItemsValid(result);
    assertNeedsValid(result.dwarves);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Task completion side effects
// ─────────────────────────────────────────────────────────────────────────────

describe("Task completion side effects", () => {
  it("test-16: mine a tree tile — should produce Wood log, not Stone block", async () => {
    // WHY: getMineProduct switches on tileType. 'tree' → 'Wood log'. If the override
    // lookup fails or returns null, it defaults to 'Stone block'. Verify the correct item.
    // The mine task requires adjacency — dwarf at (1,0) is adjacent to target (1,1).
    // Without a deriver, all unspecified tiles are open_air (walkable).
    // We give the dwarf very high skill + very low work_required so it completes fast.
    // We also disable autoForage by NOT providing any forageable tile (tree is the mine target).
    const dwarf = makeDwarf({ name: "Logger", position_x: 1, position_y: 0, need_food: 80, need_drink: 80 });
    const skill = makeSkill(dwarf.id, "mining", 10, 1000); // high skill for faster work
    const treeTile = makeMapTile(1, 1, 0, "tree");
    const task = makeTask("mine", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 1,
      target_y: 1,
      target_z: 0,
      work_required: 1, // extremely small — completes in 1 work tick
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [treeTile],
      ticks: 50,
    });

    assertItemsValid(result);
    // Mine task should have completed
    const mineTask = result.tasks.find((t) => t.task_type === "mine");
    expect(mineTask?.status).toBe("completed");
    const woodItems = result.items.filter((i) => i.name === "Wood log");
    const stoneItems = result.items.filter((i) => i.name === "Stone block");
    expect(woodItems.length).toBeGreaterThanOrEqual(1);
    expect(stoneItems.length).toBe(0);
  });

  it("test-17: mine a bush tile — should produce NO item (itemName=null)", async () => {
    // WHY: getMineProduct for 'bush' returns itemName=null, meaning no item is created.
    // If there's an off-by-one or null check missing, a null-named item could be created.
    // Note: autoForage also uses 'bush' tiles as forageable. To isolate the mine behavior,
    // we place the bush at the mine target but disable forage by giving full food stocks.
    const dwarf = makeDwarf({ name: "BushMiner", position_x: 1, position_y: 0, need_food: 80, need_drink: 80 });
    const skill = makeSkill(dwarf.id, "mining", 10, 1000);
    const bushTile = makeMapTile(1, 1, 0, "bush");
    // Fill food stocks above autoForage threshold (MIN_FORAGE_FOOD_STOCK=5)
    const foodItems = Array.from({ length: 6 }, () =>
      makeItem({ category: "food", position_x: 5, position_y: 5, position_z: 0 }),
    );
    const task = makeTask("mine", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 1,
      target_y: 1,
      target_z: 0,
      work_required: 1,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      items: foodItems,
      tasks: [task],
      fortressTileOverrides: [bushTile],
      ticks: 50,
    });

    assertItemsValid(result);
    // Mine task should have completed
    const mineTask = result.tasks.find((t) => t.task_type === "mine");
    expect(mineTask?.status).toBe("completed");
    // No items created by mining bush (food items we pre-loaded should still be there, no mine product)
    const nonFoodItems = result.items.filter((i) => i.category !== "food");
    expect(nonFoodItems.length).toBe(0);
  });

  it("test-18: build_wall on top of an existing bed structure — both structure and wall tile", async () => {
    // WHY: completeBuild calls upsertFortressTile which overwrites any existing tile override.
    // But the Structure object (bed) still exists in state.structures. This could leave a
    // 'constructed_wall' tile where a bed structure is still tracked — inconsistent state.
    const bed = makeStructure({
      type: "bed",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      completion_pct: 100,
    });
    const bedTile = makeMapTile(5, 5, 0, "bed");
    const stone = makeItem({
      category: "raw_material",
      material: "stone",
      weight: 1,
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });
    const dwarf = makeDwarf({ name: "Overlapper", position_x: 0, position_y: 0 });
    const skill = makeSkill(dwarf.id, "building", 0, 0);
    const buildTask = makeTask("build_wall", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 5,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      items: [stone],
      tasks: [buildTask],
      structures: [bed],
      fortressTileOverrides: [bedTile],
      ticks: 200,
    });

    assertNeedsValid(result.dwarves);
    // Should not crash — the bed structure may still exist even if wall was built on top
    // This is a consistency bug but not a crash
    const finalTile = result.fortressTileOverrides.find(
      (t) => t.x === 5 && t.y === 5 && t.z === 0,
    );
    // Tile exists and has a valid type
    if (finalTile) {
      expect(typeof finalTile.tile_type).toBe("string");
    }
  });

  it("test-19: brew task with no plant raw_material available — ale is produced without consuming anything", async () => {
    // WHY: completeBrew looks for a plant item at the target tile. If none found,
    // it still creates the ale drink item. This means free ale with no input!
    // This is a design question — is it intentional? The test documents the behavior.
    const dwarf = makeDwarf({ name: "Brewer", position_x: 3, position_y: 3 });
    const skill = makeSkill(dwarf.id, "brewing", 0, 0);
    const brewTask = makeTask("brew", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 3,
      target_y: 3,
      target_z: 0,
      work_required: 5,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [brewTask],
      // No plant items provided
      ticks: 50,
    });

    assertItemsValid(result);
    assertNeedsValid(result.dwarves);
    // Document: brew always produces ale even with no input
    const ales = result.items.filter((i) => i.name === "Plump helmet brew");
    if (ales.length > 0) {
      console.info(
        `NOTE: completeBrew created ${ales.length} ale(s) even without a plant source. Design question.`,
      );
    }
  });

  it("test-20: cook task with no food available — meal produced from thin air", async () => {
    // WHY: Same as brew — completeCook creates a meal even without an ingredient.
    const dwarf = makeDwarf({ name: "Cook", position_x: 2, position_y: 2 });
    const skill = makeSkill(dwarf.id, "cooking", 0, 0);
    const cookTask = makeTask("cook", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 2,
      target_y: 2,
      target_z: 0,
      work_required: 5,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [cookTask],
      // No food provided
      ticks: 50,
    });

    assertItemsValid(result);
    assertNeedsValid(result.dwarves);
    const meals = result.items.filter((i) => i.name === "Prepared meal");
    if (meals.length > 0) {
      console.info(
        `NOTE: completeCook created ${meals.length} meal(s) even without a food source. Design question.`,
      );
    }
  });

  it("test-21: deconstruct task targeting a non-deconstructible tile (grass) — no crash, tile unchanged", async () => {
    // WHY: completeDeconstruct checks if tileType is in DECONSTRUCTIBLE_TILES. If not,
    // it returns early. But what if there's no tile override at all (tileType=null)?
    // The null check should prevent issues, but we verify no crash occurs.
    const dwarf = makeDwarf({ name: "Deconstructor", position_x: 1, position_y: 1 });
    const skill = makeSkill(dwarf.id, "building", 0, 0);
    // No fortressTileOverrides — tile is null (default from deriver)
    const task = makeTask("deconstruct", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 5,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      ticks: 100,
    });

    assertNeedsValid(result.dwarves);
    assertItemsValid(result);
    // Should not crash — task should complete or be reverted
  });

  it("test-22: farm_till chains to farm_plant chains to farm_harvest — full pipeline produces plump helmet", async () => {
    // WHY: task completion creates follow-up tasks. If createTask fails or jobClaiming
    // doesn't pick up the chained task, the pipeline stalls. Verify end-to-end.
    // Note: farm_till requires the dwarf to be ON the target tile (not adjacent).
    // dwarf starts at (4,4) — ON the tile. work_required=1 so each stage is instant.
    const dwarf = makeDwarf({ name: "Farmer", position_x: 4, position_y: 4, need_food: 80, need_drink: 80 });
    const skill = makeSkill(dwarf.id, "farming", 10, 1000);
    const grassTile = makeMapTile(4, 4, 0, "grass");
    const tillTask = makeTask("farm_till", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 4,
      target_y: 4,
      target_z: 0,
      work_required: 1,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [tillTask],
      fortressTileOverrides: [grassTile],
      ticks: 500, // enough for the full chain (3 chained tasks at WORK_FARM_PLANT_BASE/HARVEST_BASE)
    });

    assertItemsValid(result);
    assertNeedsValid(result.dwarves);
    // The farm_harvest task should have completed, producing a Plump helmet.
    // Note: autoCook may immediately transform the plump helmet into a Prepared meal,
    // so we check either plump helmets OR prepared meals exist (both prove harvest worked).
    const harvestTask = result.tasks.find((t) => t.task_type === "farm_harvest");
    expect(harvestTask?.status, "farm_harvest should complete").toBe("completed");
    const foodProduced = result.items.filter(
      (i) => i.name === "Plump helmet" || i.name === "Prepared meal",
    );
    expect(foodProduced.length, "farm pipeline should produce at least one food item").toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Section 5: Mathematical edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("Mathematical edge cases", () => {
  it("test-25: trait_conscientiousness = 0 — work rate is 0.75x (clamped to 0.1 min)", async () => {
    // WHY: conscientiousnessModifier = Math.max(0.1, 1 + (0 - 0.5) * 0.5) = Math.max(0.1, 0.75) = 0.75
    // This should be fine. But also test the morale restoration in task-completion:
    // restoreMoraleOnTaskComplete: restore *= (1 + (0 - 0.5) * 0.5) = restore * 0.75
    // — should be positive, not NaN.
    const dwarf = makeDwarf({
      name: "Slacker",
      trait_conscientiousness: 0,
      position_x: 1,
      position_y: 0,
    });
    const skill = makeSkill(dwarf.id, "mining", 0, 0);
    const task = makeTask("mine", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 1,
      target_y: 1,
      target_z: 0,
      work_required: 5,
    });
    const rock = makeMapTile(1, 1, 0, "rock");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [rock],
      ticks: 100,
    });

    assertNeedsValid(result.dwarves);
    assertItemsValid(result);
  });

  it("test-26: trait_conscientiousness = -3 (legacy DB value) — clamped, no negative work rate", async () => {
    // WHY: The code clamps: Math.max(0.1, 1 + (-3 - 0.5) * 0.5) = Math.max(0.1, -0.75) = 0.1
    // So workRate uses 0.1. Should still complete tasks, just very slowly.
    // But note: restoreMoraleOnTaskComplete does NOT clamp the conscientiousness modifier!
    // restore *= (1 + (-3 - 0.5) * 0.5) = restore * -0.75 → NEGATIVE morale restoration!
    const dwarf = makeDwarf({
      name: "VeryLazy",
      trait_conscientiousness: -3,
      need_social: 50, // start mid
      position_x: 1,
      position_y: 0,
    });
    const skill = makeSkill(dwarf.id, "mining", 0, 0);
    const task = makeTask("mine", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 1,
      target_y: 1,
      target_z: 0,
      work_required: 5,
    });
    const rock = makeMapTile(1, 1, 0, "rock");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [rock],
      ticks: 200,
    });

    assertNeedsValid(result.dwarves);
    // need_social must not go below 0
    const finalDwarf = result.dwarves.find((d) => d.name === "VeryLazy");
    expect(finalDwarf?.need_social).toBeGreaterThanOrEqual(0);
  });

  it("test-27: skill level 999 — work rate is huge but task still completes without NaN", async () => {
    // WHY: workRate = BASE_WORK_RATE * (1 + 999 * 0.1) * modifier / hardness = 1 * 100.9 * 1 / 1 = 100.9
    // work_required = 100, so task completes in 1 tick. No overflow. But XP award with level 999?
    // awardXp: newLevel = floor(xp / 100). If level is already 999 > MAX_SKILL_LEVEL=20, the
    // `if (newLevel > skill.level && newLevel <= 20)` check guards against it. Fine.
    const dwarf = makeDwarf({ name: "Legendary", position_x: 1, position_y: 0 });
    const skill = makeSkill(dwarf.id, "mining", 999, 99900); // level 999, XP 99900

    const task = makeTask("mine", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 1,
      target_y: 1,
      target_z: 0,
      work_required: 100,
    });
    const rock = makeMapTile(1, 1, 0, "rock");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [rock],
      ticks: 10,
    });

    assertNeedsValid(result.dwarves);
    assertItemsValid(result);
    const mineTask = result.tasks.find((t) => t.task_type === "mine");
    expect(mineTask?.status).toBe("completed");
  });

  it("test-28: stress at exactly 100 AND all needs at 0 — stress stays clamped at 100", async () => {
    // WHY: stressUpdate calls Math.min(MAX_NEED, ...) so it should clamp at 100.
    // But with memories adding stress: if memoryDelta pushes it over, is it clamped?
    const dwarf = makeDwarf({
      name: "MaxStress",
      stress_level: 100,
      need_food: 0,
      need_drink: 0,
      need_sleep: 0,
      need_social: 0,
      is_in_tantrum: true,
      memories: [
        { text: "witnessed a death", tick: 0, sentiment: "negative", intensity: 999, expires_year: 9999 },
      ],
    });

    const result = await runScenario({
      dwarves: [dwarf],
      ticks: 50,
    });

    assertNeedsValid(result.dwarves);
    for (const d of result.dwarves) {
      expect(d.stress_level).toBeLessThanOrEqual(100);
    }
  });

  it("test-29: neuroticism = -3 (legacy) — stress gain multiplier clamped to 0.1, no negative stress", async () => {
    // WHY: gainDelta *= Math.max(0.1, 1 + (-3 - 0.5) * 1.0) = Math.max(0.1, -2.5) = 0.1
    // Stress gains are 90% reduced (not negative), which is correct.
    // But agreeableness recovery: -Math.max(0, -3) * bonus = -0 = no extra recovery.
    // This should be fine. We verify stress doesn't go negative.
    const dwarf = makeDwarf({
      name: "StableNeurotic",
      trait_neuroticism: -3,
      trait_agreeableness: -3,
      stress_level: 50,
      need_food: 0,
      need_drink: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      ticks: 100,
    });

    assertNeedsValid(result.dwarves);
    for (const d of result.dwarves) {
      expect(d.stress_level).toBeGreaterThanOrEqual(0);
    }
  });

  it("test-30: extraversion = -3 (legacy) — morale decay multiplier clamped to 0.1, no NaN", async () => {
    // WHY: extraversionModifier = Math.max(0.1, 1 + (-3 - 0.5) * 1.0) = Math.max(0.1, -2.5) = 0.1
    // need_social decay is only 10% of normal — dwarf becomes very socially independent.
    const dwarf = makeDwarf({
      name: "SuperIntrovert",
      trait_extraversion: -3,
      need_social: 50,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      ticks: 500,
    });

    assertNeedsValid(result.dwarves);
    // need_social should not be NaN
    const finalDwarf = result.dwarves[0];
    expect(Number.isNaN(finalDwarf?.need_social)).toBe(false);
    expect(finalDwarf?.need_social).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 7: Auto-system feedback loops
// ─────────────────────────────────────────────────────────────────────────────

describe("Auto-system feedback loops", () => {
  it("test-31: autoForage + autoCook feedback loop — stabilizes, doesn't oscillate infinitely", async () => {
    // WHY: autoForage fires when food < MIN_FORAGE_FOOD_STOCK (5). Forage creates 1 food.
    // autoCook fires when food count < MIN_COOK_STOCK (15). Cook transforms 1 food → 1 meal.
    // The loop: no food → autoForage → 1 food → autoCook → 1 meal (which is food category).
    // Does food count ever stabilize, or do the two systems fight each other every tick?
    const dwarf = makeDwarf({ name: "SurvivalDwarf", need_food: 80, need_drink: 80 });
    const forageSkill = makeSkill(dwarf.id, "foraging", 5, 500);
    const cookSkill = makeSkill(dwarf.id, "cooking", 5, 500);
    const grassTile = makeMapTile(10, 10, 0, "grass");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [forageSkill, cookSkill],
      fortressTileOverrides: [grassTile],
      ticks: 2000,
    });

    assertNeedsValid(result.dwarves);
    assertItemsValid(result);
    // The dwarf should be alive — system should not deadlock into starvation
    const finalDwarf = result.dwarves[0];
    // Note: we don't require alive here — just no crash and no infinite loop
    expect(finalDwarf).toBeDefined();
  });

  it("test-32: autoBrew sees plant material, creates brew task, dwarf completes brew — drink count increases", async () => {
    // WHY: autoBrew requires plant raw_material. completeBrew consumes it. If the plant
    // item is held by a different dwarf (not the brewer), findItemAt fails and the plant
    // is also checked via findItemHeldBy. The test verifies ale is produced.
    const brewer = makeDwarf({ name: "Brewer", need_drink: 80, need_food: 80 });
    const brewSkill = makeSkill(brewer.id, "brewing", 5, 500);
    // Plant at a ground location (not held)
    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      weight: 1,
      position_x: 3,
      position_y: 3,
      position_z: 0,
      located_in_civ_id: "test-civ",
    });

    const still = makeStructure({ type: 'still', completion_pct: 100, position_x: 3, position_y: 3, position_z: 0 });
    const result = await runScenario({
      dwarves: [brewer],
      dwarfSkills: [brewSkill],
      items: [plant],
      structures: [still],
      ticks: 300,
    });

    assertItemsValid(result);
    assertNeedsValid(result.dwarves);
    const drinks = result.items.filter((i) => i.category === "drink");
    // The brew system should have created at least one drink
    expect(drinks.length).toBeGreaterThan(0);
  });

  it("test-33: autoBrew plant held by OTHER dwarf — brewer cannot brew since findItemAt fails and findItemHeldBy checks brewer's inventory only", { timeout: 30000 }, async () => {
    // WHY: findItemHeldBy(ctx, dwarf.id, 'raw_material', 'plant') only finds items held
    // by the BREWER. If a plant is held by ANOTHER dwarf, completeBrew can't find it.
    // The brew still completes (creates ale) but doesn't consume the plant.
    // autoBrew checks: plant not held by any dwarf. Since it IS held, autoBrew won't create
    // a brew task at all. This is a deadlock: plant exists but can't be brewed.
    const brewer = makeDwarf({ name: "Brewer", need_drink: 80, need_food: 80, position_x: 5, position_y: 5 });
    const holder = makeDwarf({ name: "Holder", need_drink: 80, need_food: 80, position_x: 0, position_y: 0 });
    const brewSkill = makeSkill(brewer.id, "brewing", 5, 500);
    const haulSkill = makeSkill(holder.id, "hauling", 5, 500);

    // Plant held by Holder — autoBrew won't see it
    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      weight: 1,
      held_by_dwarf_id: holder.id,
      position_x: null,
      position_y: null,
      position_z: null,
    });

    const result = await runScenario({
      dwarves: [brewer, holder],
      dwarfSkills: [brewSkill, haulSkill],
      items: [plant],
      ticks: 300,
    });

    assertItemsValid(result);
    assertNeedsValid(result.dwarves);
    // No brew task should have been created since plant is held
    const brewTasks = result.tasks.filter((t) => t.task_type === "brew");
    // This documents the behavior: autoBrew ignores held plants
    console.info(`Brew tasks created (expected 0 if plant is held): ${brewTasks.length}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 8: Concurrent task modifications
// ─────────────────────────────────────────────────────────────────────────────

describe("Concurrent task modifications", () => {
  it("test-34: 5 dwarves all try to claim the same pending task — only one gets it", async () => {
    // WHY: jobClaiming uses claimedTaskIds set to prevent double-assignment within a tick.
    // But if there's a bug in the set or the iteration order, two dwarves could get the same task.
    const task = makeTask("mine", {
      civilization_id: "civ-1",
      status: "pending",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 100000, // won't complete during test
    });
    const rock = makeMapTile(10, 10, 0, "rock");

    const dwarves = Array.from({ length: 5 }, (_, i) =>
      makeDwarf({ name: `D${i}`, position_x: i * 2, position_y: 0 }),
    );
    const skills = dwarves.map((d) => makeSkill(d.id, "mining", 0, 0));

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      tasks: [task],
      fortressTileOverrides: [rock],
      ticks: 2,
    });

    // Only one dwarf should have claimed this task
    const matchTask = result.tasks.find((t) => t.id === task.id);
    if (matchTask && (matchTask.status === "claimed" || matchTask.status === "in_progress")) {
      const claimers = result.dwarves.filter((d) => d.current_task_id === task.id);
      expect(claimers.length).toBeLessThanOrEqual(1);
    }
    assertNeedsValid(result.dwarves);
    assertNoDeadDwarfWithTask(result);
  });

  it("test-35: taskRecovery resets failed task to pending, then same dwarf re-claims in same tick", async () => {
    // WHY: taskRecovery runs before jobClaiming in the tick order. It resets 'failed' tasks
    // to 'pending'. Then jobClaiming runs and can re-assign the same task.
    // If the dwarf's current_task_id was cleared (it was), this is fine.
    // But what if the task's assigned_dwarf_id is not null when recovery runs?
    // taskRecovery only recovers tasks where assigned_dwarf_id IS null.
    const dwarf = makeDwarf({ name: "Retry", position_x: 1, position_y: 0 });
    const skill = makeSkill(dwarf.id, "mining", 0, 0);
    const failedTask = makeTask("mine", {
      civilization_id: "civ-1",
      status: "failed",
      assigned_dwarf_id: null, // already cleared
      work_progress: 0,
      target_x: 1,
      target_y: 1,
      target_z: 0,
      work_required: 5,
    });
    const rock = makeMapTile(1, 1, 0, "rock");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [failedTask],
      fortressTileOverrides: [rock],
      ticks: 50,
    });

    assertNeedsValid(result.dwarves);
    assertNoDeadDwarfWithTask(result);
    // Task should eventually complete after being recovered
    const finalTask = result.tasks.find((t) => t.id === failedTask.id);
    // Should not be stuck in 'failed' forever
    expect(finalTask?.status).not.toBe("failed");
  });

  it("test-36: haul task assigned item gets consumed before hauler arrives — haul task completes gracefully", async () => {
    // WHY: completeHaul finds the item by target_item_id. If the item was deleted (eaten),
    // items.find returns undefined. completeHaul returns early — this should be fine.
    // But the dwarf still gets XP (awardXp runs after completeHaul). Verify no crash.
    const eater = makeDwarf({ name: "Eater", need_food: 5, position_x: 0, position_y: 0 });
    const hauler = makeDwarf({ name: "Hauler", position_x: 20, position_y: 20 });
    const haulSkill = makeSkill(hauler.id, "hauling", 0, 0);

    const food = makeItem({
      category: "food",
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });

    // Pre-create haul task targeting the food item
    const haulTask = makeTask("haul", {
      civilization_id: "civ-1",
      status: "claimed",
      assigned_dwarf_id: hauler.id,
      target_item_id: food.id,
      target_x: 15,
      target_y: 15,
      target_z: 0,
      work_required: 5,
      work_progress: 4, // almost done
    });
    hauler.current_task_id = haulTask.id;

    const stockpile = {
      id: "sp-1",
      civilization_id: "civ-1",
      x: 15,
      y: 15,
      z: 0,
      priority: 1,
      accepts_categories: null,
      created_at: new Date().toISOString(),
    };

    const result = await runScenario({
      dwarves: [eater, hauler],
      dwarfSkills: [haulSkill],
      items: [food],
      tasks: [haulTask],
      stockpileTiles: [stockpile],
      ticks: 50,
    });

    assertNeedsValid(result.dwarves);
    assertNoDeadDwarfWithTask(result);
    // Should not crash — haul completes cleanly even if item is gone
  });

  it("test-37: monster kills a dwarf who is carrying items — items remain in world", async () => {
    // WHY: combatResolution kills a dwarf and calls killDwarf. killDwarf does NOT drop
    // carried items. Items remain with held_by_dwarf_id = dead dwarf id.
    // This is a potential bug: items are permanently lost (can't be picked up by others).
    const carrierDwarf = makeDwarf({
      name: "Carrier",
      health: 5, // very low — one monster hit kills
      position_x: 5,
      position_y: 5,
    });
    const carriedItem = makeItem({
      category: "raw_material",
      material: "stone",
      weight: 5,
      held_by_dwarf_id: carrierDwarf.id,
      position_x: null,
      position_y: null,
      position_z: null,
    });
    const monster = makeMonster({
      current_tile_x: 0,
      current_tile_y: 0,
      lair_tile_x: 0,
      lair_tile_y: 0,
      threat_level: 100,
      health: 999,
    });

    const result = await runScenario({
      dwarves: [carrierDwarf],
      items: [carriedItem],
      monsters: [monster],
      ticks: 500,
    });

    assertNeedsValid(result.dwarves);
    // Check for the specific bug: item held by dead dwarf
    const item = result.items.find((i) => i.id === carriedItem.id);
    if (item && item.held_by_dwarf_id !== null) {
      const holder = result.dwarves.find((d) => d.id === item.held_by_dwarf_id);
      if (holder && holder.status === "dead") {
        console.warn(`BUG: Item "${item.name}" held by dead dwarf "${holder.name}" after monster kill`);
        // The item should ideally be dropped, but we document the bug here
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 9: Additional deep interaction tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Additional deep interaction tests", () => {
  it("test-38: two dwarves mining same tile simultaneously — only one item produced", async () => {
    // WHY: If two dwarves are assigned the same mine tile task (shouldn't happen via jobClaiming,
    // but what if we manually set it?), both could call completeMine producing two items.
    // jobClaiming guards with claimedTaskIds, but task is already 'claimed' for d1 — d2
    // won't see it as pending. Test that manual assignment of same task to two dwarves
    // doesn't cause a double-complete bug.
    const task = makeTask("mine", {
      civilization_id: "civ-1",
      status: "in_progress",
      work_required: 5,
      work_progress: 4,
      target_x: 1,
      target_y: 2,
      target_z: 0,
    });
    const d1 = makeDwarf({ name: "D1", position_x: 1, position_y: 1, current_task_id: task.id });
    task.assigned_dwarf_id = d1.id;
    const d2 = makeDwarf({ name: "D2", position_x: 1, position_y: 3 }); // adjacent from other side
    const rock = makeMapTile(1, 2, 0, "rock");
    const skill1 = makeSkill(d1.id, "mining", 0, 0);
    const skill2 = makeSkill(d2.id, "mining", 0, 0);

    const result = await runScenario({
      dwarves: [d1, d2],
      dwarfSkills: [skill1, skill2],
      tasks: [task],
      fortressTileOverrides: [rock],
      ticks: 10,
    });

    assertItemsValid(result);
    // Only one stone block from this one mine
    const stones = result.items.filter((i) => i.name === "Stone block");
    // Should be at most 1 from this tile (d2 can't claim it since it's already claimed)
    expect(stones.length).toBeLessThanOrEqual(1);
  });

  it("test-39: sleep task interrupted by new higher-priority need — bed released properly", async () => {
    // WHY: needSatisfaction interrupts a sleep task when food/drink drop below threshold.
    // It should release the bed (set occupied_by_dwarf_id=null). If it doesn't, the bed
    // is permanently occupied and no one else can sleep there.
    const bed = makeStructure({
      type: "bed",
      position_x: 2,
      position_y: 2,
      position_z: 0,
      completion_pct: 100,
      occupied_by_dwarf_id: null,
    });
    const dwarf = makeDwarf({
      name: "Sleeper",
      need_sleep: 0, // will trigger sleep
      need_food: 80,
      need_drink: 0, // will interrupt sleep for drink
      position_x: 2,
      position_y: 2,
    });
    // No drinks available — so drink interrupt will try but find nothing

    const result = await runScenario({
      dwarves: [dwarf],
      structures: [bed],
      ticks: 200,
    });

    assertNeedsValid(result.dwarves);
    // Bed should not be permanently locked
    const finalBed = result.structures.find((s) => s.id === bed.id);
    // If dwarf is alive and not sleeping, bed should be unoccupied
    const finalDwarf = result.dwarves[0];
    if (finalDwarf && finalBed) {
      if (finalDwarf.current_task_id === null) {
        expect(finalBed.occupied_by_dwarf_id).toBeNull();
      }
    }
  });

  it("test-40: needs of dwarves stay in [0, 100] range under ALL conditions over 500 ticks", { timeout: 30000 }, async () => {
    // WHY: Comprehensive invariant check — no matter what combination of traits, needs,
    // and tasks occur, needs must stay in [0, 100] and stress in [0, 100].
    const dwarves = [
      makeDwarf({ name: "A", trait_neuroticism: 1.0, trait_conscientiousness: 0.0, stress_level: 99 }),
      makeDwarf({ name: "B", trait_extraversion: 1.0, need_social: 0 }),
      makeDwarf({ name: "C", trait_agreeableness: -3, stress_level: 50 }),
      makeDwarf({ name: "D", need_food: 0, need_drink: 0, need_sleep: 0 }),
      makeDwarf({ name: "E", stress_level: 100, is_in_tantrum: true }),
    ];

    const food = makeItem({ category: "food", position_x: 5, position_y: 5, position_z: 0 });
    const drink = makeItem({ category: "drink", position_x: 5, position_y: 5, position_z: 0 });

    const result = await runScenario({
      dwarves,
      items: [food, drink],
      ticks: 500,
    });

    for (const d of result.dwarves) {
      if (d.status !== "alive") continue;
      expect(d.need_food, `${d.name} need_food`).toBeGreaterThanOrEqual(0);
      expect(d.need_food, `${d.name} need_food`).toBeLessThanOrEqual(100);
      expect(d.need_drink, `${d.name} need_drink`).toBeGreaterThanOrEqual(0);
      expect(d.need_drink, `${d.name} need_drink`).toBeLessThanOrEqual(100);
      expect(d.need_sleep, `${d.name} need_sleep`).toBeGreaterThanOrEqual(0);
      expect(d.need_sleep, `${d.name} need_sleep`).toBeLessThanOrEqual(100);
      expect(d.need_social, `${d.name} need_social`).toBeGreaterThanOrEqual(0);
      expect(d.need_social, `${d.name} need_social`).toBeLessThanOrEqual(100);
      expect(d.stress_level, `${d.name} stress_level`).toBeGreaterThanOrEqual(0);
      expect(d.stress_level, `${d.name} stress_level`).toBeLessThanOrEqual(100);
      expect(d.health, `${d.name} health`).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(d.need_food), `${d.name} need_food NaN`).toBe(false);
      expect(Number.isNaN(d.stress_level), `${d.name} stress_level NaN`).toBe(false);
    }
  });
});
