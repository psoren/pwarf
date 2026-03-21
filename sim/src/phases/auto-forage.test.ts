import { describe, it, expect } from "vitest";
import { autoForage } from "./auto-forage.js";
import { makeDwarf, makeItem, makeContext, makeMapTile } from "../__tests__/test-helpers.js";
import { MIN_FORAGE_FOOD_STOCK } from "@pwarf/shared";

function makeContextWithTiles(opts: Parameters<typeof makeContext>[0], tiles: ReturnType<typeof makeMapTile>[]) {
  const ctx = makeContext(opts);
  for (const tile of tiles) {
    ctx.state.fortressTileOverrides.set(`${tile.x},${tile.y},${tile.z}`, tile);
  }
  return ctx;
}

describe("autoForage", () => {
  it("creates a forage task when food stock is below threshold and a grass tile exists", async () => {
    const tile = makeMapTile(5, 5, 0, 'grass');
    const ctx = makeContextWithTiles({}, [tile]);

    await autoForage(ctx);

    const forageTask = ctx.state.tasks.find(t => t.task_type === 'forage');
    expect(forageTask).toBeDefined();
    expect(forageTask?.status).toBe('pending');
    expect(forageTask?.target_x).toBe(5);
    expect(forageTask?.target_y).toBe(5);
    expect(forageTask?.target_z).toBe(0);
  });

  it("creates a forage task from a tree tile", async () => {
    const tile = makeMapTile(3, 3, 0, 'tree');
    const ctx = makeContextWithTiles({}, [tile]);

    await autoForage(ctx);

    const forageTask = ctx.state.tasks.find(t => t.task_type === 'forage');
    expect(forageTask).toBeDefined();
  });

  it("does not create a forage task when food stock is at or above threshold", async () => {
    const tile = makeMapTile(5, 5, 0, 'grass');
    const food = Array.from({ length: MIN_FORAGE_FOOD_STOCK }, () =>
      makeItem({ category: 'food', held_by_dwarf_id: null }),
    );
    const ctx = makeContextWithTiles({ items: food }, [tile]);

    await autoForage(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === 'forage')).toHaveLength(0);
  });

  it("does not create a forage task when no forageable tiles exist", async () => {
    // A non-forageable tile (rock) — should not trigger foraging
    const tile = makeMapTile(5, 5, 0, 'rock');
    const ctx = makeContextWithTiles({}, [tile]);

    await autoForage(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === 'forage')).toHaveLength(0);
  });

  it("does not create a duplicate forage task when one is already pending", async () => {
    const tile = makeMapTile(5, 5, 0, 'grass');
    const ctx = makeContextWithTiles({}, [tile]);

    await autoForage(ctx);
    await autoForage(ctx); // call twice

    expect(ctx.state.tasks.filter(t => t.task_type === 'forage')).toHaveLength(1);
  });

  it("counts only unheld food items toward the stock threshold", async () => {
    const tile = makeMapTile(5, 5, 0, 'grass');
    const dwarf = makeDwarf();
    // All food is held by the dwarf — doesn't count as available stock
    const heldFood = Array.from({ length: MIN_FORAGE_FOOD_STOCK + 5 }, () =>
      makeItem({ category: 'food', held_by_dwarf_id: dwarf.id }),
    );
    const ctx = makeContextWithTiles({ dwarves: [dwarf], items: heldFood }, [tile]);

    await autoForage(ctx);

    const forageTask = ctx.state.tasks.find(t => t.task_type === 'forage');
    expect(forageTask).toBeDefined();
  });
});
