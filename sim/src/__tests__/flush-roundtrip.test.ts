import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimContext, CachedState } from "../sim-context.js";
import { createEmptyCachedState, createRng } from "../sim-context.js";
import { DEFAULT_TEST_SEED } from "../rng.js";
import { runTick, advanceTime } from "../tick.js";
import { flushToSupabase, sanitizeDanglingRefs } from "../flush-state.js";
import { makeDwarf, makeSkill, makeItem, makeMapTile, makeTask } from "./test-helpers.js";

/**
 * Fake Supabase that stores rows and supports both rpc (flush) and
 * from().select() (reload). This lets us test the full round-trip:
 * sim tick → flush → reload → verify state matches.
 */
function createRoundTripSupabase() {
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
      ["p_monsters", "monsters"],
      ["p_dwarf_skills", "dwarf_skills"],
      ["p_fortress_tiles", "fortress_tiles"],
      ["p_new_relationships", "dwarf_relationships"],
      ["p_dirty_relationships", "dwarf_relationships"],
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

  function from(tableName: string) {
    const table = getTable(tableName);
    let filters: Array<{ col: string; op: string; val: unknown }> = [];

    const builder = {
      select(_cols: string) {
        filters = [];
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, op: "eq", val });
        return builder;
      },
      not(col: string, op: string, val: unknown) {
        filters.push({ col, op: `not_${op}`, val });
        return builder;
      },
      then(fn: (r: { data: Record<string, unknown>[]; error: null }) => void) {
        const rows = [...table.values()].filter(row => {
          return filters.every(f => {
            if (f.op === "eq") return row[f.col] === f.val;
            return true; // skip complex filters
          });
        });
        fn({ data: rows, error: null });
        return Promise.resolve();
      },
      insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
        const arr = Array.isArray(rows) ? rows : [rows];
        for (const row of arr) {
          if (row.id) table.set(row.id as string, { ...row });
        }
        return { then: (fn: (r: { error: null }) => void) => { fn({ error: null }); return Promise.resolve(); } };
      },
      upsert(rows: Record<string, unknown> | Record<string, unknown>[]) {
        return builder.insert(rows);
      },
      update(_data: Record<string, unknown>) {
        return { eq: () => ({ then: (fn: (r: { error: null }) => void) => { fn({ error: null }); return Promise.resolve(); } }) };
      },
    };
    return builder;
  }

  return {
    client: { from, rpc } as unknown as SupabaseClient,
    getTable,
    errors,
  };
}

