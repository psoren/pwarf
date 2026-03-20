import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask } from "./test-helpers.js";
import { WORK_BUILD_FLOOR } from "@pwarf/shared";

describe("conscientiousness affects work speed", () => {
  it("diligent dwarf (1.0) completes a build task faster than lazy dwarf (0.0)", async () => {
    // Run diligent dwarf scenario
    const diligentDwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      trait_conscientiousness: 1.0,
    });
    const diligentTask = makeTask("build_floor", {
      assigned_dwarf_id: diligentDwarf.id,
      target_x: 5, target_y: 5, target_z: 0,
      work_required: WORK_BUILD_FLOOR,
    });
    diligentDwarf.current_task_id = diligentTask.id;

    // Run lazy dwarf scenario with same number of ticks
    const lazyDwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      trait_conscientiousness: 0.0,
    });
    const lazyTask = makeTask("build_floor", {
      assigned_dwarf_id: lazyDwarf.id,
      target_x: 5, target_y: 5, target_z: 0,
      work_required: WORK_BUILD_FLOOR,
    });
    lazyDwarf.current_task_id = lazyTask.id;

    // Use enough ticks for the lazy dwarf to almost but not quite finish.
    // WORK_BUILD_FLOOR=25, diligent modifier=1.25 → done in 20 ticks,
    // lazy modifier=0.75 → needs 34 ticks.
    const TICKS = 25;

    const [diligentResult, lazyResult] = await Promise.all([
      runScenario({ dwarves: [diligentDwarf], tasks: [diligentTask], ticks: TICKS }),
      runScenario({ dwarves: [lazyDwarf], tasks: [lazyTask], ticks: TICKS }),
    ]);

    const diligentFinal = diligentResult.tasks.find(t => t.id === diligentTask.id);
    const lazyFinal = lazyResult.tasks.find(t => t.id === lazyTask.id);

    // Diligent dwarf should have completed the task
    expect(diligentFinal?.status).toBe("completed");
    // Lazy dwarf should not yet have finished
    expect(lazyFinal?.status).not.toBe("completed");
  });

  it("null conscientiousness uses default work rate", async () => {
    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      trait_conscientiousness: null,
    });
    const task = makeTask("build_floor", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5, target_y: 5, target_z: 0,
      work_required: WORK_BUILD_FLOOR,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      ticks: WORK_BUILD_FLOOR + 5,
    });

    const finalTask = result.tasks.find(t => t.id === task.id);
    expect(finalTask?.status).toBe("completed");
  });
});
