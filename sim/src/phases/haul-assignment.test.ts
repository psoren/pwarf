import { describe, it, expect } from "vitest";
import { haulAssignment, findBestStockpile } from "./haul-assignment.js";
import { makeDwarf, makeItem, makeContext } from "../__tests__/test-helpers.js";
import type { StockpileTile, ItemCategory } from "@pwarf/shared";

function makeStockpileTile(
  x: number,
  y: number,
  z: number,
  opts: { accepts_categories?: ItemCategory[] | null; priority?: number } = {},
): StockpileTile {
  return {
    id: crypto.randomUUID(),
    civilization_id: "civ-1",
    x,
    y,
    z,
    accepts_categories: opts.accepts_categories ?? null,
    priority: opts.priority ?? 0,
    created_at: new Date().toISOString(),
  };
}

describe("haulAssignment", () => {
  it("creates a haul task for an idle dwarf carrying items", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const item = makeItem({ held_by_dwarf_id: dwarf.id, weight: 10, name: "Stone block" });
    const ctx = makeContext({ dwarves: [dwarf], items: [item] });

    const st = makeStockpileTile(10, 10, 0);
    ctx.state.stockpileTiles.set("10,10,0", st);

    await haulAssignment(ctx);

    const haulTasks = ctx.state.tasks.filter(t => t.task_type === "haul");
    expect(haulTasks).toHaveLength(1);
    expect(haulTasks[0].target_x).toBe(10);
    expect(haulTasks[0].target_y).toBe(10);
    expect(haulTasks[0].target_item_id).toBe(item.id);
  });

  it("does nothing when no stockpile tiles exist", async () => {
    const dwarf = makeDwarf();
    const item = makeItem({ held_by_dwarf_id: dwarf.id, weight: 10 });
    const ctx = makeContext({ dwarves: [dwarf], items: [item] });

    await haulAssignment(ctx);

    expect(ctx.state.tasks).toHaveLength(0);
  });

  it("does nothing when dwarf carries no items", async () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    const st = makeStockpileTile(10, 10, 0);
    ctx.state.stockpileTiles.set("10,10,0", st);

    await haulAssignment(ctx);

    expect(ctx.state.tasks).toHaveLength(0);
  });

  it("skips busy dwarves", async () => {
    const dwarf = makeDwarf({ current_task_id: "some-task" });
    const item = makeItem({ held_by_dwarf_id: dwarf.id, weight: 10 });
    const ctx = makeContext({ dwarves: [dwarf], items: [item] });

    const st = makeStockpileTile(10, 10, 0);
    ctx.state.stockpileTiles.set("10,10,0", st);

    await haulAssignment(ctx);

    expect(ctx.state.tasks).toHaveLength(0);
  });

  it("skips full stockpile tiles", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const carried = makeItem({ held_by_dwarf_id: dwarf.id, weight: 10 });
    // Three items already on the stockpile tile
    const onPile = [
      makeItem({ position_x: 10, position_y: 10, position_z: 0, held_by_dwarf_id: null }),
      makeItem({ position_x: 10, position_y: 10, position_z: 0, held_by_dwarf_id: null }),
      makeItem({ position_x: 10, position_y: 10, position_z: 0, held_by_dwarf_id: null }),
    ];

    const ctx = makeContext({ dwarves: [dwarf], items: [carried, ...onPile] });
    const st = makeStockpileTile(10, 10, 0);
    ctx.state.stockpileTiles.set("10,10,0", st);

    await haulAssignment(ctx);

    // No haul task created because the only stockpile tile is full
    expect(ctx.state.tasks.filter(t => t.task_type === "haul")).toHaveLength(0);
  });

  it("picks the nearest stockpile tile", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const item = makeItem({ held_by_dwarf_id: dwarf.id, weight: 10 });
    const ctx = makeContext({ dwarves: [dwarf], items: [item] });

    const far = makeStockpileTile(50, 50, 0);
    const near = makeStockpileTile(7, 7, 0);
    ctx.state.stockpileTiles.set("50,50,0", far);
    ctx.state.stockpileTiles.set("7,7,0", near);

    await haulAssignment(ctx);

    const haulTasks = ctx.state.tasks.filter(t => t.task_type === "haul");
    expect(haulTasks).toHaveLength(1);
    expect(haulTasks[0].target_x).toBe(7);
    expect(haulTasks[0].target_y).toBe(7);
  });

  it("creates haul task for ground item not on a stockpile", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const groundItem = makeItem({
      position_x: 7, position_y: 7, position_z: 0,
      held_by_dwarf_id: null,
      category: "raw_material",
      located_in_civ_id: "civ-1",
    });
    const ctx = makeContext({ dwarves: [dwarf], items: [groundItem] });

    const st = makeStockpileTile(10, 10, 0);
    ctx.state.stockpileTiles.set("10,10,0", st);

    await haulAssignment(ctx);

    const haulTasks = ctx.state.tasks.filter(t => t.task_type === "haul");
    expect(haulTasks).toHaveLength(1);
    expect(haulTasks[0].target_item_id).toBe(groundItem.id);
    expect(haulTasks[0].target_x).toBe(10);
  });

  it("skips ground items already on a stockpile tile", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const itemOnPile = makeItem({
      position_x: 10, position_y: 10, position_z: 0,
      held_by_dwarf_id: null,
      category: "raw_material",
      located_in_civ_id: "civ-1",
    });
    const ctx = makeContext({ dwarves: [dwarf], items: [itemOnPile] });

    const st = makeStockpileTile(10, 10, 0);
    ctx.state.stockpileTiles.set("10,10,0", st);

    await haulAssignment(ctx);

    const haulTasks = ctx.state.tasks.filter(t => t.task_type === "haul");
    expect(haulTasks).toHaveLength(0);
  });

  it("does not create duplicate haul tasks for the same ground item", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const groundItem = makeItem({
      position_x: 7, position_y: 7, position_z: 0,
      held_by_dwarf_id: null,
      category: "raw_material",
      located_in_civ_id: "civ-1",
    });
    const ctx = makeContext({ dwarves: [dwarf], items: [groundItem] });

    const st = makeStockpileTile(10, 10, 0);
    ctx.state.stockpileTiles.set("10,10,0", st);

    // Run twice
    await haulAssignment(ctx);
    await haulAssignment(ctx);

    const haulTasks = ctx.state.tasks.filter(t => t.task_type === "haul");
    expect(haulTasks).toHaveLength(1);
  });

  it("skips ground items from other civilizations", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const foreignItem = makeItem({
      position_x: 7, position_y: 7, position_z: 0,
      held_by_dwarf_id: null,
      category: "raw_material",
      located_in_civ_id: "other-civ",
    });
    const ctx = makeContext({ dwarves: [dwarf], items: [foreignItem] });

    const st = makeStockpileTile(10, 10, 0);
    ctx.state.stockpileTiles.set("10,10,0", st);

    await haulAssignment(ctx);

    const haulTasks = ctx.state.tasks.filter(t => t.task_type === "haul");
    expect(haulTasks).toHaveLength(0);
  });
});

