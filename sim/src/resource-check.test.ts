import { describe, it, expect } from "vitest";
import { hasResources, countAvailableItems } from "./resource-check.js";
import type { Item } from "@pwarf/shared";

function makeTestItem(material: string, civId = "civ-1", heldBy: string | null = null): Item {
  return {
    id: `item-${Math.random()}`,
    name: `${material} item`,
    category: "raw_material",
    quality: "standard",
    material,
    weight: 10,
    value: 1,
    is_artifact: false,
    created_by_dwarf_id: null,
    created_in_civ_id: civId,
    created_year: 1,
    held_by_dwarf_id: heldBy,
    located_in_civ_id: civId,
    located_in_ruin_id: null,
    position_x: 5,
    position_y: 5,
    position_z: 0,
    lore: null,
    properties: {},
    created_at: new Date().toISOString(),
  };
}

describe("hasResources", () => {
  it("returns true for tasks without defined costs", () => {
    expect(hasResources("mine", [], "civ-1")).toBe(true);
    expect(hasResources("haul", [], "civ-1")).toBe(true);
  });

  it("returns true when enough stone for build_wall", () => {
    const items = [makeTestItem("stone")];
    expect(hasResources("build_wall", items, "civ-1")).toBe(true);
  });

  it("returns false when no stone for build_wall", () => {
    expect(hasResources("build_wall", [], "civ-1")).toBe(false);
  });

  it("returns false when stone belongs to another civ", () => {
    const items = [makeTestItem("stone", "civ-2")];
    expect(hasResources("build_wall", items, "civ-1")).toBe(false);
  });

  it("returns false when stone is held by a dwarf", () => {
    const items = [makeTestItem("stone", "civ-1", "dwarf-1")];
    expect(hasResources("build_wall", items, "civ-1")).toBe(false);
  });

  it("returns true for build_well with 2 stones", () => {
    const items = [makeTestItem("stone"), makeTestItem("stone")];
    expect(hasResources("build_well", items, "civ-1")).toBe(true);
  });

  it("returns false for build_well with only 1 stone", () => {
    const items = [makeTestItem("stone")];
    expect(hasResources("build_well", items, "civ-1")).toBe(false);
  });

  it("returns true for build_bed with wood", () => {
    const items = [makeTestItem("wood")];
    expect(hasResources("build_bed", items, "civ-1")).toBe(true);
  });

  it("returns false for build_bed with stone (wrong material)", () => {
    const items = [makeTestItem("stone")];
    expect(hasResources("build_bed", items, "civ-1")).toBe(false);
  });
});

describe("countAvailableItems", () => {
  it("counts matching items", () => {
    const items = [makeTestItem("stone"), makeTestItem("stone"), makeTestItem("wood")];
    expect(countAvailableItems(items, "civ-1", "raw_material", "stone")).toBe(2);
    expect(countAvailableItems(items, "civ-1", "raw_material", "wood")).toBe(1);
  });

  it("excludes items held by dwarves", () => {
    const items = [makeTestItem("stone"), makeTestItem("stone", "civ-1", "dwarf-1")];
    expect(countAvailableItems(items, "civ-1", "raw_material", "stone")).toBe(1);
  });

  it("excludes items from other civs", () => {
    const items = [makeTestItem("stone", "civ-2")];
    expect(countAvailableItems(items, "civ-1", "raw_material", "stone")).toBe(0);
  });
});
