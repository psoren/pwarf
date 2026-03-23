import { describe, it, expect } from "vitest";
import { makeDwarf, makeContext } from "./test-helpers.js";
import { idleWandering } from "../phases/idle-wandering.js";

describe("idle wandering", () => {
  it("does not create wander tasks (wandering is disabled)", async () => {
    const dwarf = makeDwarf({ position_x: 128, position_y: 128, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await idleWandering(ctx);

    const wanderTasks = ctx.state.tasks.filter(t => t.task_type === "wander");
    expect(wanderTasks).toHaveLength(0);
  });
});
