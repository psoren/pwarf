/**
 * Haul-stuck scenario tests (issue investigation)
 *
 * Reproduces the bug where haul tasks get stuck at ~50% progress.
 * Suspected cause: need-satisfaction interrupts reset work_progress to 0
 * while the item remains held by the dwarf, creating a cycle where the
 * dwarf picks up → walks → partially works → gets hungry → task resets →
 * re-claims → walks again → never completes.
 */
import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeItem } from "./test-helpers.js";
import {
  WORK_HAUL,
  DRINK_DECAY_PER_TICK,
  FOOD_DECAY_PER_TICK,
  NEED_INTERRUPT_DRINK,
  NEED_INTERRUPT_FOOD,
  createFortressDeriver,
} from "@pwarf/shared";
import type { StockpileTile, Item } from "@pwarf/shared";

const fortressDeriver = createFortressDeriver(42n, "test-civ", "plains");

function makeStockpileTile(x: number, y: number, z = 0): StockpileTile {
  return {
    id: `stockpile-${x}-${y}-${z}`,
    civilization_id: "test-civ",
    x, y, z,
    accepts_categories: null,
    priority: 0,
    created_at: new Date().toISOString(),
  };
}

/** Suppress auto-brew by providing plenty of drinks */
function suppressDrinks(count = 15): Item[] {
  return Array.from({ length: count }, (_, i) =>
    makeItem({
      name: "Dwarven ale",
      category: "drink",
      material: "plant",
      position_x: 240,
      position_y: i,
      position_z: 0,
      located_in_civ_id: "test-civ",
    }),
  );
}

/** Suppress auto-cook by providing plenty of food */
function suppressAutocook(count = 15): Item[] {
  return Array.from({ length: count }, (_, i) =>
    makeItem({
      name: "Prepared meal",
      category: "food",
      material: "cooked",
      position_x: 241,
      position_y: i,
      position_z: 0,
      located_in_civ_id: "test-civ",
    }),
  );
}

