import { describe, it, expect } from "vitest";
import { haulAssignment } from "./haul-assignment.js";
import { makeDwarf, makeItem, makeContext } from "../__tests__/test-helpers.js";
import type { StockpileTile } from "@pwarf/shared";

function makeStockpileTile(x: number, y: number, z: number): StockpileTile {
  return {
    id: crypto.randomUUID(),
    civilization_id: "civ-1",
    x,
    y,
    z,
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
});
