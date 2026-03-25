import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill } from "./test-helpers.js";
import { createFortressDeriver, WORK_SCOUT_CAVE } from "@pwarf/shared";

const SEED = 42n;
const CIV_ID = "test-civ";

describe("cave scouting scenario", () => {
  it("dwarf walks to cave entrance, scouts it, and discovers the cave", async () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0];
    expect(entrance).toBeDefined();

    // Place dwarf near the cave entrance so pathfinding reaches it quickly
    const dwarf = makeDwarf({
      id: "d1",
      civilization_id: CIV_ID,
      name: "Urist",
      position_x: entrance.x,
      position_y: entrance.y,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    // Create a pending scout_cave task at the entrance
    const scoutTask = makeTask("scout_cave", {
      civilization_id: CIV_ID,
      status: "pending",
      target_x: entrance.x,
      target_y: entrance.y,
      target_z: 0,
      work_progress: 0,
      work_required: WORK_SCOUT_CAVE,
    });

    // Give the dwarf all basic skills so the scenario doesn't get blocked
    const skills = [
      makeSkill(dwarf.id, "mining", 1),
      makeSkill(dwarf.id, "building", 1),
      makeSkill(dwarf.id, "farming", 1),
      makeSkill(dwarf.id, "fighting", 1),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      tasks: [scoutTask],
      fortressDeriver: deriver,
      ticks: 200, // enough for the dwarf to claim and complete the scout task
      seed: 42,
    });

    // The scout task should be completed
    const task = result.tasks.find(t => t.task_type === "scout_cave");
    expect(task).toBeDefined();
    expect(task!.status).toBe("completed");

    // A cavern_floor marker tile should exist at the cave z-level
    const caveZ = deriver.getZForEntrance(entrance.x, entrance.y);
    expect(caveZ).not.toBeNull();
    const markerTile = result.fortressTileOverrides.find(
      t => t.x === entrance.x && t.y === entrance.y && t.z === caveZ,
    );
    expect(markerTile).toBeDefined();
    expect(markerTile!.tile_type).toBe("cavern_floor");

    // A discovery event should have fired
    const discoveryEvents = result.events.filter(
      e => e.event_data && (e.event_data as Record<string, unknown>).action === "scout_cave",
    );
    expect(discoveryEvents.length).toBe(1);
    expect(discoveryEvents[0]!.description).toContain("discovered");
  });
});
