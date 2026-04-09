/**
 * Stuck-dwarf scenario tests (issue investigation)
 *
 * Each scenario exercises a realistic gameplay pattern where dwarves commonly
 * get stuck: mining corridors, hauling to stockpiles, pathfinding through doors,
 * chained tasks, crowded workspaces.
 *
 * Failures here indicate real bugs, not test setup errors (after setup was
 * validated against the existing test patterns).
 */
import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill, makeItem } from "./test-helpers.js";
import {
  WORK_MINE_BASE,
  WORK_BUILD_WALL,
  WORK_BUILD_FLOOR,
  WORK_BUILD_DOOR,
} from "@pwarf/shared";
import type { Dwarf, FortressTile, Item, StockpileTile } from "@pwarf/shared";

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function stoneBlock(x: number, y: number, z = 0): Item {
  return makeItem({
    name: "Stone block",
    category: "raw_material",
    material: "stone",
    located_in_civ_id: "test-civ",
    held_by_dwarf_id: null,
    position_x: x,
    position_y: y,
    position_z: z,
  });
}

function woodLog(x: number, y: number, z = 0): Item {
  return makeItem({
    name: "Wood log",
    category: "raw_material",
    material: "wood",
    located_in_civ_id: "test-civ",
    held_by_dwarf_id: null,
    position_x: x,
    position_y: y,
    position_z: z,
  });
}

/** Suppress autonomous needs so dwarves focus on designated tasks */
function highNeeds(): Partial<Dwarf> {
  return { need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 };
}

/** Prevent auto-brew from triggering (need 15+ drinks in stock) */
function suppressDrinks(count = 15): Item[] {
  return Array.from({ length: count }, (_, i) =>
    makeItem({
      name: "Dwarven ale",
      category: "drink",
      material: "plant",
      position_x: 0,
      position_y: i,
      position_z: 0,
      located_in_civ_id: "test-civ",
    }),
  );
}

/**
 * Prevent auto-cook from triggering (need MIN_COOK_STOCK=15 food items).
 * Without this, auto-cook fires and dwarves pick up cook tasks with no raw food,
 * which can be in a freshly-claimed (work_progress=0) state at the end of a run.
 */
function suppressAutocook(count = 15): Item[] {
  return Array.from({ length: count }, (_, i) =>
    makeItem({
      name: "Prepared meal",
      category: "food",
      material: "cooked",
      position_x: 1,
      position_y: i,
      position_z: 0,
      located_in_civ_id: "test-civ",
    }),
  );
}

function grassTile(x: number, y: number, z = 0): FortressTile {
  return {
    id: `grass-${x}-${y}-${z}`,
    civilization_id: "civ-1",
    x, y, z,
    tile_type: "grass",
    material: null,
    is_revealed: true,
    is_mined: false,
    created_at: new Date().toISOString(),
  };
}

function rockTile(x: number, y: number, z = 0): FortressTile {
  return {
    id: `rock-${x}-${y}-${z}`,
    civilization_id: "civ-1",
    x, y, z,
    tile_type: "rock",
    material: "granite",
    is_revealed: true,
    is_mined: false,
    created_at: new Date().toISOString(),
  };
}

function constructedWallTile(x: number, y: number, z = 0): FortressTile {
  return {
    id: `cwall-${x}-${y}-${z}`,
    civilization_id: "civ-1",
    x, y, z,
    tile_type: "constructed_wall",
    material: "stone",
    is_revealed: true,
    is_mined: false,
    created_at: new Date().toISOString(),
  };
}

function doorTile(x: number, y: number, z = 0): FortressTile {
  return {
    id: `door-${x}-${y}-${z}`,
    civilization_id: "civ-1",
    x, y, z,
    tile_type: "door",
    material: "wood",
    is_revealed: true,
    is_mined: false,
    created_at: new Date().toISOString(),
  };
}

