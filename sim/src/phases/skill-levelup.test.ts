import { describe, it, expect } from "vitest";
import { SKILL_TIER_NAMES } from "@pwarf/shared";
import { completeTask } from "./task-completion.js";
import { makeDwarf, makeSkill, makeTask, makeContext } from "../__tests__/test-helpers.js";

describe("SKILL_TIER_NAMES", () => {
  it("has 21 entries covering levels 0–20", () => {
    expect(SKILL_TIER_NAMES).toHaveLength(21);
  });

  it("starts with Dabbling at level 0", () => {
    expect(SKILL_TIER_NAMES[0]).toBe("Dabbling");
  });

  it("ends with Legendary+4 at level 20", () => {
    expect(SKILL_TIER_NAMES[20]).toBe("Legendary+4");
  });

  it("has Legendary at level 16", () => {
    expect(SKILL_TIER_NAMES[16]).toBe("Legendary");
  });
});

describe("skill level-up event", () => {
  it("fires a discovery event when a dwarf levels up a skill", () => {
    const dwarf = makeDwarf({ id: "d1" });
    // 90 XP → level 0. After +15 XP → 105 XP → level 1 (Novice)
    const skill = makeSkill("d1", "mining", 0, 90);
    const task = makeTask("mine", {
      assigned_dwarf_id: "d1",
      work_progress: 100,
      work_required: 100,
      target_x: 0,
      target_y: 0,
      target_z: 0,
    });

    const ctx = makeContext({ dwarves: [dwarf], skills: [skill], tasks: [task] });

    completeTask(dwarf, task, ctx);

    const levelUpEvent = ctx.state.pendingEvents.find(
      (e) => e.event_data && (e.event_data as Record<string, unknown>).skill_name === "mining",
    );
    expect(levelUpEvent).toBeDefined();
    expect(levelUpEvent?.description).toContain("Novice");
    expect(levelUpEvent?.description).toContain("mining");
    expect(levelUpEvent?.dwarf_id).toBe("d1");
    expect(levelUpEvent?.category).toBe("discovery");
  });

  it("does not fire a level-up event when XP increases but level stays the same", () => {
    const dwarf = makeDwarf({ id: "d2" });
    // 10 XP → after +15 XP → 25 XP → still level 0, no level-up
    const skill = makeSkill("d2", "mining", 0, 10);
    const task = makeTask("mine", {
      assigned_dwarf_id: "d2",
      work_progress: 100,
      work_required: 100,
      target_x: 0,
      target_y: 0,
      target_z: 0,
    });

    const ctx = makeContext({ dwarves: [dwarf], skills: [skill], tasks: [task] });

    completeTask(dwarf, task, ctx);

    const levelUpEvent = ctx.state.pendingEvents.find(
      (e) => e.event_data && (e.event_data as Record<string, unknown>).skill_name === "mining",
    );
    expect(levelUpEvent).toBeUndefined();
  });

  it("marks skill dirty when level increases", () => {
    const dwarf = makeDwarf({ id: "d3" });
    const skill = makeSkill("d3", "mining", 0, 90);
    const task = makeTask("mine", {
      assigned_dwarf_id: "d3",
      work_progress: 100,
      work_required: 100,
      target_x: 0,
      target_y: 0,
      target_z: 0,
    });

    const ctx = makeContext({ dwarves: [dwarf], skills: [skill], tasks: [task] });

    completeTask(dwarf, task, ctx);

    expect(ctx.state.dirtyDwarfSkillIds.has(skill.id)).toBe(true);
  });

  it("does not mark skill dirty when no level-up occurs", () => {
    const dwarf = makeDwarf({ id: "d4" });
    const skill = makeSkill("d4", "mining", 0, 10);
    const task = makeTask("mine", {
      assigned_dwarf_id: "d4",
      work_progress: 100,
      work_required: 100,
      target_x: 0,
      target_y: 0,
      target_z: 0,
    });

    const ctx = makeContext({ dwarves: [dwarf], skills: [skill], tasks: [task] });

    completeTask(dwarf, task, ctx);

    expect(ctx.state.dirtyDwarfSkillIds.has(skill.id)).toBe(false);
  });

  it("includes new_level and tier in event_data", () => {
    const dwarf = makeDwarf({ id: "d5" });
    const skill = makeSkill("d5", "building", 0, 90);
    const task = makeTask("build_wall", {
      assigned_dwarf_id: "d5",
      work_progress: 100,
      work_required: 100,
      target_x: 0,
      target_y: 0,
      target_z: 0,
    });

    const ctx = makeContext({ dwarves: [dwarf], skills: [skill], tasks: [task] });

    completeTask(dwarf, task, ctx);

    const levelUpEvent = ctx.state.pendingEvents.find(
      (e) => e.event_data && (e.event_data as Record<string, unknown>).skill_name === "building",
    );
    expect(levelUpEvent).toBeDefined();
    const data = levelUpEvent?.event_data as Record<string, unknown>;
    expect(data.new_level).toBe(1);
    expect(data.tier).toBe("Novice");
  });
});
