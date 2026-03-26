import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimContext } from "../sim-context.js";
import { createEmptyCachedState, createRng } from "../sim-context.js";
import { DEFAULT_TEST_SEED } from "../rng.js";
import { flushToSupabase } from "../flush-state.js";
import { makeTask, makeDwarf, makeItem } from "./test-helpers.js";

/**
 * Creates a fake Supabase client where the rpc() call returns a
 * manually-controllable promise. This lets us simulate the race
 * between the async RPC and concurrent state modifications.
 */
function createControllableSupabase() {
  let resolveRpc!: () => void;
  const rpcPromise = new Promise<{ error: null }>((resolve) => {
    resolveRpc = () => resolve({ error: null });
  });

  const flushedPayloads: Record<string, unknown>[] = [];

  const client = {
    rpc(_name: string, params: Record<string, unknown>) {
      flushedPayloads.push(params);
      return rpcPromise;
    },
  } as unknown as SupabaseClient;

  return { client, resolveRpc, flushedPayloads };
}

function createTestCtx(supabase: SupabaseClient): SimContext {
  return {
    supabase,
    civilizationId: "test-civ",
    worldId: "test-world",
    civName: "Test Fortress",
    civTileX: 0,
    civTileY: 0,
    fortressDeriver: null,
    step: 0,
    year: 1,
    day: 1,
    rng: createRng(DEFAULT_TEST_SEED),
    state: createEmptyCachedState(),
  };
}

describe("flush dirty tracking race condition", () => {
  it("preserves dirty flags for tasks modified during the RPC await", async () => {
    const { client, resolveRpc } = createControllableSupabase();
    const ctx = createTestCtx(client);
    const { state } = ctx;

    // Task T1: created before flush starts, will be included in the flush
    const t1 = makeTask("haul", {
      status: "pending",
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });
    state.tasks.push(t1);
    state.taskById.set(t1.id, t1);
    state.newTasks.push(t1);

    // Start flush — collects T1, then awaits RPC
    const flushPromise = flushToSupabase(ctx);

    // While RPC is in-flight, simulate a tick creating T2
    const t2 = makeTask("haul", {
      status: "pending",
      target_x: 6,
      target_y: 6,
      target_z: 0,
    });
    state.tasks.push(t2);
    state.taskById.set(t2.id, t2);
    state.newTasks.push(t2);

    // Also simulate T1 getting claimed during the await
    t1.status = "claimed";
    t1.assigned_dwarf_id = "some-dwarf";
    state.dirtyTaskIds.add(t1.id);

    // Resolve the RPC — flush clearing happens
    resolveRpc();
    await flushPromise;

    // T2 must still be tracked as new — it was NOT in the flush
    expect(state.newTasks.some(t => t.id === t2.id)).toBe(true);

    // T1's status change (pending→claimed) must still be dirty
    // because the flush sent T1 as 'pending', but it's now 'claimed'
    expect(state.dirtyTaskIds.has(t1.id)).toBe(true);
  });

  it("preserves dirty flags for dwarves modified during the RPC await", async () => {
    const { client, resolveRpc } = createControllableSupabase();
    const ctx = createTestCtx(client);
    const { state } = ctx;

    // Dwarf D1: dirty before flush
    const d1 = makeDwarf({ need_food: 90 });
    state.dwarves.push(d1);
    state.dirtyDwarfIds.add(d1.id);

    const flushPromise = flushToSupabase(ctx);

    // During RPC await, D1's food decays further
    d1.need_food = 85;
    state.dirtyDwarfIds.add(d1.id);

    // Also a new dwarf D2 becomes dirty
    const d2 = makeDwarf({ need_food: 70 });
    state.dwarves.push(d2);
    state.dirtyDwarfIds.add(d2.id);

    resolveRpc();
    await flushPromise;

    // D1 was re-dirtied after collection — must stay dirty
    expect(state.dirtyDwarfIds.has(d1.id)).toBe(true);

    // D2 was added during await — must stay dirty
    expect(state.dirtyDwarfIds.has(d2.id)).toBe(true);
  });

  it("preserves dirty flags for items modified during the RPC await", async () => {
    const { client, resolveRpc } = createControllableSupabase();
    const ctx = createTestCtx(client);
    const { state } = ctx;

    // Item I1: dirty before flush
    const i1 = makeItem({ position_x: 5, position_y: 5, position_z: 0 });
    state.items.push(i1);
    state.dirtyItemIds.add(i1.id);

    const flushPromise = flushToSupabase(ctx);

    // During await, I1 is picked up (position changes)
    i1.held_by_dwarf_id = "some-dwarf";
    state.dirtyItemIds.add(i1.id);

    resolveRpc();
    await flushPromise;

    // I1 was re-dirtied — must stay dirty
    expect(state.dirtyItemIds.has(i1.id)).toBe(true);
  });

  it("clears dirty flags for entities that were NOT modified during await", async () => {
    const { client, resolveRpc } = createControllableSupabase();
    const ctx = createTestCtx(client);
    const { state } = ctx;

    // Task T1: dirty before flush, NOT modified during await
    const t1 = makeTask("mine", {
      status: "pending",
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });
    state.tasks.push(t1);
    state.taskById.set(t1.id, t1);
    state.newTasks.push(t1);

    const flushPromise = flushToSupabase(ctx);

    // Don't modify anything during the await

    resolveRpc();
    await flushPromise;

    // T1 was flushed and not re-dirtied — should be cleared
    expect(state.newTasks.some(t => t.id === t1.id)).toBe(false);
    expect(state.dirtyTaskIds.has(t1.id)).toBe(false);
  });
});
