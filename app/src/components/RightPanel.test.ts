import { describe, it, expect } from "vitest";
import { groupConsecutiveEvents, groupEventsByYear, causeLabel } from "./RightPanel";
import type { LiveEvent } from "../hooks/useEvents";

function makeEvent(id: string, description: string, category = "discovery", year = 1): LiveEvent {
  return { id, description, category, year, created_at: new Date().toISOString() };
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

describe("groupEventsByYear", () => {
  it("returns empty for no events", () => {
    expect(groupEventsByYear([])).toEqual([]);
  });

  it("filters out non-legend categories (year_rollup, etc.)", () => {
    const e = makeEvent("1", "Year ends", "year_rollup", 3);
    expect(groupEventsByYear([e])).toEqual([]);
  });

  it("groups significant events by year newest first", () => {
    const e1 = makeEvent("1", "A dwarf died", "death", 1);
    const e2 = makeEvent("2", "Migrants arrived", "migration", 2);
    const e3 = makeEvent("3", "Another death", "death", 1);
    const groups = groupEventsByYear([e1, e2, e3]);
    expect(groups).toHaveLength(2);
    expect(groups[0].year).toBe(2);
    expect(groups[1].year).toBe(1);
    expect(groups[1].events).toHaveLength(2);
  });

  it("includes artifact_created and discovery categories", () => {
    const e1 = makeEvent("1", "Artifact forged", "artifact_created", 5);
    const e2 = makeEvent("2", "A discovery", "discovery", 5);
    const groups = groupEventsByYear([e1, e2]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(2);
  });

  it("includes fortress_fallen category", () => {
    const e = makeEvent("1", "Fortress fallen", "fortress_fallen", 7);
    const groups = groupEventsByYear([e]);
    expect(groups).toHaveLength(1);
    expect(groups[0].year).toBe(7);
  });

  it("includes battle, monster_slain, monster_siege categories", () => {
    const e1 = makeEvent("1", "Combat erupted", "battle", 3);
    const e2 = makeEvent("2", "Goblin slain", "monster_slain", 3);
    const e3 = makeEvent("3", "Siege began", "monster_siege", 3);
    const groups = groupEventsByYear([e1, e2, e3]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(3);
  });

  it("includes trade_caravan_arrival and marriage categories", () => {
    const e1 = makeEvent("1", "Caravan arrived", "trade_caravan_arrival", 5);
    const e2 = makeEvent("2", "Dwarves married", "marriage", 5);
    const groups = groupEventsByYear([e1, e2]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(2);
  });

  it("includes artifact_lost category", () => {
    const e = makeEvent("1", "Artifact lost", "artifact_lost", 4);
    const groups = groupEventsByYear([e]);
    expect(groups).toHaveLength(1);
    expect(groups[0].year).toBe(4);
  });
});

describe("causeLabel", () => {
  it("maps known causes to short labels", () => {
    expect(causeLabel("starvation")).toBe("starved");
    expect(causeLabel("dehydration")).toBe("thirsted");
    expect(causeLabel("tantrum_spiral")).toBe("tantrum");
    expect(causeLabel("plague")).toBe("plague");
    expect(causeLabel("combat")).toBe("slain");
    expect(causeLabel("unknown")).toBe("unknown");
  });

  it("returns the raw value for unrecognized causes", () => {
    expect(causeLabel("magma")).toBe("magma");
  });
});
