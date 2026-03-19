import { describe, it, expect } from "vitest";
import {
  getRequiredSkill,
  getDwarfSkillLevel,
  dwarfHasSkill,
  isDwarfIdle,
  isAutonomousTask,
  getBestSkill,
  createTask,
  findNearestItem,
} from "../task-helpers.js";
import { createEmptyCachedState } from "../sim-context.js";
import { makeSkill, makeItem } from "./test-helpers.js";

describe("getRequiredSkill", () => {
  it("returns mining for mine tasks", () => {
    expect(getRequiredSkill("mine")).toBe("mining");
  });

  it("returns null for haul tasks", () => {
    expect(getRequiredSkill("haul")).toBeNull();
  });

  it("returns building for build_wall", () => {
    expect(getRequiredSkill("build_wall")).toBe("building");
  });

  it("returns farming for farm_till", () => {
    expect(getRequiredSkill("farm_till")).toBe("farming");
  });

  it("returns null for eat/drink/sleep", () => {
    expect(getRequiredSkill("eat")).toBeNull();
    expect(getRequiredSkill("drink")).toBeNull();
    expect(getRequiredSkill("sleep")).toBeNull();
  });
});

describe("getDwarfSkillLevel", () => {
  it("returns skill level when skill exists", () => {
    const skills = [makeSkill("d1", "mining", 5)];
    expect(getDwarfSkillLevel("d1", "mining", skills)).toBe(5);
  });

  it("returns 0 when skill does not exist", () => {
    expect(getDwarfSkillLevel("d1", "mining", [])).toBe(0);
  });

  it("does not return other dwarves' skills", () => {
    const skills = [makeSkill("d2", "mining", 10)];
    expect(getDwarfSkillLevel("d1", "mining", skills)).toBe(0);
  });
});

describe("dwarfHasSkill", () => {
  it("returns true for unskilled tasks regardless of skills", () => {
    expect(dwarfHasSkill("d1", "haul", [])).toBe(true);
  });

  it("returns true when dwarf has the required skill", () => {
    const skills = [makeSkill("d1", "mining", 0)];
    expect(dwarfHasSkill("d1", "mine", skills)).toBe(true);
  });

  it("returns false when dwarf lacks the required skill", () => {
    expect(dwarfHasSkill("d1", "mine", [])).toBe(false);
  });
});

describe("isAutonomousTask", () => {
  it("eat, drink, sleep are autonomous", () => {
    expect(isAutonomousTask("eat")).toBe(true);
    expect(isAutonomousTask("drink")).toBe(true);
    expect(isAutonomousTask("sleep")).toBe(true);
  });

  it("mine, haul are not autonomous", () => {
    expect(isAutonomousTask("mine")).toBe(false);
    expect(isAutonomousTask("haul")).toBe(false);
  });
});

describe("createTask", () => {
  it("creates a task with defaults", () => {
    const state = createEmptyCachedState();
    const task = createTask(state, "civ-1", { task_type: "mine" });

    expect(task.task_type).toBe("mine");
    expect(task.status).toBe("pending");
    expect(task.priority).toBe(5);
    expect(task.work_required).toBe(100);
    expect(state.tasks).toContain(task);
    expect(state.newTasks).toContain(task);
  });

  it("applies overrides", () => {
    const state = createEmptyCachedState();
    const task = createTask(state, "civ-1", {
      task_type: "haul",
      priority: 8,
      target_x: 10,
      target_y: 20,
      target_z: -1,
      work_required: 50,
    });

    expect(task.priority).toBe(8);
    expect(task.target_x).toBe(10);
    expect(task.target_y).toBe(20);
    expect(task.target_z).toBe(-1);
    expect(task.work_required).toBe(50);
  });
});

describe("findNearestItem", () => {
  it("finds an item of the requested category", () => {
    const food = makeItem({ category: "food" });
    const result = findNearestItem([food], "food", 0, 0, 0);
    expect(result).toBe(food);
  });

  it("returns null when no matching items exist", () => {
    const stone = makeItem({ category: "raw_material", name: "Stone" });
    expect(findNearestItem([stone], "food", 0, 0, 0)).toBeNull();
  });

  it("ignores items held by a dwarf", () => {
    const food = makeItem({ category: "food", held_by_dwarf_id: "d1" });
    expect(findNearestItem([food], "food", 0, 0, 0)).toBeNull();
  });

  it("ignores items not in a civilization", () => {
    const food = makeItem({ category: "food", located_in_civ_id: null });
    expect(findNearestItem([food], "food", 0, 0, 0)).toBeNull();
  });
});
