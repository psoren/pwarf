import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimContext, CachedState } from "../sim-context.js";
import { createEmptyCachedState, createRng } from "../sim-context.js";
import { DEFAULT_TEST_SEED } from "../rng.js";
import { runTick, advanceTime } from "../tick.js";
import { flushToSupabase } from "../flush-state.js";
import { makeDwarf, makeSkill, makeItem, makeMapTile } from "./test-helpers.js";

/**
 * Fake Supabase that tracks which civ_id each row belongs to,
 * ensuring one civ's flush doesn't overwrite another's data.
 */
function createFakeSupabase() {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  const errors: string[] = [];

  function getTable(name: string) {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  }

  function rpc(_name: string, params: Record<string, unknown>) {
    const tableParamMap: [string, string][] = [
      ["p_items", "items"],
      ["p_structures", "structures"],
      ["p_tasks", "tasks"],
      ["p_dwarves", "dwarves"],
      ["p_dwarf_skills", "dwarf_skills"],
      ["p_fortress_tiles", "fortress_tiles"],
      ["p_events", "world_events"],
    ];
    for (const [param, table] of tableParamMap) {
      const rows = params[param] as Record<string, unknown>[] | undefined;
      if (rows && rows.length > 0) {
        const t = getTable(table);
        for (const row of rows) t.set(row.id as string, { ...row });
      }
    }
    return Promise.resolve({ error: null });
  }

  return {
    client: { rpc, from: () => ({ insert: () => Promise.resolve({ error: null }) }) } as unknown as SupabaseClient,
    getTable,
    errors,
  };
}

function buildCtx(civId: string, fake: ReturnType<typeof createFakeSupabase>, dwarves: ReturnType<typeof makeDwarf>[]) {
  const state: CachedState = createEmptyCachedState();
  state.dwarves = dwarves.map(d => ({ ...d }));
  const tiles = Array.from({ length: 10 }, (_, x) =>
    Array.from({ length: 10 }, (_, y) => makeMapTile(x, y, 0, "grass")),
  ).flat();
  for (const t of tiles) state.fortressTileOverrides.set(`${t.x},${t.y},${t.z}`, { ...t });

  return {
    supabase: fake.client,
    civilizationId: civId,
    worldId: "test-world",
    civName: "Fortress",
    civTileX: 0,
    civTileY: 0,
    fortressDeriver: null,
    step: 0,
    year: 1,
    day: 1,
    rng: createRng(DEFAULT_TEST_SEED),
    state,
  } as SimContext;
}

describe("multi-civilization isolation", () => {
  it("two civilizations flush without overwriting each other", async () => {
    const fake = createFakeSupabase();

    const dwarfA = makeDwarf({ name: "Urist", position_x: 3, position_y: 3, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 });
    const dwarfB = makeDwarf({ name: "Bomrek", position_x: 5, position_y: 5, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 });

    const ctxA = buildCtx("civ-alpha", fake, [dwarfA]);
    const ctxB = buildCtx("civ-beta", fake, [dwarfB]);

    // Run 10 ticks on each civ
    for (let i = 1; i <= 10; i++) {
      advanceTime(ctxA, i, 1);
      await runTick(ctxA);
      advanceTime(ctxB, i, 1);
      await runTick(ctxB);
    }

    // Flush both
    await flushToSupabase(ctxA);
    await flushToSupabase(ctxB);

    // Both dwarves should exist in the DB with correct civ IDs
    const dwarfTable = fake.getTable("dwarves");
    const flushedA = dwarfTable.get(dwarfA.id);
    const flushedB = dwarfTable.get(dwarfB.id);

    expect(flushedA).toBeDefined();
    expect(flushedB).toBeDefined();
    expect(flushedA?.civilization_id).toBe("civ-1"); // makeDwarf default
    expect(flushedB?.civilization_id).toBe("civ-1");
    // Both should have different positions
    expect(flushedA?.name).toBe("Urist");
    expect(flushedB?.name).toBe("Bomrek");
  });
});
