import { describe, it, expect } from "vitest";
import { groupConsecutiveEvents } from "./RightPanel";
import type { LiveEvent } from "../hooks/useEvents";

function makeEvent(id: string, description: string, category = "discovery"): LiveEvent {
  return { id, description, category, created_at: new Date().toISOString() } as LiveEvent;
}

describe("groupConsecutiveEvents", () => {
  it("returns empty array for empty input", () => {
    expect(groupConsecutiveEvents([])).toEqual([]);
  });

  it("returns single group for single event", () => {
    const event = makeEvent("1", "Aban begins mine.");
    expect(groupConsecutiveEvents([event])).toEqual([{ event, count: 1 }]);
  });

  it("merges consecutive identical descriptions", () => {
    const a = makeEvent("1", "Aban begins mine.");
    const b = makeEvent("2", "Aban begins mine.");
    const c = makeEvent("3", "Aban begins mine.");
    const groups = groupConsecutiveEvents([a, b, c]);
    expect(groups).toHaveLength(1);
    expect(groups[0].event).toBe(a);
    expect(groups[0].count).toBe(3);
  });

  it("does not merge non-consecutive duplicates", () => {
    const a = makeEvent("1", "Aban begins mine.");
    const b = makeEvent("2", "Aban has finished mine.");
    const c = makeEvent("3", "Aban begins mine.");
    const groups = groupConsecutiveEvents([a, b, c]);
    expect(groups).toHaveLength(3);
    expect(groups[0].count).toBe(1);
    expect(groups[1].count).toBe(1);
    expect(groups[2].count).toBe(1);
  });

  it("preserves the first event in each group", () => {
    const a = makeEvent("1", "Aban begins mine.");
    const b = makeEvent("2", "Aban begins mine.");
    const groups = groupConsecutiveEvents([a, b]);
    expect(groups[0].event.id).toBe("1");
  });

  it("handles mixed runs correctly", () => {
    const events = [
      makeEvent("1", "A"),
      makeEvent("2", "A"),
      makeEvent("3", "B"),
      makeEvent("4", "B"),
      makeEvent("5", "B"),
      makeEvent("6", "C"),
    ];
    const groups = groupConsecutiveEvents(events);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toEqual({ event: events[0], count: 2 });
    expect(groups[1]).toEqual({ event: events[2], count: 3 });
    expect(groups[2]).toEqual({ event: events[5], count: 1 });
  });
});
