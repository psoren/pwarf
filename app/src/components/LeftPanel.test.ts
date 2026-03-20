import { describe, it, expect } from "vitest";
import { stressColor, stressBarColor, sortDwarves, taskIcon } from "./LeftPanel";
import type { LiveDwarf } from "../hooks/useDwarves";

describe("stressColor", () => {
  it("returns green for low stress (0)", () => {
    expect(stressColor(0)).toBe("var(--green)");
  });

  it("returns green for stress at upper low boundary (33)", () => {
    expect(stressColor(33)).toBe("var(--green)");
  });

  it("returns amber for medium stress (34)", () => {
    expect(stressColor(34)).toBe("var(--amber)");
  });

  it("returns amber for stress at upper medium boundary (66)", () => {
    expect(stressColor(66)).toBe("var(--amber)");
  });

  it("returns red for high stress (67)", () => {
    expect(stressColor(67)).toBe("var(--red)");
  });

  it("returns red for max stress (100)", () => {
    expect(stressColor(100)).toBe("var(--red)");
  });
});

describe("stressBarColor", () => {
  it("returns green for 0–30", () => {
    expect(stressBarColor(0)).toBe("var(--green)");
    expect(stressBarColor(30)).toBe("var(--green)");
  });

  it("returns amber for 31–60", () => {
    expect(stressBarColor(31)).toBe("var(--amber)");
    expect(stressBarColor(60)).toBe("var(--amber)");
  });

  it("returns orange for 61–80", () => {
    expect(stressBarColor(61)).toBe("#f97316");
    expect(stressBarColor(80)).toBe("#f97316");
  });

  it("returns red for 81–100", () => {
    expect(stressBarColor(81)).toBe("var(--red)");
    expect(stressBarColor(100)).toBe("var(--red)");
  });
});

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
    trait_openness: 0.5,
    trait_conscientiousness: 0.5,
    trait_extraversion: 0.5,
    trait_agreeableness: 0.5,
    trait_neuroticism: 0.5,
    ...overrides,
  };
}

describe("sortDwarves", () => {
  const dwarves = [
    makeDwarf({ id: "a", name: "Zorn", stress_level: 20 }),
    makeDwarf({ id: "b", name: "Atir", stress_level: 80 }),
    makeDwarf({ id: "c", name: "Mafol", stress_level: 50 }),
  ];

  it("sorts by stress descending", () => {
    const result = sortDwarves(dwarves, "stress");
    expect(result.map(d => d.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by name ascending", () => {
    const result = sortDwarves(dwarves, "name");
    expect(result.map(d => d.name)).toEqual(["Atir", "Mafol", "Zorn"]);
  });

  it("does not mutate original array", () => {
    const original = [...dwarves];
    sortDwarves(dwarves, "stress");
    expect(dwarves).toEqual(original);
  });
});

describe("taskIcon", () => {
  it("returns tantrum icon when in tantrum", () => {
    expect(taskIcon("mine", true)).toBe("😤");
  });

  it("returns mining icon for mine task", () => {
    expect(taskIcon("mine", false)).toBe("⛏");
  });

  it("returns sleep icon for sleep task", () => {
    expect(taskIcon("sleep", false)).toBe("💤");
  });

  it("returns food icon for eat task", () => {
    expect(taskIcon("eat", false)).toBe("🍖");
  });

  it("returns fallback icon for unknown tasks", () => {
    expect(taskIcon("unknown_task", false)).toBe("⚒");
  });
});