describe("haul task stuck at 50%", () => {
  it("haul completes without interruption (control case)", { timeout: 30_000 }, async () => {
    // High needs → no interrupts. Item near dwarf, stockpile nearby.
    const dwarf = makeDwarf({
      position_x: 254, position_y: 256, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80,
    });
    const groundItem = makeItem({
      name: "Stone block",
      category: "raw_material",
      material: "stone",
      position_x: 256, position_y: 256, position_z: 0,
      held_by_dwarf_id: null,
      located_in_civ_id: "test-civ",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [groundItem, ...suppressDrinks(), ...suppressAutocook()],
      fortressDeriver,
      stockpileTiles: [makeStockpileTile(262, 256, 0)],
      ticks: 200,
    });

    const haulTasks = result.tasks.filter(t => t.task_type === "haul" && t.target_item_id === groundItem.id);
    const completed = haulTasks.find(t => t.status === "completed");
    expect(completed, "control: haul should complete with high needs").toBeDefined();
  });

  it("haul completes even when dwarf gets interrupted by thirst mid-delivery", { timeout: 30_000 }, async () => {
    // Start need_drink just above interrupt threshold so it triggers mid-haul.
    const dwarf = makeDwarf({
      position_x: 254, position_y: 256, position_z: 0,
      need_food: 100,
      need_drink: NEED_INTERRUPT_DRINK + 12 * DRINK_DECAY_PER_TICK,
      need_sleep: 100,
      need_social: 80,
    });
    const groundItem = makeItem({
      name: "Stone block",
      category: "raw_material",
      material: "stone",
      position_x: 256, position_y: 256, position_z: 0,
      held_by_dwarf_id: null,
      located_in_civ_id: "test-civ",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [groundItem, ...suppressDrinks(), ...suppressAutocook()],
      fortressDeriver,
      stockpileTiles: [makeStockpileTile(262, 256, 0)],
      ticks: 500,
    });

    const haulTasks = result.tasks.filter(t => t.task_type === "haul" && t.target_item_id === groundItem.id);
    const completed = haulTasks.find(t => t.status === "completed");
    expect(completed, "haul should complete even after thirst interrupt").toBeDefined();
  });

  it("haul completes even when dwarf gets interrupted by hunger mid-delivery", { timeout: 30_000 }, async () => {
    const dwarf = makeDwarf({
      position_x: 254, position_y: 256, position_z: 0,
      need_food: NEED_INTERRUPT_FOOD + 12 * FOOD_DECAY_PER_TICK,
      need_drink: 100,
      need_sleep: 100,
      need_social: 80,
    });
    const groundItem = makeItem({
      name: "Stone block",
      category: "raw_material",
      material: "stone",
      position_x: 256, position_y: 256, position_z: 0,
      held_by_dwarf_id: null,
      located_in_civ_id: "test-civ",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [groundItem, ...suppressDrinks(), ...suppressAutocook()],
      fortressDeriver,
      stockpileTiles: [makeStockpileTile(262, 256, 0)],
      ticks: 500,
    });

    const haulTasks = result.tasks.filter(t => t.task_type === "haul" && t.target_item_id === groundItem.id);
    const completed = haulTasks.find(t => t.status === "completed");
    expect(completed, "haul should complete even after hunger interrupt").toBeDefined();
  });

  it("haul completes with repeated interrupts (low needs, long distance)", { timeout: 60_000 }, async () => {
    // Worst case: needs right at threshold, long walk to stockpile.
    const dwarf = makeDwarf({
      position_x: 250, position_y: 256, position_z: 0,
      need_food: NEED_INTERRUPT_FOOD + 5 * FOOD_DECAY_PER_TICK,
      need_drink: NEED_INTERRUPT_DRINK + 5 * DRINK_DECAY_PER_TICK,
      need_sleep: 100,
      need_social: 80,
    });
    const groundItem = makeItem({
      name: "Stone block",
      category: "raw_material",
      material: "stone",
      position_x: 256, position_y: 256, position_z: 0,
      held_by_dwarf_id: null,
      located_in_civ_id: "test-civ",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [groundItem, ...suppressDrinks(), ...suppressAutocook()],
      fortressDeriver,
      stockpileTiles: [makeStockpileTile(270, 256, 0)],
      ticks: 500,
    });

    const haulTasks = result.tasks.filter(t => t.task_type === "haul" && t.target_item_id === groundItem.id);
    const completed = haulTasks.find(t => t.status === "completed");
    expect(completed, "haul should eventually complete despite repeated interrupts").toBeDefined();

    const item = result.items.find(i => i.id === groundItem.id);
    if (completed) {
      expect(item?.position_x).toBe(270);
      expect(item?.position_y).toBe(256);
    }
  });

  it("multiple dwarves can haul items without getting stuck", { timeout: 120_000 }, async () => {
    const dwarves = [
      makeDwarf({ name: "Urist", position_x: 253, position_y: 256, position_z: 0,
        need_food: 60, need_drink: 60, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Bomrek", position_x: 253, position_y: 257, position_z: 0,
        need_food: 60, need_drink: 60, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Kel", position_x: 253, position_y: 258, position_z: 0,
        need_food: 60, need_drink: 60, need_sleep: 100, need_social: 80 }),
    ];

    const groundItems = [
      makeItem({ name: "Stone block", category: "raw_material", material: "stone",
        position_x: 256, position_y: 256, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: "test-civ" }),
      makeItem({ name: "Stone block", category: "raw_material", material: "stone",
        position_x: 256, position_y: 257, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: "test-civ" }),
      makeItem({ name: "Stone block", category: "raw_material", material: "stone",
        position_x: 256, position_y: 258, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: "test-civ" }),
    ];

    const result = await runScenario({
      dwarves,
      items: [...groundItems, ...suppressDrinks(), ...suppressAutocook()],
      fortressDeriver,
      stockpileTiles: [
        makeStockpileTile(262, 256, 0),
        makeStockpileTile(262, 257, 0),
        makeStockpileTile(262, 258, 0),
      ],
      ticks: 500,
    });

    for (const item of groundItems) {
      const haulTasks = result.tasks.filter(t => t.task_type === "haul" && t.target_item_id === item.id);
      const completed = haulTasks.find(t => t.status === "completed");
      expect(completed, `haul for item ${item.id} should complete`).toBeDefined();
    }
  });

  it("dwarf carrying item from interrupted haul eventually delivers it", { timeout: 30_000 }, async () => {
    const dwarf = makeDwarf({
      position_x: 258, position_y: 256, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80,
    });
    const heldItem = makeItem({
      name: "Stone block",
      category: "raw_material",
      material: "stone",
      held_by_dwarf_id: dwarf.id,
      position_x: null, position_y: null, position_z: null,
      located_in_civ_id: "test-civ",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [heldItem, ...suppressDrinks(), ...suppressAutocook()],
      fortressDeriver,
      stockpileTiles: [makeStockpileTile(262, 256, 0)],
      ticks: 200,
    });

    const haulTasks = result.tasks.filter(t => t.task_type === "haul" && t.target_item_id === heldItem.id);
    const completed = haulTasks.find(t => t.status === "completed");
    expect(completed, "held-item haul should complete").toBeDefined();

    const item = result.items.find(i => i.id === heldItem.id);
    expect(item?.held_by_dwarf_id).toBeNull();
    expect(item?.position_x).toBe(262);
    expect(item?.position_y).toBe(256);
  });

  it("diagnostic: track haul progress over time to detect reset loops", { timeout: 60_000 }, async () => {
    const dwarf = makeDwarf({
      position_x: 254, position_y: 256, position_z: 0,
      need_food: NEED_INTERRUPT_FOOD + 8 * FOOD_DECAY_PER_TICK,
      need_drink: NEED_INTERRUPT_DRINK + 8 * DRINK_DECAY_PER_TICK,
      need_sleep: 100,
      need_social: 80,
    });
    const groundItem = makeItem({
      name: "Stone block",
      category: "raw_material",
      material: "stone",
      position_x: 256, position_y: 256, position_z: 0,
      held_by_dwarf_id: null,
      located_in_civ_id: "test-civ",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [groundItem, ...suppressDrinks(), ...suppressAutocook()],
      fortressDeriver,
      stockpileTiles: [makeStockpileTile(262, 256, 0)],
      ticks: 800,
    });

    const haulTasks = result.tasks.filter(t => t.task_type === "haul" && t.target_item_id === groundItem.id);
    const completed = haulTasks.find(t => t.status === "completed");

    const cancelled = haulTasks.filter(t => t.status === "cancelled" || t.status === "failed");
    const pending = haulTasks.filter(t => t.status === "pending" || t.status === "in_progress" || t.status === "claimed");

    if (!completed) {
      const taskInfo = haulTasks.map(t => ({
        status: t.status,
        work_progress: t.work_progress,
        work_required: t.work_required,
        assigned: t.assigned_dwarf_id,
      }));
      const itemState = result.items.find(i => i.id === groundItem.id);
      const dwarfState = result.dwarves.find(d => d.id === dwarf.id);
      console.log("DIAGNOSTIC: haul never completed after 800 ticks");
      console.log("  haul tasks:", JSON.stringify(taskInfo, null, 2));
      console.log("  item state:", JSON.stringify({
        held_by: itemState?.held_by_dwarf_id,
        pos: itemState?.position_x != null ? `${itemState.position_x},${itemState.position_y},${itemState.position_z}` : "null",
      }));
      console.log("  dwarf state:", JSON.stringify({
        pos: `${dwarfState?.position_x},${dwarfState?.position_y},${dwarfState?.position_z}`,
        current_task: dwarfState?.current_task_id,
        needs: { food: dwarfState?.need_food, drink: dwarfState?.need_drink, sleep: dwarfState?.need_sleep },
      }));
      console.log("  cancelled/failed hauls:", cancelled.length);
      console.log("  still active hauls:", pending.length);
    }

    expect(completed, "haul should complete — if this fails, the dwarf is stuck in an interrupt loop").toBeDefined();
  });
});
