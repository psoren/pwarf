import { describe, it, expect } from "vitest";
import { stressColor, stressBarColor, sortDwarves, activityIcon } from "./LeftPanel";
import type { LiveDwarf } from "../hooks/useDwarves";
import type { ActiveTask } from "../hooks/useTasks";

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

describe("activityIcon", () => {
  function makeD(overrides: Partial<LiveDwarf>): LiveDwarf {
    return {
      id: "1", name: "Urist", surname: null, status: "alive", age: null, gender: null,
      is_in_tantrum: false, position_x: 0, position_y: 0, position_z: 0,
      current_task_id: null, stress_level: 0,
      need_food: 100, need_drink: 100, need_sleep: 100, need_social: 100, need_purpose: 100, need_beauty: 100,
      health: 100, memories: [], ...overrides,
    };
  }

  function makeTask(overrides: Partial<ActiveTask>): ActiveTask {
    return { id: "t1", task_type: "mine", status: "active", target_x: null, target_y: null, target_z: null, work_required: 10, work_progress: 0, ...overrides };
  }

  it("returns · for idle dwarf", () => {
    expect(activityIcon(makeD({}))).toBe("·");
  });

  it("returns 😤 for tantrum", () => {
    expect(activityIcon(makeD({ is_in_tantrum: true, current_task_id: "t1" }))).toBe("😤");
  });

  it("returns 💤 for sleeping", () => {
    const task = makeTask({ id: "t1", task_type: "sleep" });
    expect(activityIcon(makeD({ current_task_id: "t1" }), [task])).toBe("💤");
  });

  it("returns 🍖 for eating", () => {
    const task = makeTask({ id: "t1", task_type: "eat" });
    expect(activityIcon(makeD({ current_task_id: "t1" }), [task])).toBe("🍖");
  });

  it("returns 🍖 for drinking", () => {
    const task = makeTask({ id: "t1", task_type: "drink" });
    expect(activityIcon(makeD({ current_task_id: "t1" }), [task])).toBe("🍖");
  });

  it("returns ⛏ for any active work task", () => {
    const task = makeTask({ id: "t1", task_type: "mine" });
    expect(activityIcon(makeD({ current_task_id: "t1" }), [task])).toBe("⛏");
  });
});
