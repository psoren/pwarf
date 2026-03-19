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
  for (const method of ["delete", "eq", "gte", "lte"]) {
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
    glyph: { ch: ".", fg: "#888" },
  });

  return renderHook(() =>
    useDesignation({
      civId: "civ-1",
      zLevel: 0,
      getFortressTile,
      designatedTiles,
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
});
