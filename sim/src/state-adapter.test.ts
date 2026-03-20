import { describe, it, expect } from "vitest";
import { InMemoryStateAdapter } from "./state-adapter.js";
import { createEmptyCachedState, createTestContext } from "./sim-context.js";
import type { Task } from "@pwarf/shared";

describe("InMemoryStateAdapter", () => {
  it("loadState returns provided initial state", async () => {
    const state = createEmptyCachedState();
    state.dwarves = [];
    const adapter = new InMemoryStateAdapter(state);
    const loaded = await adapter.loadState("civ-1", "world-1");
    expect(loaded).toBe(state);
  });

  it("getWorldSeed returns null", async () => {
    const adapter = new InMemoryStateAdapter();
    expect(await adapter.getWorldSeed("world-1")).toBeNull();
  });

  it("getTerrainForCiv returns null", async () => {
    const adapter = new InMemoryStateAdapter();
    expect(await adapter.getTerrainForCiv("civ-1")).toBeNull();
  });

  it("pollNewTasks returns queued tasks and clears queue", async () => {
    const adapter = new InMemoryStateAdapter();
    const task: Task = {
      id: "t1",
      civilization_id: "civ-1",
      task_type: "mine",
      status: "pending",
      priority: 5,
      assigned_dwarf_id: null,
      target_x: 1,
      target_y: 2,
      target_z: 0,
      target_item_id: null,
      work_progress: 0,
      work_required: 100,
      created_at: new Date().toISOString(),
      completed_at: null,
    };

    adapter.queueTasks([task]);

    const result = await adapter.pollNewTasks("civ-1", new Set());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");

    // Queue should be cleared after poll
    const empty = await adapter.pollNewTasks("civ-1", new Set());
    expect(empty).toHaveLength(0);
  });

  it("pollNewTasks filters out already-known task IDs", async () => {
    const adapter = new InMemoryStateAdapter();
    const task: Task = {
      id: "t1",
      civilization_id: "civ-1",
      task_type: "mine",
      status: "pending",
      priority: 5,
      assigned_dwarf_id: null,
      target_x: 1,
      target_y: 2,
      target_z: 0,
      target_item_id: null,
      work_progress: 0,
      work_required: 100,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    adapter.queueTasks([task]);

    const result = await adapter.pollNewTasks("civ-1", new Set(["t1"]));
    expect(result).toHaveLength(0);
  });

  it("pollStockpileTiles returns empty array", async () => {
    const adapter = new InMemoryStateAdapter();
    expect(await adapter.pollStockpileTiles("civ-1")).toEqual([]);
  });

  it("flush clears dirty tracking and pending state", async () => {
    const adapter = new InMemoryStateAdapter();
    const ctx = createTestContext();
    ctx.state.dirtyDwarfIds.add("d1");
    ctx.state.dirtyItemIds.add("i1");
    ctx.state.newTasks = [{ id: "t1" } as Task];
    ctx.state.pendingEvents = [];

    await adapter.flush(ctx);

    expect(ctx.state.dirtyDwarfIds.size).toBe(0);
    expect(ctx.state.dirtyItemIds.size).toBe(0);
    expect(ctx.state.newTasks).toHaveLength(0);
  });
});
