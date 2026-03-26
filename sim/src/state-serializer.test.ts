import { describe, it, expect } from "vitest";
import type { WorldEvent } from "@pwarf/shared";
import { createTestContext } from "./sim-context.js";
import { serializeState } from "./state-serializer.js";

function makeWorldEvent(overrides?: Partial<WorldEvent>): WorldEvent {
  return {
    id: "evt-1",
    world_id: "test-world",
    year: 1,
    category: "death",
    civilization_id: null,
    ruin_id: null,
    dwarf_id: null,
    item_id: null,
    faction_id: null,
    monster_id: null,
    description: "Something happened",
    event_data: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("serializeState", () => {
  it("populates action_log from worldEvents", () => {
    const ctx = createTestContext();
    ctx.state.worldEvents = [
      makeWorldEvent({ id: "e1", category: "death", description: "Urist died", event_data: { cause: "thirst" } }),
      makeWorldEvent({ id: "e2", category: "battle", description: "A goblin attacked", event_data: {} }),
    ];

    const snapshot = serializeState(ctx);

    expect(snapshot.action_log).toHaveLength(2);
    expect(snapshot.action_log[0]).toEqual({
      tick: 1,
      category: "death",
      description: "Urist died",
      details: { cause: "thirst" },
    });
    expect(snapshot.action_log[1]).toEqual({
      tick: 1,
      category: "battle",
      description: "A goblin attacked",
    });
  });

  it("caps action_log to 200 entries", () => {
    const ctx = createTestContext();
    ctx.state.worldEvents = Array.from({ length: 300 }, (_, i) =>
      makeWorldEvent({ id: `e${i}`, description: `Event ${i}` }),
    );

    const snapshot = serializeState(ctx);

    expect(snapshot.action_log).toHaveLength(200);
    // Should contain the last 200 (indices 100-299)
    expect(snapshot.action_log[0].description).toBe("Event 100");
    expect(snapshot.action_log[199].description).toBe("Event 299");
  });

  it("returns empty action_log when no worldEvents exist", () => {
    const ctx = createTestContext();
    const snapshot = serializeState(ctx);
    expect(snapshot.action_log).toEqual([]);
  });
});