function makeStockpileTile(x: number, y: number, z = 0): StockpileTile {
  return {
    id: `stockpile-${x}-${y}-${z}`,
    civilization_id: "test-civ",
    x, y, z,
    accepts_categories: null,
    priority: 0,
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Universal stuck-detection helper
// ---------------------------------------------------------------------------

/**
 * Assert no dwarf is truly stuck.
 * A dwarf is "stuck" if they hold an in_progress task with zero work done.
 * A freshly claimed task (status = 'claimed') with zero progress is fine —
 * the dwarf may have just picked it up on the last tick.
 */
function assertNoDwarfStuck(result: Awaited<ReturnType<typeof runScenario>>): void {
  const idleTypes = new Set(['wander', 'socialize', 'rest']);
  for (const d of result.dwarves.filter(d => d.status === "alive")) {
    if (d.current_task_id) {
      const t = result.tasks.find(t => t.id === d.current_task_id);
      // Only flag in_progress tasks with no work done — those are truly stuck.
      // Claimed tasks may have 0 progress if just assigned on the final tick.
      // Idle tasks (wander, socialize, rest) may have 0 progress while walking to target.
      if (t?.status === "in_progress" && !idleTypes.has(t.task_type)) {
        expect(
          t.work_progress,
          `Dwarf ${d.name} stuck on in_progress task ${t.task_type} with 0 work done`,
        ).toBeGreaterThan(0);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Scenario 1: Mine-and-Build Corridor
// ---------------------------------------------------------------------------

describe("Scenario 1: Mine-and-Build Corridor", () => {
  it("dwarf mines a corridor and builds walls on both sides without walling itself in", async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 5, position_z: 0, ...highNeeds() });
    const miningSkill = makeSkill(dwarf.id, "mining", 1);
    const buildSkill = makeSkill(dwarf.id, "building", 1);

    // Map layout:
    //   Y=4: rock at X=2..6 (north wall)
    //   Y=5: rock at X=2..6 (corridor to mine)
    //   Y=6: rock at X=2..6 (south wall)
    //   Grass elsewhere for movement
    const tiles: FortressTile[] = [];

    // Open grass rows for the dwarf to walk around
    for (let x = 0; x <= 8; x++) {
      for (let y = 3; y <= 7; y++) {
        tiles.push(grassTile(x, y));
      }
    }
    // Overwrite the rock tiles (rock is walkable per WALKABLE_TILES, but mine tasks target it)
    for (let x = 2; x <= 6; x++) {
      tiles.push(rockTile(x, 4)); // north wall
      tiles.push(rockTile(x, 5)); // corridor to mine
      tiles.push(rockTile(x, 6)); // south wall
    }

    // Mine tasks for corridor (priority 10)
    const mineTasks = [2, 3, 4, 5, 6].map(x =>
      makeTask("mine", {
        status: "pending",
        priority: 10,
        target_x: x, target_y: 5, target_z: 0,
        work_required: WORK_MINE_BASE,
      }),
    );

    // Build wall tasks for north side (priority 5, after mining)
    const buildNorthTasks = [2, 3, 4, 5, 6].map(x =>
      makeTask("build_wall", {
        status: "pending",
        priority: 5,
        target_x: x, target_y: 4, target_z: 0,
        work_required: WORK_BUILD_WALL,
      }),
    );

    // Build wall tasks for south side (priority 5)
    const buildSouthTasks = [2, 3, 4, 5, 6].map(x =>
      makeTask("build_wall", {
        status: "pending",
        priority: 5,
        target_x: x, target_y: 6, target_z: 0,
        work_required: WORK_BUILD_WALL,
      }),
    );

    // Pre-place 10 stone blocks near the dwarf
    const items: Item[] = [
      ...suppressDrinks(),
      ...Array.from({ length: 10 }, (_, i) => stoneBlock(0, i)),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [miningSkill, buildSkill],
      tasks: [...mineTasks, ...buildNorthTasks, ...buildSouthTasks],
      items,
      fortressTileOverrides: tiles,
      ticks: 1500,
    });

    // All mine tasks should complete
    for (const t of mineTasks) {
      const task = result.tasks.find(r => r.id === t.id);
      expect(task?.status, `Mine task at (${t.target_x},5) should complete`).toBe("completed");
    }

    // All build tasks should complete
    for (const t of [...buildNorthTasks, ...buildSouthTasks]) {
      const task = result.tasks.find(r => r.id === t.id);
      expect(task?.status, `Build task at (${t.target_x},${t.target_y}) should complete`).toBe("completed");
    }

    // Dwarf should be alive
    expect(result.dwarves[0]?.status).toBe("alive");

    assertNoDwarfStuck(result);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Stockpile Hauling After Mining
// ---------------------------------------------------------------------------

describe("Scenario 2: Stockpile Hauling After Mining", () => {
  it("dwarf mines rocks and items get hauled to stockpile", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 5, position_z: 0, ...highNeeds() });
    const miningSkill = makeSkill(dwarf.id, "mining", 1);

    // Grass row at y=5, with rock at x=4,5,6
    const tiles: FortressTile[] = [];
    for (let x = 0; x <= 12; x++) {
      tiles.push(grassTile(x, 5));
    }
    tiles.push(rockTile(4, 5));
    tiles.push(rockTile(5, 5));
    tiles.push(rockTile(6, 5));

    const mineTasks = [4, 5, 6].map(x =>
      makeTask("mine", {
        status: "pending",
        priority: 10,
        target_x: x, target_y: 5, target_z: 0,
        work_required: WORK_MINE_BASE,
      }),
    );

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [miningSkill],
      tasks: mineTasks,
      items: suppressDrinks(),
      fortressTileOverrides: tiles,
      stockpileTiles: [makeStockpileTile(10, 5), makeStockpileTile(11, 5)],
      ticks: 800,
    });

    // All mine tasks should complete
    for (const t of mineTasks) {
      const task = result.tasks.find(r => r.id === t.id);
      expect(task?.status, `Mine task at (${t.target_x},5) should complete`).toBe("completed");
    }

    // Stone blocks should have been produced
    const stoneBlocks = result.items.filter(
      i => i.category === "raw_material" && i.material === "stone",
    );
    expect(stoneBlocks.length).toBeGreaterThanOrEqual(1);

    // Some items should be at stockpile positions
    const itemsAtStockpile = result.items.filter(
      i => (i.position_x === 10 || i.position_x === 11) && i.position_y === 5 && i.position_z === 0,
    );
    expect(itemsAtStockpile.length).toBeGreaterThanOrEqual(1);

    assertNoDwarfStuck(result);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Walled Compound With Door
// ---------------------------------------------------------------------------

describe("Scenario 3: Walled Compound With Door", () => {
  it("dwarf paths through door to build_floor task inside compound", async () => {
    // Pre-built walled compound: walls at (1,4),(2,4),(4,4),(5,4) + door at (3,4)
    // Floor task at (3,3) inside, dwarf at (3,6) outside
    const dwarf = makeDwarf({ position_x: 3, position_y: 6, position_z: 0, ...highNeeds() });
    const buildSkill = makeSkill(dwarf.id, "building", 1);

    const tiles: FortressTile[] = [];

    // Open grass area (outside and inside compound)
    for (let x = 0; x <= 6; x++) {
      for (let y = 2; y <= 7; y++) {
        tiles.push(grassTile(x, y));
      }
    }

    // Pre-built walls forming a box: row y=4, x=1..5 with door at x=3
    tiles.push(constructedWallTile(1, 4));
    tiles.push(constructedWallTile(2, 4));
    tiles.push(doorTile(3, 4)); // door — walkable
    tiles.push(constructedWallTile(4, 4));
    tiles.push(constructedWallTile(5, 4));

    const floorTask = makeTask("build_floor", {
      status: "pending",
      priority: 5,
      target_x: 3, target_y: 3, target_z: 0,
      work_required: WORK_BUILD_FLOOR,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill],
      tasks: [floorTask],
      items: [stoneBlock(3, 6), ...suppressDrinks()],
      fortressTileOverrides: tiles,
      ticks: 300,
    });

    const task = result.tasks.find(r => r.id === floorTask.id);
    expect(task?.status, "build_floor inside compound should complete").toBe("completed");

    const floorTile = result.fortressTileOverrides.find(t => t.x === 3 && t.y === 3 && t.z === 0);
    expect(floorTile?.tile_type).toBe("constructed_floor");

    assertNoDwarfStuck(result);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: L-Shaped Mining Then Build at Far End
// ---------------------------------------------------------------------------

describe("Scenario 4: L-Shaped Mining Then Build at Far End", () => {
  it("dwarf mines an L-shaped tunnel and builds at the far end", async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 3, position_z: 0, ...highNeeds() });
    const miningSkill = makeSkill(dwarf.id, "mining", 1);
    const buildSkill = makeSkill(dwarf.id, "building", 1);

    const tiles: FortressTile[] = [];

    // Open grass for movement access
    for (let x = 0; x <= 7; x++) {
      for (let y = 2; y <= 9; y++) {
        tiles.push(grassTile(x, y));
      }
    }

    // Rock forming an L: vertical at x=2 (y=3..7), horizontal at y=7 (x=3..5)
    for (let y = 3; y <= 7; y++) {
      tiles.push(rockTile(2, y));
    }
    for (let x = 3; x <= 5; x++) {
      tiles.push(rockTile(x, 7));
    }

    // Mine vertical arm (x=2, y=3..7)
    const mineVertical = [3, 4, 5, 6, 7].map(y =>
      makeTask("mine", {
        status: "pending",
        priority: 10,
        target_x: 2, target_y: y, target_z: 0,
        work_required: WORK_MINE_BASE,
      }),
    );

    // Mine horizontal arm (y=7, x=3..5)
    const mineHorizontal = [3, 4, 5].map(x =>
      makeTask("mine", {
        status: "pending",
        priority: 10,
        target_x: x, target_y: 7, target_z: 0,
        work_required: WORK_MINE_BASE,
      }),
    );

    // Build wall at far end (5, 8) — south of the horizontal arm
    const buildTask = makeTask("build_wall", {
      status: "pending",
      priority: 5,
      target_x: 5, target_y: 8, target_z: 0,
      work_required: WORK_BUILD_WALL,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [miningSkill, buildSkill],
      tasks: [...mineVertical, ...mineHorizontal, buildTask],
      items: [stoneBlock(0, 2), ...suppressDrinks()],
      fortressTileOverrides: tiles,
      ticks: 1500,
    });

    for (const t of [...mineVertical, ...mineHorizontal]) {
      const task = result.tasks.find(r => r.id === t.id);
      expect(task?.status, `Mine task at (${t.target_x},${t.target_y}) should complete`).toBe("completed");
    }

    const wall = result.tasks.find(r => r.id === buildTask.id);
    expect(wall?.status, "build_wall at far end should complete").toBe("completed");

    assertNoDwarfStuck(result);
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Resource Chain (Mine → Build, No Pre-placed Items)
// ---------------------------------------------------------------------------

describe("Scenario 5: Resource Chain (Mine -> Build, No Pre-placed Items)", () => {
  it("dwarf mines a rock then uses the stone block to build a wall", async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 5, position_z: 0, ...highNeeds() });
    const miningSkill = makeSkill(dwarf.id, "mining", 1);
    const buildSkill = makeSkill(dwarf.id, "building", 1);

    const tiles: FortressTile[] = [];
    for (let x = 0; x <= 6; x++) {
      tiles.push(grassTile(x, 5));
    }
    tiles.push(rockTile(2, 5)); // to be mined

    const mineTask = makeTask("mine", {
      status: "pending",
      priority: 10,
      target_x: 2, target_y: 5, target_z: 0,
      work_required: WORK_MINE_BASE,
    });

    // Build wall at x=4 — needs 1 stone block (produced by mining)
    const buildTask = makeTask("build_wall", {
      status: "pending",
      priority: 5,
      target_x: 4, target_y: 5, target_z: 0,
      work_required: WORK_BUILD_WALL,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [miningSkill, buildSkill],
      tasks: [mineTask, buildTask],
      items: [...suppressDrinks(), ...suppressAutocook()], // no pre-placed stone — mine must produce it
      fortressTileOverrides: tiles,
      ticks: 500,
    });

    // Mine must finish first
    const mine = result.tasks.find(r => r.id === mineTask.id);
    expect(mine?.status, "mine task should complete").toBe("completed");

    // Build should then complete using the produced stone.
    // BUG: This currently FAILS. The mined stone block is picked up by the dwarf
    // (held_by_dwarf_id = dwarf.id), but consumeResources() only counts items
    // where held_by_dwarf_id === null. So the dwarf cannot use the stone it is
    // carrying to satisfy the build_wall resource cost. The task stays pending
    // forever — a real stuck-dwarf bug.
    const build = result.tasks.find(r => r.id === buildTask.id);
    expect(build?.status, "build_wall should complete after mining provides stone").toBe("completed");

    // Confirm a constructed_wall tile exists at (4,5)
    const wallTile = result.fortressTileOverrides.find(t => t.x === 4 && t.y === 5 && t.z === 0);
    expect(wallTile?.tile_type).toBe("constructed_wall");

    assertNoDwarfStuck(result);
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: Crowded Workspace (4 Dwarves)
// ---------------------------------------------------------------------------

describe("Scenario 6: Crowded Workspace (4 Dwarves)", () => {
  it("4 dwarves complete mining and building tasks without deadlocking", async () => {
    // 10×10 grass grid, rocks at (5,2),(6,2),(7,2)
    const dwarves = [
      makeDwarf({ position_x: 3, position_y: 2, position_z: 0, name: "Urist", ...highNeeds() }),
      makeDwarf({ position_x: 3, position_y: 3, position_z: 0, name: "Bomrek", ...highNeeds() }),
      makeDwarf({ position_x: 3, position_y: 4, position_z: 0, name: "Kadol", ...highNeeds() }),
      makeDwarf({ position_x: 3, position_y: 5, position_z: 0, name: "Doren", ...highNeeds() }),
    ];
    const skills = dwarves.flatMap(d => [
      makeSkill(d.id, "mining", 1),
      makeSkill(d.id, "building", 1),
    ]);

    const tiles: FortressTile[] = [];
    for (let x = 0; x <= 10; x++) {
      for (let y = 0; y <= 10; y++) {
        tiles.push(grassTile(x, y));
      }
    }
    tiles.push(rockTile(5, 2));
    tiles.push(rockTile(6, 2));
    tiles.push(rockTile(7, 2));

    const mineTasks = [5, 6, 7].map(x =>
      makeTask("mine", {
        status: "pending",
        priority: 10,
        target_x: x, target_y: 2, target_z: 0,
        work_required: WORK_MINE_BASE,
      }),
    );

    // Build walls at (5,0) and (7,0) — away from the mine sites so dwarves need to walk
    const buildTasks = [5, 7].map(x =>
      makeTask("build_wall", {
        status: "pending",
        priority: 5,
        target_x: x, target_y: 0, target_z: 0,
        work_required: WORK_BUILD_WALL,
      }),
    );

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      tasks: [...mineTasks, ...buildTasks],
      items: [
        stoneBlock(0, 0), stoneBlock(1, 0),
        ...suppressDrinks(),
        ...suppressAutocook(),
      ],
      fortressTileOverrides: tiles,
      ticks: 1200,
    });

    // All mine tasks must complete
    for (const t of mineTasks) {
      const task = result.tasks.find(r => r.id === t.id);
      expect(task?.status, `Mine at (${t.target_x},2) should complete`).toBe("completed");
    }

    // At least 1 build task must complete (2 dwarves + 2 tasks — may compete)
    const completedBuilds = buildTasks.filter(t =>
      result.tasks.find(r => r.id === t.id)?.status === "completed",
    );
    expect(completedBuilds.length).toBeGreaterThanOrEqual(1);

    // All dwarves must be alive
    for (const d of result.dwarves) {
      expect(d.status, `Dwarf ${d.name} should be alive`).toBe("alive");
    }

    assertNoDwarfStuck(result);
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: Build Walls Then Door, Path Through
// ---------------------------------------------------------------------------

describe("Scenario 7: Build Walls Then Door, Path Through", () => {
  it("dwarf builds a wall+door barrier and then builds floor on the other side", async () => {
    // Dwarf at (0,5). Build walls at (1,4),(2,4),(4,4),(5,4), door at (3,4),
    // then build_floor at (3,3) inside.
    const dwarf = makeDwarf({ position_x: 0, position_y: 5, position_z: 0, ...highNeeds() });
    const buildSkill = makeSkill(dwarf.id, "building", 1);

    const tiles: FortressTile[] = [];
    for (let x = 0; x <= 7; x++) {
      for (let y = 2; y <= 7; y++) {
        tiles.push(grassTile(x, y));
      }
    }

    // Wall tasks (priority 10)
    const wallTasks = [1, 2, 4, 5].map(x =>
      makeTask("build_wall", {
        status: "pending",
        priority: 10,
        target_x: x, target_y: 4, target_z: 0,
        work_required: WORK_BUILD_WALL,
      }),
    );

    // Door task (priority 8)
    const doorTask = makeTask("build_door", {
      status: "pending",
      priority: 8,
      target_x: 3, target_y: 4, target_z: 0,
      work_required: WORK_BUILD_DOOR,
    });

    // Floor task inside (priority 5)
    const floorTask = makeTask("build_floor", {
      status: "pending",
      priority: 5,
      target_x: 3, target_y: 3, target_z: 0,
      work_required: WORK_BUILD_FLOOR,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill],
      tasks: [...wallTasks, doorTask, floorTask],
      items: [
        // 4 walls need 4 stone, door needs 1 wood, floor needs 1 stone = 5 stone + 1 wood
        stoneBlock(0, 5), stoneBlock(0, 5), stoneBlock(0, 5),
        stoneBlock(0, 5), stoneBlock(0, 5),
        woodLog(0, 5),
        ...suppressDrinks(),
      ],
      fortressTileOverrides: tiles,
      ticks: 600,
    });

    // All wall tasks should complete
    for (const t of wallTasks) {
      const task = result.tasks.find(r => r.id === t.id);
      expect(task?.status, `Wall at (${t.target_x},4) should complete`).toBe("completed");
    }

    // Door should complete
    const door = result.tasks.find(r => r.id === doorTask.id);
    expect(door?.status, "build_door should complete").toBe("completed");

    // Floor task (inside) should complete — dwarf must path through door
    const floor = result.tasks.find(r => r.id === floorTask.id);
    expect(floor?.status, "build_floor inside compound should complete (dwarf pathed through door)").toBe("completed");

    // Verify floor tile placed
    const floorTile = result.fortressTileOverrides.find(t => t.x === 3 && t.y === 3 && t.z === 0);
    expect(floorTile?.tile_type).toBe("constructed_floor");

    assertNoDwarfStuck(result);
  });
});
