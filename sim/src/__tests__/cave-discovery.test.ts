import { describe, it, expect } from "vitest";
import { makeDwarf, makeTask, makeContext } from "./test-helpers.js";
import { completeTask } from "../phases/task-completion.js";
import { createFortressDeriver, CAVE_Z } from "@pwarf/shared";
import { CAVE_OFFSET, CAVE_SIZE, WORK_SCOUT_CAVE } from "@pwarf/shared";

const SEED = 42n;
const CIV_ID = "civ-1";

describe("scout_cave task completion", () => {
  it("creates a marker tile and fires a discovery event", () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0];
    expect(entrance).toBeDefined();

    const dwarf = makeDwarf({ position_x: entrance.x, position_y: entrance.y, position_z: 0 });
    const task = makeTask("scout_cave", {
      target_x: entrance.x,
      target_y: entrance.y,
      target_z: 0,
      work_progress: WORK_SCOUT_CAVE,
      work_required: WORK_SCOUT_CAVE,
      assigned_dwarf_id: dwarf.id,
      status: "in_progress",
    });
    dwarf.current_task_id = task.id;

    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });
    ctx.fortressDeriver = deriver;

    completeTask(dwarf, task, ctx);

    // Task should be completed
    expect(task.status).toBe("completed");

    // A marker tile should be written at the cave's z-level
    const caveZ = deriver.getZForEntrance(entrance.x, entrance.y);
    expect(caveZ).not.toBeNull();
    const markerKey = `${entrance.x},${entrance.y},${caveZ}`;
    const markerTile = ctx.state.fortressTileOverrides.get(markerKey);
    expect(markerTile).toBeDefined();
    expect(markerTile!.tile_type).toBe("cavern_floor");

    // A cave_entrance tile must be written at z=0 so pathfinding can
    // transition from the surface to the cave z-level. Without this,
    // any existing tile override at z=0 shadows the deriver's cave_entrance,
    // making underground mining unreachable (#731).
    const entranceKey = `${entrance.x},${entrance.y},0`;
    const entranceTile = ctx.state.fortressTileOverrides.get(entranceKey);
    expect(entranceTile).toBeDefined();
    expect(entranceTile!.tile_type).toBe("cave_entrance");

    // A discovery event should be fired with the cave name
    const discoveryEvents = ctx.state.pendingEvents.filter(
      e => e.event_data && (e.event_data as Record<string, unknown>).action === "scout_cave",
    );
    expect(discoveryEvents.length).toBe(1);
    expect(discoveryEvents[0].description).toContain("discovered");
    expect(discoveryEvents[0].description).toContain("The ");

    // The event_data should contain cave info
    const data = discoveryEvents[0].event_data as Record<string, unknown>;
    expect(data.cave_z).toBe(caveZ);
    expect(data.cave_name).toMatch(/^The .+ of .+$/);
  });

  it("does nothing without a fortress deriver", () => {
    const dwarf = makeDwarf({ position_x: 100, position_y: 100, position_z: 0 });
    const task = makeTask("scout_cave", {
      target_x: 100,
      target_y: 100,
      target_z: 0,
      work_progress: WORK_SCOUT_CAVE,
      work_required: WORK_SCOUT_CAVE,
      assigned_dwarf_id: dwarf.id,
      status: "in_progress",
    });
    dwarf.current_task_id = task.id;

    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });
    // No fortressDeriver set

    completeTask(dwarf, task, ctx);

    // Task completes but no scout-specific effects
    expect(task.status).toBe("completed");
    expect(ctx.state.fortressTileOverrides.size).toBe(0);
    // Generic completion event fires but no scout_cave specific event
    const scoutEvents = ctx.state.pendingEvents.filter(
      e => e.event_data && (e.event_data as Record<string, unknown>).action === "scout_cave",
    );
    expect(scoutEvents.length).toBe(0);
  });

  it("does nothing when target is not a valid entrance", () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const dwarf = makeDwarf({ position_x: 50, position_y: 50, position_z: 0 });
    const task = makeTask("scout_cave", {
      target_x: 50,
      target_y: 50,
      target_z: 0,
      work_progress: WORK_SCOUT_CAVE,
      work_required: WORK_SCOUT_CAVE,
      assigned_dwarf_id: dwarf.id,
      status: "in_progress",
    });
    dwarf.current_task_id = task.id;

    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });
    ctx.fortressDeriver = deriver;

    completeTask(dwarf, task, ctx);

    expect(task.status).toBe("completed");
    // No marker tile — target wasn't a valid entrance
    expect(ctx.state.fortressTileOverrides.size).toBe(0);
  });
});
