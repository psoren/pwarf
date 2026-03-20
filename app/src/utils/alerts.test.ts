import { describe, it, expect } from "vitest";
import { deriveAlert } from "./alerts";

function makeDwarf(overrides: Partial<{
  name: string;
  is_in_tantrum: boolean;
  need_food: number;
  need_drink: number;
  health: number;
  stress_level: number;
}> = {}) {
  return {
    name: "Urist",
    is_in_tantrum: false,
    need_food: 80,
    need_drink: 80,
    health: 100,
    stress_level: 20,
    ...overrides,
  };
}

describe("deriveAlert", () => {
  it("returns null when all dwarves are healthy", () => {
    expect(deriveAlert([makeDwarf(), makeDwarf({ name: "Kadol" })])).toBeNull();
  });

  it("returns null for empty dwarves list", () => {
    expect(deriveAlert([])).toBeNull();
  });

  it("detects single dwarf tantrum", () => {
    const alert = deriveAlert([makeDwarf({ name: "Mafol", is_in_tantrum: true })]);
    expect(alert?.message).toBe("Mafol in tantrum");
    expect(alert?.severity).toBe("critical");
  });

  it("detects multiple dwarves in tantrum", () => {
    const alert = deriveAlert([
      makeDwarf({ is_in_tantrum: true }),
      makeDwarf({ is_in_tantrum: true }),
    ]);
    expect(alert?.message).toBe("2 dwarves in tantrum");
    expect(alert?.severity).toBe("critical");
  });

  it("detects starvation (need_food below threshold)", () => {
    const alert = deriveAlert([makeDwarf({ name: "Doren", need_food: 10 })]);
    expect(alert?.message).toBe("Doren starving");
    expect(alert?.severity).toBe("critical");
  });

  it("detects dehydration (need_drink below threshold)", () => {
    const alert = deriveAlert([makeDwarf({ name: "Litast", need_drink: 5 })]);
    expect(alert?.message).toBe("Litast starving");
    expect(alert?.severity).toBe("critical");
  });

  it("detects multiple dwarves starving", () => {
    const alert = deriveAlert([
      makeDwarf({ need_food: 5 }),
      makeDwarf({ need_food: 10 }),
    ]);
    expect(alert?.message).toBe("2 dwarves starving");
  });

  it("detects critical health", () => {
    const alert = deriveAlert([makeDwarf({ name: "Urist", health: 15 })]);
    expect(alert?.message).toBe("Urist critically wounded");
    expect(alert?.severity).toBe("critical");
  });

  it("detects high stress as warning", () => {
    const alert = deriveAlert([makeDwarf({ name: "Urist", stress_level: 92 })]);
    expect(alert?.message).toBe("Urist at breaking point");
    expect(alert?.severity).toBe("warning");
  });

  it("detects multiple stressed dwarves", () => {
    const alert = deriveAlert([
      makeDwarf({ stress_level: 95 }),
      makeDwarf({ stress_level: 91 }),
    ]);
    expect(alert?.message).toBe("2 dwarves near breaking point");
  });

  it("prioritizes tantrum over starvation", () => {
    const alert = deriveAlert([
      makeDwarf({ name: "Urist", need_food: 5 }),
      makeDwarf({ name: "Kadol", is_in_tantrum: true }),
    ]);
    expect(alert?.message).toContain("tantrum");
  });

  it("prioritizes starvation over high stress", () => {
    const alert = deriveAlert([
      makeDwarf({ name: "Urist", stress_level: 95 }),
      makeDwarf({ name: "Kadol", need_food: 5 }),
    ]);
    expect(alert?.message).toContain("starving");
  });
});
