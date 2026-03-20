import { describe, it, expect } from "vitest";
import { getCarriedItems, getCarriedWeight, canPickUp, pickUpItem, dropItem } from "./inventory.js";
import { makeDwarf, makeItem, makeContext } from "./__tests__/test-helpers.js";
import { DWARF_CARRY_CAPACITY } from "@pwarf/shared";

describe("getCarriedItems", () => {
  it("returns only items held by the specified dwarf", () => {
    const dwarf = makeDwarf();
    const held = makeItem({ held_by_dwarf_id: dwarf.id, name: "Stone block" });
    const other = makeItem({ held_by_dwarf_id: "other-dwarf" });
    const ground = makeItem({ held_by_dwarf_id: null });

    const result = getCarriedItems(dwarf.id, [held, other, ground]);
    expect(result).toEqual([held]);
  });

  it("returns empty array when dwarf carries nothing", () => {
    const dwarf = makeDwarf();
    const result = getCarriedItems(dwarf.id, [makeItem()]);
    expect(result).toEqual([]);
  });
});

describe("getCarriedWeight", () => {
  it("sums weights of carried items", () => {
    const dwarf = makeDwarf();
    const items = [
      makeItem({ held_by_dwarf_id: dwarf.id, weight: 10 }),
      makeItem({ held_by_dwarf_id: dwarf.id, weight: 8 }),
      makeItem({ held_by_dwarf_id: "other", weight: 100 }),
    ];
    expect(getCarriedWeight(dwarf.id, items)).toBe(18);
  });

  it("treats null weight as 0", () => {
    const dwarf = makeDwarf();
    const items = [makeItem({ held_by_dwarf_id: dwarf.id, weight: null })];
    expect(getCarriedWeight(dwarf.id, items)).toBe(0);
  });
});

describe("canPickUp", () => {
  it("returns true when under capacity", () => {
    const dwarf = makeDwarf();
    const item = makeItem({ weight: 10 });
    expect(canPickUp(dwarf.id, item, [])).toBe(true);
  });

  it("returns false when item would exceed capacity", () => {
    const dwarf = makeDwarf();
    const carried = makeItem({ held_by_dwarf_id: dwarf.id, weight: 45 });
    const item = makeItem({ weight: 10 });
    expect(canPickUp(dwarf.id, item, [carried])).toBe(false);
  });

  it("returns true when item fits exactly at capacity", () => {
    const dwarf = makeDwarf();
    const carried = makeItem({ held_by_dwarf_id: dwarf.id, weight: 40 });
    const item = makeItem({ weight: 10 });
    expect(canPickUp(dwarf.id, item, [carried])).toBe(true);
  });
});

describe("pickUpItem", () => {
  it("sets held_by_dwarf_id and clears position", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });
    const item = makeItem({ position_x: 5, position_y: 10, position_z: 0 });

    pickUpItem(dwarf, item, ctx.state);

    expect(item.held_by_dwarf_id).toBe(dwarf.id);
    expect(item.position_x).toBeNull();
    expect(item.position_y).toBeNull();
    expect(item.position_z).toBeNull();
    expect(ctx.state.dirtyItemIds.has(item.id)).toBe(true);
  });
});

describe("dropItem", () => {
  it("clears held_by_dwarf_id and sets position to dwarf location", () => {
    const dwarf = makeDwarf({ position_x: 3, position_y: 7, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });
    const item = makeItem({ held_by_dwarf_id: dwarf.id });

    dropItem(dwarf, item, ctx.state);

    expect(item.held_by_dwarf_id).toBeNull();
    expect(item.position_x).toBe(3);
    expect(item.position_y).toBe(7);
    expect(item.position_z).toBe(0);
    expect(ctx.state.dirtyItemIds.has(item.id)).toBe(true);
  });
});