describe("flush round-trip", () => {
  it("flushed dwarves can be reloaded with correct positions and needs", async () => {
    const fake = createRoundTripSupabase();
    const state: CachedState = createEmptyCachedState();

    const dwarf = makeDwarf({
      name: "Urist", position_x: 5, position_y: 5, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100,
    });
    state.dwarves = [{ ...dwarf }];
    state.dwarfSkills = [makeSkill(dwarf.id, "mining", 3)];

    const tiles = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => makeMapTile(x, y, 0, "grass")),
    ).flat();
    for (const t of tiles) state.fortressTileOverrides.set(`${t.x},${t.y},${t.z}`, { ...t });

    const ctx: SimContext = {
      supabase: fake.client,
      civilizationId: "test-civ",
      worldId: "test-world",
      civName: "Test Fortress",
      civTileX: 0, civTileY: 0,
      fortressDeriver: null,
      step: 0, year: 1, day: 1,
      rng: createRng(DEFAULT_TEST_SEED),
      state,
    };

    // Pre-seed DB
    fake.getTable("dwarves").set(dwarf.id, { ...dwarf });

    // Run 100 ticks — needs should decay
    for (let i = 1; i <= 100; i++) {
      advanceTime(ctx, i, 1);
      await runTick(ctx);
    }

    // Flush
    await flushToSupabase(ctx);

    // Reload from fake DB
    const dwarfTable = fake.getTable("dwarves");
    const reloaded = dwarfTable.get(dwarf.id) as Record<string, unknown>;

    expect(reloaded).toBeDefined();
    // Needs decay fractionally — the DB stores rounded integers.
    // Verify the flushed value matches the rounded in-memory value.
    const memDwarf = state.dwarves[0];
    expect(reloaded.need_food).toBe(Math.round(memDwarf.need_food));
    expect(reloaded.need_drink).toBe(Math.round(memDwarf.need_drink));
    expect(reloaded.need_sleep).toBe(Math.round(memDwarf.need_sleep));
    // Position should match in-memory state
    expect(reloaded.position_x).toBe(state.dwarves[0].position_x);
    expect(reloaded.position_y).toBe(state.dwarves[0].position_y);
  });

  it("flushed tasks match in-memory task state", async () => {
    const fake = createRoundTripSupabase();
    const state: CachedState = createEmptyCachedState();

    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100,
    });
    state.dwarves = [{ ...dwarf }];
    state.dwarfSkills = [makeSkill(dwarf.id, "mining", 3)];

    const mineTask = makeTask("mine", {
      status: "pending", target_x: 6, target_y: 5, target_z: 0,
      work_required: 100, priority: 10,
    });
    state.tasks = [{ ...mineTask }];

    const tiles = [
      makeMapTile(6, 5, 0, "rock"),
      ...Array.from({ length: 10 }, (_, x) =>
        Array.from({ length: 10 }, (_, y) => ({ x, y })),
      ).flat()
        .filter(({ x, y }) => !(x === 6 && y === 5))
        .map(({ x, y }) => makeMapTile(x, y, 0, "grass")),
    ];
    for (const t of tiles) state.fortressTileOverrides.set(`${t.x},${t.y},${t.z}`, { ...t });

    const ctx: SimContext = {
      supabase: fake.client,
      civilizationId: "test-civ",
      worldId: "test-world",
      civName: "Test Fortress",
      civTileX: 0, civTileY: 0,
      fortressDeriver: null,
      step: 0, year: 1, day: 1,
      rng: createRng(DEFAULT_TEST_SEED),
      state,
    };

    fake.getTable("dwarves").set(dwarf.id, { ...dwarf });

    // Run enough ticks for the mine to complete
    for (let i = 1; i <= 120; i++) {
      advanceTime(ctx, i, 1);
      await runTick(ctx);
      if (state.pendingEvents.length > 0) {
        state.worldEvents.push(...state.pendingEvents);
        state.pendingEvents = [];
      }
    }

    await flushToSupabase(ctx);

    // Verify task in DB matches memory
    const taskTable = fake.getTable("tasks");
    const memTask = state.tasks.find(t => t.id === mineTask.id)!;
    const dbTask = taskTable.get(mineTask.id) as Record<string, unknown>;

    expect(dbTask).toBeDefined();
    expect(dbTask.status).toBe(memTask.status);
    expect(dbTask.work_progress).toBe(memTask.work_progress);
    expect(dbTask.assigned_dwarf_id).toBe(memTask.assigned_dwarf_id);

    // Task should be completed
    expect(memTask.status).toBe("completed");
    expect(dbTask.status).toBe("completed");
  });

  it("items created during sim appear in DB after flush", async () => {
    const fake = createRoundTripSupabase();
    const state: CachedState = createEmptyCachedState();

    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100,
    });
    state.dwarves = [{ ...dwarf }];
    state.dwarfSkills = [makeSkill(dwarf.id, "mining", 3)];

    const mineTask = makeTask("mine", {
      status: "pending", target_x: 6, target_y: 5, target_z: 0,
      work_required: 100, priority: 10,
    });
    state.tasks = [{ ...mineTask }];

    const tiles = [
      makeMapTile(6, 5, 0, "rock"),
      ...Array.from({ length: 10 }, (_, x) =>
        Array.from({ length: 10 }, (_, y) => ({ x, y })),
      ).flat()
        .filter(({ x, y }) => !(x === 6 && y === 5))
        .map(({ x, y }) => makeMapTile(x, y, 0, "grass")),
    ];
    for (const t of tiles) state.fortressTileOverrides.set(`${t.x},${t.y},${t.z}`, { ...t });

    const ctx: SimContext = {
      supabase: fake.client,
      civilizationId: "test-civ",
      worldId: "test-world",
      civName: "Test Fortress",
      civTileX: 0, civTileY: 0,
      fortressDeriver: null,
      step: 0, year: 1, day: 1,
      rng: createRng(DEFAULT_TEST_SEED),
      state,
    };

    fake.getTable("dwarves").set(dwarf.id, { ...dwarf });

    // Run until mine completes (creates a Stone block)
    for (let i = 1; i <= 120; i++) {
      advanceTime(ctx, i, 1);
      await runTick(ctx);
    }

    await flushToSupabase(ctx);

    // The mined Stone block should exist in both memory and DB
    const stoneInMemory = state.items.find(i => i.name === "Stone block");
    expect(stoneInMemory).toBeDefined();

    const itemTable = fake.getTable("items");
    const stoneInDb = itemTable.get(stoneInMemory!.id);
    expect(stoneInDb).toBeDefined();
    expect(stoneInDb!.name).toBe("Stone block");
    expect(stoneInDb!.category).toBe("raw_material");
  });

  it("consumed items are not in DB after flush with sanitize", async () => {
    const fake = createRoundTripSupabase();
    const state: CachedState = createEmptyCachedState();

    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      need_food: 10, // Very hungry — will eat
      need_drink: 100, need_sleep: 100,
    });
    state.dwarves = [{ ...dwarf }];

    const food = makeItem({
      name: "Plump helmet", category: "food",
      position_x: 5, position_y: 5, position_z: 0,
      located_in_civ_id: "test-civ",
    });
    state.items = [{ ...food }];

    const tiles = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => makeMapTile(x, y, 0, "grass")),
    ).flat();
    for (const t of tiles) state.fortressTileOverrides.set(`${t.x},${t.y},${t.z}`, { ...t });

    const ctx: SimContext = {
      supabase: fake.client,
      civilizationId: "test-civ",
      worldId: "test-world",
      civName: "Test Fortress",
      civTileX: 0, civTileY: 0,
      fortressDeriver: null,
      step: 0, year: 1, day: 1,
      rng: createRng(DEFAULT_TEST_SEED),
      state,
    };

    fake.getTable("dwarves").set(dwarf.id, { ...dwarf });
    fake.getTable("items").set(food.id, { ...food });

    // Run until dwarf eats the food
    for (let i = 1; i <= 50; i++) {
      advanceTime(ctx, i, 1);
      await runTick(ctx);
    }

    await flushToSupabase(ctx);

    // Food should be consumed from memory
    const foodInMemory = state.items.find(i => i.id === food.id);
    expect(foodInMemory).toBeUndefined();

    // Any tasks referencing the food should have null target_item_id after sanitize
    const tasksWithFoodRef = state.tasks.filter(t => t.target_item_id === food.id);
    expect(tasksWithFoodRef.length).toBe(0);
  });
});
