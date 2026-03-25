import { describe, it, expect } from "vitest";
import { findAvailableWorkshop, findItemsNearWorkshop } from "./workshop-utils.js";
import { makeItem, makeStructure, makeContext } from "./__tests__/test-helpers.js";
import { WORKSHOP_INGREDIENT_RADIUS } from "@pwarf/shared";

// ---------------------------------------------------------------------------
// findAvailableWorkshop
// ---------------------------------------------------------------------------

describe("findAvailableWorkshop", () => {
  it("returns the first complete, unoccupied workshop of the given type", () => {
    const still = makeStructure({
      type: "still",
      civilization_id: "civ-1",
      completion_pct: 100,
      occupied_by_dwarf_id: null,
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });
    const ctx = makeContext({ structures: [still] });

    const result = findAvailableWorkshop(ctx.state, "still", "civ-1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe(still.id);
  });

  it("skips occupied workshops", () => {
    const still = makeStructure({
      type: "still",
      civilization_id: "civ-1",
      completion_pct: 100,
      occupied_by_dwarf_id: "some-dwarf",
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });
    const ctx = makeContext({ structures: [still] });

    const result = findAvailableWorkshop(ctx.state, "still", "civ-1");
    expect(result).toBeNull();
  });

  it("skips incomplete workshops (completion_pct < 100)", () => {
    const still = makeStructure({
      type: "still",
      civilization_id: "civ-1",
      completion_pct: 50,
      occupied_by_dwarf_id: null,
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });
    const ctx = makeContext({ structures: [still] });

    const result = findAvailableWorkshop(ctx.state, "still", "civ-1");
    expect(result).toBeNull();
  });

  it("returns null when no workshop of that type exists", () => {
    const bed = makeStructure({
      type: "bed",
      civilization_id: "civ-1",
      completion_pct: 100,
      occupied_by_dwarf_id: null,
    });
    const ctx = makeContext({ structures: [bed] });

    const result = findAvailableWorkshop(ctx.state, "still", "civ-1");
    expect(result).toBeNull();
  });

  it("skips workshops belonging to a different civilization", () => {
    const still = makeStructure({
      type: "still",
      civilization_id: "other-civ",
      completion_pct: 100,
      occupied_by_dwarf_id: null,
    });
    const ctx = makeContext({ structures: [still] });

    const result = findAvailableWorkshop(ctx.state, "still", "civ-1");
    expect(result).toBeNull();
  });

  it("returns the first available when multiple workshops exist, skipping occupied ones", () => {
    const occupied = makeStructure({
      type: "still",
      civilization_id: "civ-1",
      completion_pct: 100,
      occupied_by_dwarf_id: "some-dwarf",
      position_x: 1,
      position_y: 1,
      position_z: 0,
    });
    const available = makeStructure({
      type: "still",
      civilization_id: "civ-1",
      completion_pct: 100,
      occupied_by_dwarf_id: null,
      position_x: 3,
      position_y: 3,
      position_z: 0,
    });
    const ctx = makeContext({ structures: [occupied, available] });

    const result = findAvailableWorkshop(ctx.state, "still", "civ-1");
    expect(result?.id).toBe(available.id);
  });
});

// ---------------------------------------------------------------------------
// findItemsNearWorkshop
// ---------------------------------------------------------------------------

describe("findItemsNearWorkshop", () => {
  it("returns items within radius on the same z-level", () => {
    const items = [
      makeItem({
        category: "raw_material",
        material: "plant",
        position_x: 5,
        position_y: 5,
        position_z: 0,
        held_by_dwarf_id: null,
      }),
    ];

    // Workshop at (5, 5, 0) — item is at distance 0
    const result = findItemsNearWorkshop(items, 5, 5, 0, "raw_material", "plant");
    expect(result).toHaveLength(1);
  });

  it("returns items exactly at the radius boundary", () => {
    const items = [
      makeItem({
        category: "raw_material",
        material: "plant",
        position_x: 5 + WORKSHOP_INGREDIENT_RADIUS,
        position_y: 5,
        position_z: 0,
        held_by_dwarf_id: null,
      }),
    ];

    const result = findItemsNearWorkshop(items, 5, 5, 0, "raw_material", "plant");
    expect(result).toHaveLength(1);
  });

  it("excludes items beyond the radius", () => {
    const items = [
      makeItem({
        category: "raw_material",
        material: "plant",
        position_x: 5 + WORKSHOP_INGREDIENT_RADIUS + 1,
        position_y: 5,
        position_z: 0,
        held_by_dwarf_id: null,
      }),
    ];

    const result = findItemsNearWorkshop(items, 5, 5, 0, "raw_material", "plant");
    expect(result).toHaveLength(0);
  });

  it("excludes items held by a dwarf", () => {
    const items = [
      makeItem({
        category: "raw_material",
        material: "plant",
        position_x: 5,
        position_y: 5,
        position_z: 0,
        held_by_dwarf_id: "some-dwarf",
      }),
    ];

    const result = findItemsNearWorkshop(items, 5, 5, 0, "raw_material", "plant");
    expect(result).toHaveLength(0);
  });

  it("filters by category", () => {
    const items = [
      makeItem({
        category: "food",
        position_x: 5,
        position_y: 5,
        position_z: 0,
        held_by_dwarf_id: null,
      }),
    ];

    const result = findItemsNearWorkshop(items, 5, 5, 0, "raw_material");
    expect(result).toHaveLength(0);
  });

  it("filters by material when specified", () => {
    const items = [
      makeItem({
        category: "raw_material",
        material: "stone",
        position_x: 5,
        position_y: 5,
        position_z: 0,
        held_by_dwarf_id: null,
      }),
    ];

    const result = findItemsNearWorkshop(items, 5, 5, 0, "raw_material", "plant");
    expect(result).toHaveLength(0);
  });

  it("returns all matching items without material filter", () => {
    const items = [
      makeItem({
        category: "raw_material",
        material: "stone",
        position_x: 5,
        position_y: 5,
        position_z: 0,
        held_by_dwarf_id: null,
      }),
      makeItem({
        category: "raw_material",
        material: "plant",
        position_x: 6,
        position_y: 5,
        position_z: 0,
        held_by_dwarf_id: null,
      }),
    ];

    const result = findItemsNearWorkshop(items, 5, 5, 0, "raw_material");
    expect(result).toHaveLength(2);
  });

  it("excludes items on a different z-level", () => {
    const items = [
      makeItem({
        category: "raw_material",
        material: "plant",
        position_x: 5,
        position_y: 5,
        position_z: 1,  // different z
        held_by_dwarf_id: null,
      }),
    ];

    const result = findItemsNearWorkshop(items, 5, 5, 0, "raw_material", "plant");
    expect(result).toHaveLength(0);
  });
});
