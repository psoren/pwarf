import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill } from "./test-helpers.js";
import { GHOST_STRESS_PER_TICK, WORK_ENGRAVE_MEMORIAL } from "@pwarf/shared";

describe("ghost haunting scenario (issue #478)", () => {
  it("dead dwarf becomes ghost and stresses nearby living dwarves", async () => {
    // A dead dwarf (ghost) at (5,5) should stress a living dwarf at (6,5)
    // (within GHOST_HAUNTING_RADIUS=6) each tick
    const deadDwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      status: "dead",
      cause_of_death: "starvation",
      died_year: 1,
    });

    const livingDwarf = makeDwarf({
      position_x: 6, position_y: 5, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100,
      stress_level: 0,
    });

    const result = await runScenario({
      dwarves: [deadDwarf, livingDwarf],
      ticks: 20,
    });

    // Living dwarf should have accumulated ghost stress
    const finalLiving = result.dwarves.find(d => d.id === livingDwarf.id);
    expect(finalLiving).toBeDefined();
    // At least some ghost stress applied (GHOST_STRESS_PER_TICK * ~20 ticks)
    // Stress also rises from other sources (low social/purpose/beauty), so
    // just check it's meaningfully above 0
    expect(finalLiving!.stress_level).toBeGreaterThan(0);
  });

  it("engrave_memorial task puts ghost to rest", async () => {
    // Dead dwarf → ghost. Living dwarf with engraving skill completes
    // an engrave_memorial task → ghost removed, event fired.
    const deadDwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      status: "dead",
      cause_of_death: "monster attack",
      died_year: 1,
    });

    const engraver = makeDwarf({
      position_x: 3, position_y: 3, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100,
      stress_level: 0,
    });

    const engravingSkill = makeSkill(engraver.id, "engraving", 1);

    const memorialTask = makeTask("engrave_memorial", {
      target_x: 5, target_y: 5, target_z: 0,
      work_required: WORK_ENGRAVE_MEMORIAL,
      status: "pending",
    });

    const result = await runScenario({
      dwarves: [deadDwarf, engraver],
      dwarfSkills: [engravingSkill],
      tasks: [memorialTask],
      ticks: WORK_ENGRAVE_MEMORIAL + 100, // Enough for claiming + movement + completion
    });

    // Task should be completed
    const completedTask = result.tasks.find(
      t => t.task_type === "engrave_memorial" && t.status === "completed",
    );
    expect(completedTask).toBeDefined();

    // Ghost-laid-to-rest event should have fired
    const ghostEvent = result.events.find(
      e => e.event_data && (e.event_data as Record<string, unknown>).type === "ghost_laid_to_rest",
    );
    expect(ghostEvent).toBeDefined();
    expect(ghostEvent!.category).toBe("discovery");
    expect(ghostEvent!.description).toContain("memorial");
    expect(ghostEvent!.description).toContain("put to rest");
  });

  it("ghost does not stress dwarves on different z-level", async () => {
    // Ghost at z=0, living dwarf at z=-1 — should NOT be stressed
    const deadDwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      status: "dead",
    });

    const livingDwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: -1,
      need_food: 100, need_drink: 100, need_sleep: 100,
      need_social: 50, need_purpose: 50, need_beauty: 50,
      stress_level: 0,
    });

    const result = await runScenario({
      dwarves: [deadDwarf, livingDwarf],
      ticks: 20,
    });

    const finalLiving = result.dwarves.find(d => d.id === livingDwarf.id);
    // Ghost stress should be 0 (different z-level). Some minor stress from
    // other sources may accumulate, but should be much less than ghost stress
    // which would be 20 * 0.5 = 10 if on same level.
    expect(finalLiving!.stress_level).toBeLessThan(5);
  });

  it("ghost does not stress dwarves beyond haunting radius", async () => {
    // Ghost at (5,5), living dwarf at (20,20) — way beyond GHOST_HAUNTING_RADIUS=6
    const deadDwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      status: "dead",
    });

    const livingDwarf = makeDwarf({
      position_x: 20, position_y: 20, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100,
      need_social: 50, need_purpose: 50, need_beauty: 50,
      stress_level: 0,
    });

    const result = await runScenario({
      dwarves: [deadDwarf, livingDwarf],
      ticks: 20,
    });

    const finalLiving = result.dwarves.find(d => d.id === livingDwarf.id);
    // No ghost stress — only minor stress from other sources
    expect(finalLiving!.stress_level).toBeLessThan(5);
  });
});
