// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { FortressViewTile } from "../useFortressTiles";

// --- Supabase mock ---
// Track all calls for assertions
const calls: Array<{ method: string; args: unknown[] }> = [];
let deleteResult = { error: null as { message: string } | null };

function makeChain(): Record<string, (...args: unknown[]) => unknown> {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["delete", "eq", "gte", "lte", "in", "like"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return { ...chain, then: (resolve: (v: unknown) => void) => resolve(deleteResult) };
    };
  }
  return chain;
}

const mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    get from() {
      return mockFrom;
    },
  },
}));

function setupDeleteChain(result: { error: { message: string } | null } = { error: null }) {
  deleteResult = result;
  mockFrom.mockReturnValue(makeChain());
}

function setupInsertChain(result = { error: null }) {
  mockFrom.mockReturnValue({ insert: mockInsert });
  mockInsert.mockResolvedValue(result);
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  deleteResult = { error: null };
});

const { useDesignation } = await import("../useDesignation");

function makeHook(overrides: Partial<Parameters<typeof useDesignation>[0]> = {}) {
  const designatedTiles = new Map<string, string>();
  const getFortressTile = (): FortressViewTile | null => ({
    tileType: "stone",
    material: null,
    x: 0,
    y: 0,
    z: 0,
    isRevealed: false,
    isMined: false,
  });

  return renderHook(() =>
    useDesignation({
      civId: "civ-1",
      zLevel: 0,
      getFortressTile,
      designatedTiles,
      addOptimistic: () => {},
      ...overrides,
    }),
  );
}

function findCall(method: string, argPrefix: string) {
  return calls.find((c) => c.method === method && c.args[0] === argPrefix);
}

