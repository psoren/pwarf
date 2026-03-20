import { describe, it, expect } from "vitest";
import { generateEngravingScene } from "./engrave-scene.js";
import { createRng } from "./rng.js";

function makeEvent(overrides: Partial<import("@pwarf/shared").WorldEvent> = {}): import("@pwarf/shared").WorldEvent {
  return {
    id: "evt-1",
    world_id: "world-1",
    year: 3,
    category: "death",
    civilization_id: "civ-1",
    ruin_id: null,
    dwarf_id: "d1",
    item_id: null,
    faction_id: null,
    monster_id: null,
    description: "Urist has died of old age at 82.",
    event_data: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("generateEngravingScene", () => {
  const rng = createRng(42);

  it("returns a non-empty string", () => {
    const scene = generateEngravingScene([], rng);
    expect(scene.length).toBeGreaterThan(0);
  });

  it("returns a fallback scene when no events provided", () => {
    const scene = generateEngravingScene([], rng);
    expect(scene).toContain("depicts");
  });

  it("returns a scene referencing a death event", () => {
    const event = makeEvent({ category: "death", description: "Urist has died of old age at 82." });
    const scene = generateEngravingScene([event], rng);
    expect(scene).toContain("depicts");
    expect(scene.toLowerCase()).toContain("urist");
  });

  it("returns a scene referencing a migration event", () => {
    const event = makeEvent({ category: "migration", description: "3 new dwarves have arrived." });
    const scene = generateEngravingScene([event], rng);
    expect(scene).toContain("depicts");
    expect(scene.toLowerCase()).toContain("arrival");
  });

  it("returns a scene referencing a discovery event", () => {
    const event = makeEvent({ category: "discovery", description: "Urist has become an Expert miner." });
    const scene = generateEngravingScene([event], createRng(1));
    expect(scene).toContain("depicts");
    expect(scene.toLowerCase()).toContain("triumph");
  });

  it("works with many events without error", () => {
    const events = Array.from({ length: 20 }, (_, i) =>
      makeEvent({ id: `evt-${i}`, description: `Event number ${i}.` }),
    );
    for (let seed = 0; seed < 10; seed++) {
      const r = createRng(seed);
      const scene = generateEngravingScene(events, r);
      expect(scene.length).toBeGreaterThan(0);
    }
  });
});
