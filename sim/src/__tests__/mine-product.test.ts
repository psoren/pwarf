import { describe, it, expect } from "vitest";
import { getMineProduct } from "../phases/task-completion.js";

describe("getMineProduct", () => {
  it("tree produces wood log", () => {
    const result = getMineProduct("tree");
    expect(result.itemName).toBe("Wood log");
    expect(result.itemMaterial).toBe("wood");
  });

  it("rock produces stone block", () => {
    const result = getMineProduct("rock");
    expect(result.itemName).toBe("Stone block");
    expect(result.itemMaterial).toBe("stone");
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

  it("ore produces stone block (default)", () => {
    const result = getMineProduct("ore");
    expect(result.itemName).toBe("Stone block");
  });

  it("null tile type produces stone block (default)", () => {
    const result = getMineProduct(null);
    expect(result.itemName).toBe("Stone block");
  });
});
