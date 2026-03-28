import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimContext, CachedState } from "../sim-context.js";
import { createEmptyCachedState, createRng } from "../sim-context.js";
import { DEFAULT_TEST_SEED } from "../rng.js";
import { runTick, advanceTime, maybeYearRollup } from "../tick.js";
import { flushToSupabase } from "../flush-state.js";
import { makeDwarf, makeSkill, makeTask, makeItem, makeMapTile } from "./test-helpers.js";

// ─── Fake Supabase client that enforces FK constraints via RPC ───────────────

interface FkConstraint {
  column: string;
  referencedTable: string;
}

function createFakeSupabase() {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  const violations: string[] = [];

  const fkConstraints = new Map<string, FkConstraint[]>();
  fkConstraints.set("tasks", [
    { column: "target_item_id", referencedTable: "items" },
    { column: "assigned_dwarf_id", referencedTable: "dwarves" },
  ]);
  fkConstraints.set("dwarves", [
    { column: "current_task_id", referencedTable: "tasks" },
  ]);

  function getTable(name: string): Map<string, Record<string, unknown>> {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  }

  function upsertRows(tableName: string, rows: Record<string, unknown>[]) {
    const table = getTable(tableName);
    // Check for duplicate IDs in batch
    const idsInBatch = new Set<string>();
    for (const row of rows) {
      const id = row.id as string;
      if (idsInBatch.has(id)) {
        const msg = `duplicate id=${id} in ${tableName} batch`;
        violations.push(msg);
        return;
      }
      idsInBatch.add(id);
    }
    for (const row of rows) {
      table.set(row.id as string, { ...row });
    }
  }

  // The RPC handler simulates the flush_state function with deferred FKs.
  // All upserts happen first, then FK checks run at the end (deferred).
  function rpc(_name: string, params: Record<string, unknown>) {
    // Upsert all tables (order doesn't matter — FKs are deferred)
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
        upsertRows(table, rows);
      }
    }

    // Now check ALL FK constraints (simulates deferred constraint check at commit)
    for (const [tableName, constraints] of fkConstraints) {
      const table = getTable(tableName);
      for (const [, row] of table) {
        for (const fk of constraints) {
          const value = row[fk.column];
          if (value === null || value === undefined) continue;
          const refTable = getTable(fk.referencedTable);
          if (!refTable.has(value as string)) {
            violations.push(
              `FK violation: ${tableName}.${fk.column}=${value} not in ${fk.referencedTable}`,
            );
          }
        }
      }
    }

    return Promise.resolve({ error: violations.length > 0 ? { message: violations.join("; ") } : null });
  }

  // Stub for from() — only needed for load-state reads, not flush writes
  function from(_table: string) {
    const noop = { then: (fn: (r: { error: null }) => void) => { fn({ error: null }); return Promise.resolve(); } };
    return {
      insert: () => noop,
      upsert: () => noop,
      update: () => ({ eq: () => noop }),
    };
  }

  return {
    client: {
      from,
      rpc,
      auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
    } as unknown as SupabaseClient,
    tables,
    violations,
    getTable,
  };
}

// ─── Helper: run N ticks then flush ──────────────────────────────────────────

