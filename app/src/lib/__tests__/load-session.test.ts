import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSingle = vi.fn();
const mockLimit = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock("../supabase", () => {
  return {
    supabase: {
      get from() {
        return mockFrom;
      },
    },
  };
});

function setupChain() {
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ eq: mockEq, limit: mockLimit, single: mockSingle });
  mockLimit.mockReturnValue({ single: mockSingle });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupChain();
});

const { loadSession } = await import("../load-session");

describe("loadSession", () => {
  it("returns nulls when player has no world", async () => {
    mockSingle.mockResolvedValueOnce({ data: { world_id: null }, error: null });

    const result = await loadSession("user-1");

    expect(result).toEqual({ worldId: null, worldSeed: null, civId: null });
    expect(mockFrom).toHaveBeenCalledWith("players");
  });

  it("returns nulls when player row not found", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await loadSession("user-1");

    expect(result).toEqual({ worldId: null, worldSeed: null, civId: null });
  });

  it("returns worldId, seed, and civId when player has an active civilization", async () => {
    // First call: players query
    mockSingle.mockResolvedValueOnce({
      data: { world_id: "world-abc" },
      error: null,
    });
    // Promise.all: worlds query (seed) + civilizations query
    mockSingle.mockResolvedValueOnce({
      data: { seed: "12345" },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: { id: "civ-xyz" },
      error: null,
    });

    const result = await loadSession("user-1");

    expect(result).toEqual({ worldId: "world-abc", worldSeed: 12345n, civId: "civ-xyz" });
    expect(mockFrom).toHaveBeenCalledWith("worlds");
    expect(mockFrom).toHaveBeenCalledWith("civilizations");
  });

  it("returns worldId with null civId when no active civilization", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { world_id: "world-abc" },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: { seed: "99999" },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await loadSession("user-1");

    expect(result).toEqual({ worldId: "world-abc", worldSeed: 99999n, civId: null });
  });
});
