import { describe, it, expect } from "vitest";
import type { WorldEvent } from "@pwarf/shared";
import { createEmptyCachedState } from "./sim-context.js";
import { runHeadless } from "./headless-runner.js";

function makeWorldEvent(overrides?: Partial<WorldEvent>): WorldEvent {
  return {
    id: "evt-1",
    world_id: "test-world",
    year: 1,
    category: "death",
    civilization_id: null,

    dwarf_id: null,
    item_id: null,

    monster_id: null,
    description: "Something happened",
    event_data: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("runHeadless", () => {
  it("flushes pendingEvents into worldEvents and returns actionLog", async () => {
    const state = createEmptyCachedState();
    // Simulate events that would be placed in pendingEvents by phases
    // We pre-load pendingEvents so after the first tick they get flushed
    state.pendingEvents.push(
      makeWorldEvent({ id: "e1", description: "A dwarf arrived" }),
    );

    const result = await runHeadless({
      initialState: state,
      ticks: 1,
    });

    // pendingEvents should have been flushed to worldEvents
    expect(state.worldEvents.length).toBeGreaterThanOrEqual(1);
    expect(state.pendingEvents).toHaveLength(0);

    // actionLog should contain the flushed event
    expect(result.actionLog.length).toBeGreaterThanOrEqual(1);
    const arrival = result.actionLog.find(e => e.description === "A dwarf arrived");
    expect(arrival).toBeDefined();
    expect(arrival!.category).toBe("death");
  });

  it("returns empty actionLog when no events occur", async () => {
    const result = await runHeadless({
      ticks: 1,
    });

    expect(result.actionLog).toBeDefined();
    expect(Array.isArray(result.actionLog)).toBe(true);
  });

  it("includes actionLog in finalSnapshot as action_log", async () => {
    const state = createEmptyCachedState();
    state.pendingEvents.push(
      makeWorldEvent({ id: "e1", description: "Test event", category: "battle" }),
    );

    const result = await runHeadless({
      initialState: state,
      ticks: 1,
    });

    const snapshotEntry = result.finalSnapshot.action_log.find(
      e => e.description === "Test event",
    );
    expect(snapshotEntry).toBeDefined();
    expect(snapshotEntry!.category).toBe("battle");
  });
});