describe("findBestStockpile", () => {
  it("returns null when no tiles accept the item category", () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    // Food-only stockpile, but item is raw_material
    const foodOnly = makeStockpileTile(10, 10, 0, { accepts_categories: ['food'] });
    ctx.state.stockpileTiles.set("10,10,0", foodOnly);

    const result = findBestStockpile(ctx, 5, 5, 0, 'raw_material');
    expect(result).toBeNull();
  });

  it("accepts items when accepts_categories is null (all-category stockpile)", () => {
    const ctx = makeContext({});

    const allCategories = makeStockpileTile(10, 10, 0, { accepts_categories: null });
    ctx.state.stockpileTiles.set("10,10,0", allCategories);

    const result = findBestStockpile(ctx, 5, 5, 0, 'raw_material');
    expect(result).not.toBeNull();
    expect(result?.x).toBe(10);
  });

  it("prefers higher-priority stockpile over nearer lower-priority one", () => {
    const ctx = makeContext({});

    const nearLow = makeStockpileTile(6, 6, 0, { priority: 0 });
    const farHigh = makeStockpileTile(20, 20, 0, { priority: 5 });
    ctx.state.stockpileTiles.set("6,6,0", nearLow);
    ctx.state.stockpileTiles.set("20,20,0", farHigh);

    const result = findBestStockpile(ctx, 5, 5, 0, 'raw_material');
    expect(result?.x).toBe(20);
    expect(result?.y).toBe(20);
  });

  it("breaks priority ties by distance", () => {
    const ctx = makeContext({});

    const nearSamePriority = makeStockpileTile(7, 7, 0, { priority: 2 });
    const farSamePriority = makeStockpileTile(50, 50, 0, { priority: 2 });
    ctx.state.stockpileTiles.set("7,7,0", nearSamePriority);
    ctx.state.stockpileTiles.set("50,50,0", farSamePriority);

    const result = findBestStockpile(ctx, 5, 5, 0, 'food');
    expect(result?.x).toBe(7);
  });

  it("filters by category when accepts_categories is set", () => {
    const ctx = makeContext({});

    const foodOnly = makeStockpileTile(10, 10, 0, { accepts_categories: ['food'] });
    const rawOnly = makeStockpileTile(20, 20, 0, { accepts_categories: ['raw_material'] });
    ctx.state.stockpileTiles.set("10,10,0", foodOnly);
    ctx.state.stockpileTiles.set("20,20,0", rawOnly);

    const result = findBestStockpile(ctx, 5, 5, 0, 'food');
    expect(result?.x).toBe(10);
  });
});
