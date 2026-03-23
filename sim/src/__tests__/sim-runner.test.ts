import { describe, it, expect, vi } from "vitest";
import { SimRunner } from "../sim-runner.js";
import type { SimSnapshot } from "../sim-runner.js";
import { makeDwarf, makeContext } from "./test-helpers.js";

// Mock load-state to avoid hitting Supabase
vi.mock("../load-state.js", () => ({
  loadStateFromSupabase: vi.fn(),
}));

// Mock flush-state to avoid hitting Supabase
vi.mock("../flush-state.js", () => ({
  flushToSupabase: vi.fn(),
}));

// Minimal mock supabase client for SimRunner constructor
function mockSupabase() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { seed: "12345" }, error: null }),
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  } as never;
}

describe("SimRunner", () => {
  describe("onTick callback", () => {
    it("calls onTick with a snapshot after each tick", async () => {
      const runner = new SimRunner(mockSupabase());
      const dwarf = makeDwarf({ name: "Urist" });

      // Manually set up the context to avoid start() hitting supabase
      const ctx = makeContext({ dwarves: [dwarf] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (runner as any).ctx = ctx;

      const snapshots: SimSnapshot[] = [];
      runner.onTick = (snap) => snapshots.push(snap);

      await runner.tick();

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]!.dwarves).toHaveLength(1);
      expect(snapshots[0]!.dwarves[0]!.name).toBe("Urist");
    });

    it("does not call onTick when callback is null", async () => {
      const runner = new SimRunner(mockSupabase());
      const ctx = makeContext({ dwarves: [makeDwarf()] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (runner as any).ctx = ctx;

      runner.onTick = null;

      // Should not throw
      await runner.tick();
    });

    it("snapshot reflects current dwarf positions", async () => {
      const runner = new SimRunner(mockSupabase());
      const dwarf = makeDwarf({ position_x: 10, position_y: 20 });
      const ctx = makeContext({ dwarves: [dwarf] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (runner as any).ctx = ctx;

      let lastSnap: SimSnapshot | null = null;
      runner.onTick = (snap) => { lastSnap = snap; };

      await runner.tick();

      // Snapshot should reflect current dwarf state
      expect(lastSnap).not.toBeNull();
      expect(lastSnap!.dwarves[0]!.position_x).toBe(dwarf.position_x);
      expect(lastSnap!.dwarves[0]!.position_y).toBe(dwarf.position_y);
    });

    it("snapshot includes tasks", async () => {
      const runner = new SimRunner(mockSupabase());
      const ctx = makeContext({
        dwarves: [makeDwarf()],
        tasks: [{
          id: "task-1",
          civilization_id: "civ-1",
          task_type: "mine",
          status: "pending",
          priority: 5,
          target_x: 10,
          target_y: 20,
          target_z: 0,
          target_item_id: null,
          work_progress: 0,
          work_required: 100,
          assigned_dwarf_id: null,
          created_at: new Date().toISOString(),
          completed_at: null,
        }],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (runner as any).ctx = ctx;

      let lastSnap: SimSnapshot | null = null;
      runner.onTick = (snap) => { lastSnap = snap; };

      await runner.tick();

      expect(lastSnap!.tasks.length).toBeGreaterThanOrEqual(1);
      expect(lastSnap!.tasks.some(t => t.task_type === "mine")).toBe(true);
    });
  });
});
