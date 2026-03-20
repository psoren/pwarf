import { describe, it, expect } from "vitest";
import { deriveAlert } from "./Toolbar";
import type { LiveDwarf } from "../hooks/useDwarves";

function makeDwarf(overrides: Partial<LiveDwarf>): LiveDwarf {
  return {
    id: "1",
    name: "Urist",
    surname: null,
    status: "alive",
    age: null,
    gender: null,
    is_in_tantrum: false,
    position_x: 0,
    position_y: 0,
    position_z: 0,
    current_task_id: null,
    stress_level: 0,
    need_food: 100,
    need_drink: 100,
    need_sleep: 100,
    need_social: 100,
    need_purpose: 100,
    need_beauty: 100,
    health: 100,
    memories: [],
    ...overrides,
  };
}

describe("deriveAlert", () => {
  it("returns null for healthy dwarves", () => {
    const dwarves = [makeDwarf({}), makeDwarf({ id: "2", name: "Mafol" })];
    expect(deriveAlert(dwarves)).toBeNull();
  });

  it("returns null for empty list", () => {
    expect(deriveAlert([])).toBeNull();
  });

  it("returns critical tantrum for one dwarf", () => {
    const dwarves = [makeDwarf({ is_in_tantrum: true })];
    const alert = deriveAlert(dwarves);
    expect(alert?.level).toBe("critical");
    expect(alert?.text).toContain("Urist");
    expect(alert?.text).toContain("tantrum");
  });

  it("returns critical tantrum count for multiple dwarves", () => {
    const dwarves = [
      makeDwarf({ id: "1", is_in_tantrum: true }),
      makeDwarf({ id: "2", name: "Mafol", is_in_tantrum: true }),
    ];
    const alert = deriveAlert(dwarves);
    expect(alert?.level).toBe("critical");
    expect(alert?.text).toContain("2 dwarves");
  });

  it("returns critical starvation when need_food < 15", () => {
    const dwarves = [makeDwarf({ need_food: 10 })];
    const alert = deriveAlert(dwarves);
    expect(alert?.level).toBe("critical");
    expect(alert?.text).toContain("starving");
  });

  it("returns critical starvation when need_drink < 15", () => {
    const dwarves = [makeDwarf({ need_drink: 5 })];
    const alert = deriveAlert(dwarves);
    expect(alert?.level).toBe("critical");
    expect(alert?.text).toContain("starving");
  });

  it("returns critical health when health < 20", () => {
    const dwarves = [makeDwarf({ health: 10 })];
    const alert = deriveAlert(dwarves);
    expect(alert?.level).toBe("critical");
    expect(alert?.text).toContain("injured");
  });

  it("returns warning for stress >= 90", () => {
    const dwarves = [makeDwarf({ stress_level: 92 })];
    const alert = deriveAlert(dwarves);
    expect(alert?.level).toBe("warning");
    expect(alert?.text).toContain("stressed");
  });

  it("tantrum takes priority over starvation", () => {
    const dwarves = [
      makeDwarf({ id: "1", is_in_tantrum: true }),
      makeDwarf({ id: "2", name: "Mafol", need_food: 5 }),
    ];
    const alert = deriveAlert(dwarves);
    expect(alert?.text).toContain("tantrum");
  });

  it("starvation takes priority over critical stress", () => {
    const dwarves = [
      makeDwarf({ id: "1", need_food: 5 }),
      makeDwarf({ id: "2", name: "Mafol", stress_level: 95 }),
    ];
    const alert = deriveAlert(dwarves);
    expect(alert?.text).toContain("starving");
  });
});