async function runSimWithFlush(opts: {
  ticks: number;
  flushEvery: number;
  dwarves?: ReturnType<typeof makeDwarf>[];
  skills?: ReturnType<typeof makeSkill>[];
  items?: ReturnType<typeof makeItem>[];
  tasks?: ReturnType<typeof makeTask>[];
  tiles?: ReturnType<typeof makeMapTile>[];
  seed?: number;
}) {
  const fake = createFakeSupabase();
  const state: CachedState = createEmptyCachedState();

  state.dwarves = (opts.dwarves ?? []).map(d => ({ ...d }));
  state.dwarfSkills = (opts.skills ?? []).map(s => ({ ...s }));
  state.items = (opts.items ?? []).map(i => ({ ...i }));
  state.tasks = (opts.tasks ?? []).map(t => ({ ...t }));

  if (opts.tiles) {
    for (const tile of opts.tiles) {
      state.fortressTileOverrides.set(`${tile.x},${tile.y},${tile.z}`, { ...tile });
    }
  }

  const ctx: SimContext = {
    supabase: fake.client,
    civilizationId: "test-civ",
    worldId: "test-world",
    civName: "Test Fortress",
    civTileX: 0, civTileY: 0,
    fortressDeriver: null,
    step: 0, year: 1, day: 1,
    rng: createRng(opts.seed ?? DEFAULT_TEST_SEED),
    state,
  };

  // Pre-seed DB with initial entities
  for (const d of state.dwarves) fake.getTable("dwarves").set(d.id, { ...d });
  for (const i of state.items) fake.getTable("items").set(i.id, { ...i });
  for (const s of state.structures) fake.getTable("structures").set(s.id, { ...s });

  let stepCount = 0;
  let currentYear = 1;

  for (let i = 0; i < opts.ticks; i++) {
    stepCount++;
    advanceTime(ctx, stepCount, currentYear);
    await runTick(ctx);
    currentYear = await maybeYearRollup(ctx, stepCount, currentYear);

    if (state.pendingEvents.length > 0) {
      state.worldEvents.push(...state.pendingEvents);
      state.pendingEvents = [];
    }

    if (stepCount % opts.flushEvery === 0) {
      await flushToSupabase(ctx);
    }
  }

  await flushToSupabase(ctx);

  return { violations: fake.violations, tables: fake.tables, state };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("flush FK integration", () => {
  it("no FK violations during a 500-tick sim with frequent flushes", async () => {
    const dwarf1 = makeDwarf({
      name: "Urist", position_x: 5, position_y: 5, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80,
    });
    const dwarf2 = makeDwarf({
      name: "Bomrek", position_x: 6, position_y: 5, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80,
    });

    const tiles = [
      makeMapTile(3, 5, 0, "tree"), makeMapTile(3, 6, 0, "tree"),
      makeMapTile(8, 5, 0, "rock"), makeMapTile(8, 6, 0, "rock"), makeMapTile(8, 7, 0, "rock"),
      ...Array.from({ length: 15 }, (_, x) =>
        Array.from({ length: 15 }, (_, y) => ({ x, y })),
      ).flat()
        .filter(({ x, y }) => !["3,5", "3,6", "8,5", "8,6", "8,7"].includes(`${x},${y}`))
        .map(({ x, y }) => makeMapTile(x, y, 0, "grass")),
    ];

    const result = await runSimWithFlush({
      ticks: 500, flushEvery: 10,
      dwarves: [dwarf1, dwarf2],
      skills: [
        makeSkill(dwarf1.id, "mining", 3), makeSkill(dwarf1.id, "building", 1),
        makeSkill(dwarf2.id, "building", 3), makeSkill(dwarf2.id, "mining", 1),
      ],
      items: [
        makeItem({ name: "Plump helmet", category: "food", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
        makeItem({ name: "Plump helmet", category: "food", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
        makeItem({ name: "Plump helmet brew", category: "drink", material: "plant", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
        makeItem({ name: "Plump helmet brew", category: "drink", material: "plant", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
      ],
      tasks: [
        makeTask("mine", { status: "pending", target_x: 3, target_y: 5, target_z: 0, work_required: 100, priority: 10 }),
        makeTask("mine", { status: "pending", target_x: 3, target_y: 6, target_z: 0, work_required: 100, priority: 10 }),
        makeTask("mine", { status: "pending", target_x: 8, target_y: 5, target_z: 0, work_required: 100, priority: 8 }),
        makeTask("build_floor", { status: "pending", target_x: 5, target_y: 8, target_z: 0, work_required: 25, priority: 6 }),
        makeTask("build_well", { status: "pending", target_x: 5, target_y: 11, target_z: 0, work_required: 60, priority: 5 }),
      ],
      tiles,
    });

    if (result.violations.length > 0) {
      console.error("FK violations:", result.violations);
    }
    expect(result.violations).toEqual([]);
  });

  it("no FK violations when items are rapidly created and consumed", async () => {
    const dwarf = makeDwarf({
      name: "Hungry", position_x: 5, position_y: 5, position_z: 0,
      need_food: 20, need_drink: 20, need_sleep: 100, need_social: 80,
    });

    const tiles = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => makeMapTile(x, y, 0, "grass")),
    ).flat();

    const items = [
      ...Array.from({ length: 20 }, () =>
        makeItem({ name: "Plump helmet", category: "food", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
      ),
      ...Array.from({ length: 20 }, () =>
        makeItem({ name: "Plump helmet brew", category: "drink", material: "plant", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
      ),
    ];

    const result = await runSimWithFlush({
      ticks: 300, flushEvery: 5,
      dwarves: [dwarf], skills: [], items, tasks: [], tiles,
    });

    if (result.violations.length > 0) {
      console.error("FK violations:", result.violations);
    }
    expect(result.violations).toEqual([]);
  });

  it("no FK violations with flush every single tick", async () => {
    const dwarf = makeDwarf({
      name: "Worker", position_x: 5, position_y: 5, position_z: 0,
      need_food: 50, need_drink: 50, need_sleep: 100, need_social: 80,
    });

    const tiles = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => makeMapTile(x, y, 0, "grass")),
    ).flat();

    const items = [
      ...Array.from({ length: 10 }, () =>
        makeItem({ name: "Plump helmet", category: "food", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
      ),
      ...Array.from({ length: 10 }, () =>
        makeItem({ name: "Plump helmet brew", category: "drink", material: "plant", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
      ),
    ];

    const result = await runSimWithFlush({
      ticks: 200, flushEvery: 1,
      dwarves: [dwarf], skills: [], items, tasks: [], tiles,
    });

    if (result.violations.length > 0) {
      console.error("FK violations:", result.violations);
    }
    expect(result.violations).toEqual([]);
  });
});
