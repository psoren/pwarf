import { describe, it, expect } from "vitest";
import { getMineProduct, ARTIFACT_CHANCE_GEM } from "../phases/task-completion.js";

describe("getMineProduct", () => {
  it("tree produces wood log", () => {
    const result = getMineProduct("tree");
    expect(result.itemName).toBe("Wood log");
    expect(result.itemMaterial).toBe("wood");
    expect(result.itemCategory).toBe("raw_material");
  });

  it("rock produces stone block", () => {
    const result = getMineProduct("rock");
    expect(result.itemName).toBe("Stone block");
    expect(result.itemMaterial).toBe("stone");
    expect(result.itemCategory).toBe("raw_material");
  });

  it("bush produces nothing", () => {
    const result = getMineProduct("bush");
    expect(result.itemName).toBeNull();
  });

  it("stone produces stone block", () => {
    const result = getMineProduct("stone");
    expect(result.itemName).toBe("Stone block");
    expect(result.itemMaterial).toBe("stone");
  });

  it("cavern_wall produces stone block", () => {
    const result = getMineProduct("cavern_wall");
    expect(result.itemName).toBe("Stone block");
    expect(result.itemMaterial).toBe("stone");
  });

  it("null tile type produces stone block (default)", () => {
    const result = getMineProduct(null);
    expect(result.itemName).toBe("Stone block");
  });

  // Ore cases
  it("ore with iron material produces Iron ore", () => {
    const result = getMineProduct("ore", "iron");
    expect(result.itemName).toBe("Iron ore");
    expect(result.itemMaterial).toBe("iron");
    expect(result.itemCategory).toBe("raw_material");
    expect(result.itemValue).toBe(5);
    expect(result.itemWeight).toBe(8);
  });

  it("ore with copper material produces Copper ore", () => {
    const result = getMineProduct("ore", "copper");
    expect(result.itemName).toBe("Copper ore");
    expect(result.itemMaterial).toBe("copper");
  });

  it("ore with gold material produces Gold ore", () => {
    const result = getMineProduct("ore", "gold");
    expect(result.itemName).toBe("Gold ore");
    expect(result.itemMaterial).toBe("gold");
  });

  it("ore with null material defaults to Iron ore", () => {
    const result = getMineProduct("ore", null);
    expect(result.itemName).toBe("Iron ore");
    expect(result.itemMaterial).toBe("iron");
  });

  it("ore with no material arg defaults to Iron ore", () => {
    const result = getMineProduct("ore");
    expect(result.itemName).toBe("Iron ore");
    expect(result.itemMaterial).toBe("iron");
  });

  // Gem cases
  it("gem with ruby material produces Ruby", () => {
    const result = getMineProduct("gem", "ruby");
    expect(result.itemName).toBe("Ruby");
    expect(result.itemMaterial).toBe("ruby");
    expect(result.itemCategory).toBe("gem");
    expect(result.itemValue).toBe(15);
    expect(result.itemWeight).toBe(2);
  });

  it("gem with sapphire material produces Sapphire", () => {
    const result = getMineProduct("gem", "sapphire");
    expect(result.itemName).toBe("Sapphire");
    expect(result.itemMaterial).toBe("sapphire");
  });

  it("gem with null material defaults to Gem", () => {
    const result = getMineProduct("gem", null);
    expect(result.itemName).toBe("Gem");
    expect(result.itemMaterial).toBe("gem");
  });

  // Artifact chance
  it("ARTIFACT_CHANCE_GEM is 5%", () => {
    expect(ARTIFACT_CHANCE_GEM).toBe(0.05);
  });

  // Cave mushroom cases
  it("cave_mushroom produces food item", () => {
    const result = getMineProduct("cave_mushroom", "mushroom");
    expect(result.itemName).toBe("Cave mushroom");
    expect(result.itemMaterial).toBe("mushroom");
    expect(result.itemCategory).toBe("food");
    expect(result.itemWeight).toBe(1);
    expect(result.itemValue).toBe(2);
  });
});