describe("useDesignation", () => {
  describe("handleCancelArea", () => {
    it("deletes pending tasks in the specified rectangle", async () => {
      setupDeleteChain();
      const { result } = makeHook();

      await act(async () => {
        await result.current.handleCancelArea(10, 20, 15, 25);
      });

      expect(mockFrom).toHaveBeenCalledWith("tasks");
      expect(calls.some((c) => c.method === "delete")).toBe(true);
      expect(findCall("eq", "civilization_id")?.args[1]).toBe("civ-1");
      expect(findCall("eq", "status")?.args[1]).toBe("pending");
      expect(findCall("eq", "target_z")?.args[1]).toBe(0);
      expect(findCall("gte", "target_x")?.args[1]).toBe(10);
      expect(findCall("lte", "target_x")?.args[1]).toBe(15);
      expect(findCall("gte", "target_y")?.args[1]).toBe(20);
      expect(findCall("lte", "target_y")?.args[1]).toBe(25);
    });

    it("does nothing when civId is null", async () => {
      setupDeleteChain();
      const { result } = makeHook({ civId: null });

      await act(async () => {
        await result.current.handleCancelArea(10, 20, 15, 25);
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("uses current zLevel", async () => {
      setupDeleteChain();
      const { result } = makeHook({ zLevel: -3 });

      await act(async () => {
        await result.current.handleCancelArea(0, 0, 5, 5);
      });

      expect(findCall("eq", "target_z")?.args[1]).toBe(-3);
    });

    it("logs error on failure", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      setupDeleteChain({ error: { message: "RLS blocked" } });
      const { result } = makeHook();

      await act(async () => {
        await result.current.handleCancelArea(0, 0, 5, 5);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[designate] Failed to cancel tasks:",
        "RLS blocked",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("handleDesignateArea", () => {
    it("inserts tasks for mineable tiles when in mine mode", async () => {
      setupInsertChain();
      const { result } = makeHook();

      act(() => {
        result.current.toggleMine();
      });

      await act(async () => {
        await result.current.handleDesignateArea(5, 5, 6, 5);
      });

      expect(mockFrom).toHaveBeenCalledWith("tasks");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            civilization_id: "civ-1",
            task_type: "mine",
            status: "pending",
            target_x: 5,
            target_y: 5,
            target_z: 0,
          }),
        ]),
      );
    });

    it("does nothing when designation mode is none", async () => {
      setupInsertChain();
      const { result } = makeHook();

      await act(async () => {
        await result.current.handleDesignateArea(5, 5, 6, 5);
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("skips already-designated tiles", async () => {
      setupInsertChain();
      const designatedTiles = new Map([["5,5", "mine"]]);
      const { result } = makeHook({ designatedTiles });

      act(() => {
        result.current.toggleMine();
      });

      await act(async () => {
        await result.current.handleDesignateArea(5, 5, 5, 5);
      });

      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("deconstruct cancels pending builds (fix #512)", () => {
    it("cancels a pending build task when deconstructing that tile", async () => {
      setupDeleteChain();
      const designatedTiles = new Map([["5,5", "build_bed"]]);
      const { result } = makeHook({ designatedTiles });

      act(() => { result.current.toggleDeconstruct(); });
      await act(async () => {
        await result.current.handleDesignateArea(5, 5, 5, 5);
      });

      // Should have called delete on tasks table
      expect(mockFrom).toHaveBeenCalledWith("tasks");
      expect(calls.some((c) => c.method === "delete")).toBe(true);
      expect(findCall("eq", "target_x")?.args[1]).toBe(5);
      expect(findCall("eq", "target_y")?.args[1]).toBe(5);
      const inCall = findCall("in", "task_type");
      expect(inCall).toBeTruthy();
      expect((inCall?.args[1] as string[]).every((t) => t.startsWith("build_"))).toBe(true);
    });

    it("does not cancel non-build tasks when deconstructing", async () => {
      setupDeleteChain();
      const designatedTiles = new Map([["5,5", "mine"]]);
      const { result } = makeHook({ designatedTiles });

      act(() => { result.current.toggleDeconstruct(); });
      await act(async () => {
        await result.current.handleDesignateArea(5, 5, 5, 5);
      });

      // Should not have called any DB operation (mine task is not build_*)
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe("optimistic tile clearing (fix #348)", () => {
    it("shows optimistic tile immediately after designation", async () => {
      setupInsertChain();
      const { result } = makeHook();

      act(() => { result.current.toggleMine(); });
      await act(async () => {
        await result.current.handleDesignateArea(2, 3, 2, 3);
      });

      expect(result.current.optimisticTiles.has("2,3")).toBe(true);
    });

    it("keeps optimistic tile when designatedTiles ref changes but key is absent", async () => {
      setupInsertChain();
      const empty1 = new Map<string, string>();
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useDesignation>[0]) => useDesignation(props),
        { initialProps: { civId: "civ-1", zLevel: 0, getFortressTile: () => ({ tileType: "stone", material: null, x: 2, y: 3, z: 0, isRevealed: false, isMined: false }), designatedTiles: empty1, addOptimistic: () => {} } },
      );

      act(() => { result.current.toggleMine(); });
      await act(async () => {
        await result.current.handleDesignateArea(2, 3, 2, 3);
      });

      expect(result.current.optimisticTiles.has("2,3")).toBe(true);

      // Sim tick: new reference, key still absent — optimistic tile must survive
      const empty2 = new Map<string, string>();
      rerender({ civId: "civ-1", zLevel: 0, getFortressTile: () => ({ tileType: "stone", material: null, x: 2, y: 3, z: 0, isRevealed: false, isMined: false }), designatedTiles: empty2, addOptimistic: () => {} });

      expect(result.current.optimisticTiles.has("2,3")).toBe(true);
    });

    it("removes optimistic tile once its key appears in designatedTiles", async () => {
      setupInsertChain();
      const getFortressTile = () => ({ tileType: "stone" as const, material: null, x: 2, y: 3, z: 0, isRevealed: false, isMined: false });
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useDesignation>[0]) => useDesignation(props),
        { initialProps: { civId: "civ-1", zLevel: 0, getFortressTile, designatedTiles: new Map<string, string>(), addOptimistic: () => {} } },
      );

      act(() => { result.current.toggleMine(); });
      await act(async () => {
        await result.current.handleDesignateArea(2, 3, 2, 3);
      });

      expect(result.current.optimisticTiles.has("2,3")).toBe(true);

      // Real data arrives with the key
      const realData = new Map([["2,3", "mine"]]);
      await act(async () => {
        rerender({ civId: "civ-1", zLevel: 0, getFortressTile, designatedTiles: realData, addOptimistic: () => {} });
      });

      expect(result.current.optimisticTiles.has("2,3")).toBe(false);
    });
  });

  describe("optimistic tiles z-level filtering (fix #513)", () => {
    it("does not show surface optimistic tiles when viewing caves", async () => {
      setupInsertChain();
      const getFortressTile = () => ({ tileType: "stone" as const, material: null, x: 2, y: 3, z: 0, isRevealed: false, isMined: false });
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useDesignation>[0]) => useDesignation(props),
        { initialProps: { civId: "civ-1", zLevel: 0, getFortressTile, designatedTiles: new Map<string, string>(), addOptimistic: () => {} } },
      );

      // Designate on surface (z=0)
      act(() => { result.current.toggleMine(); });
      await act(async () => {
        await result.current.handleDesignateArea(2, 3, 2, 3);
      });

      expect(result.current.optimisticTiles.has("2,3")).toBe(true);

      // Switch to cave view (z=-1) — optimistic tile should NOT appear
      await act(async () => {
        rerender({ civId: "civ-1", zLevel: -1, getFortressTile, designatedTiles: new Map<string, string>(), addOptimistic: () => {} });
      });

      expect(result.current.optimisticTiles.has("2,3")).toBe(false);
    });

    it("shows optimistic tile again when switching back to original z-level", async () => {
      setupInsertChain();
      const getFortressTile = () => ({ tileType: "stone" as const, material: null, x: 2, y: 3, z: 0, isRevealed: false, isMined: false });
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useDesignation>[0]) => useDesignation(props),
        { initialProps: { civId: "civ-1", zLevel: 0, getFortressTile, designatedTiles: new Map<string, string>(), addOptimistic: () => {} } },
      );

      // Designate on surface (z=0)
      act(() => { result.current.toggleMine(); });
      await act(async () => {
        await result.current.handleDesignateArea(2, 3, 2, 3);
      });

      // Switch to caves then back to surface
      await act(async () => {
        rerender({ civId: "civ-1", zLevel: -1, getFortressTile, designatedTiles: new Map<string, string>(), addOptimistic: () => {} });
      });
      await act(async () => {
        rerender({ civId: "civ-1", zLevel: 0, getFortressTile, designatedTiles: new Map<string, string>(), addOptimistic: () => {} });
      });

      expect(result.current.optimisticTiles.has("2,3")).toBe(true);
    });
  });
});
