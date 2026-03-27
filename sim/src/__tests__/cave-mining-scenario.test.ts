import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill } from "./test-helpers.js";
import {
  createFortressDeriver,
  WORK_MINE_BASE,
  type FortressTile,
} from "@pwarf/shared";

const SEED = 42n;
const CIV_ID = "test-civ";

describe("cave mining scenario", () => {
  it("mining an ore tile produces the correct ore item", async () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0]!;
    const caveZ = deriver.getZForEntrance(entrance.x, entrance.y)!;

    // Find an ore tile in this cave by probing the deriver
    let oreX = -1, oreY = -1;
    let oreMaterial = "";
    for (let x = 192; x < 320 && oreX < 0; x++) {
      for (let y = 192; y < 320 && oreX < 0; y++) {
        const tile = deriver.deriveTile(x, y, caveZ);
        if (tile.tileType === "ore" && tile.material) {
          oreX = x;
          oreY = y;
          oreMaterial = tile.material;
        }
      }
    }
    expect(oreX).toBeGreaterThan(0);
    expect(oreMaterial).toBeTruthy();

    // Place dwarf right next to the ore tile
    const dwarf = makeDwarf({
      id: "d1",
      civilization_id: CIV_ID,
      name: "Urist",
      position_x: oreX,
      position_y: oreY,
      position_z: caveZ,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const mineTask = makeTask("mine", {
      civilization_id: CIV_ID,
      status: "pending",
      target_x: oreX,
      target_y: oreY,
      target_z: caveZ,
      work_required: WORK_MINE_BASE,
    });

    const skills = [
      makeSkill(dwarf.id, "mining", 3),
      makeSkill(dwarf.id, "building", 1),
      makeSkill(dwarf.id, "farming", 1),
      makeSkill(dwarf.id, "fighting", 1),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      tasks: [mineTask],
      fortressDeriver: deriver,
      ticks: 300,
      seed: 42,
    });

    // Task should be completed
    const task = result.tasks.find(t => t.task_type === "mine");
    expect(task).toBeDefined();
    expect(task!.status).toBe("completed");

    // An ore item should have been produced with the correct material
    const expectedName = `${oreMaterial.charAt(0).toUpperCase() + oreMaterial.slice(1)} ore`;
    const oreItem = result.items.find(i => i.name === expectedName);
    expect(oreItem).toBeDefined();
    expect(oreItem!.material).toBe(oreMaterial);
    expect(oreItem!.category).toBe("raw_material");
    expect(oreItem!.value).toBe(5);

    // The mined tile should now be open_air
    const minedTile = result.fortressTileOverrides.find(
      t => t.x === oreX && t.y === oreY && t.z === caveZ,
    );
    expect(minedTile).toBeDefined();
    expect(minedTile!.tile_type).toBe("open_air");
  });

  it("mining a gem tile produces the correct gem item", async () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);

    // Search all cave levels for a gem tile
    let gemX = -1, gemY = -1, gemZ = 0;
    let gemMaterial = "";
    for (const entrance of deriver.entrances) {
      const z = deriver.getZForEntrance(entrance.x, entrance.y)!;
      for (let x = 192; x < 320 && gemX < 0; x++) {
        for (let y = 192; y < 320 && gemX < 0; y++) {
          const tile = deriver.deriveTile(x, y, z);
          if (tile.tileType === "gem" && tile.material) {
            gemX = x;
            gemY = y;
            gemZ = z;
            gemMaterial = tile.material;
          }
        }
      }
      if (gemX > 0) break;
    }
    expect(gemX).toBeGreaterThan(0);
    expect(gemMaterial).toBeTruthy();

    const dwarf = makeDwarf({
      id: "d1",
      civilization_id: CIV_ID,
      name: "Urist",
      position_x: gemX,
      position_y: gemY,
      position_z: gemZ,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const mineTask = makeTask("mine", {
      civilization_id: CIV_ID,
      status: "pending",
      target_x: gemX,
      target_y: gemY,
      target_z: gemZ,
      work_required: WORK_MINE_BASE,
    });

    const skills = [
      makeSkill(dwarf.id, "mining", 3),
      makeSkill(dwarf.id, "building", 1),
      makeSkill(dwarf.id, "farming", 1),
      makeSkill(dwarf.id, "fighting", 1),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      tasks: [mineTask],
      fortressDeriver: deriver,
      ticks: 300,
      seed: 42,
    });

    const task = result.tasks.find(t => t.task_type === "mine");
    expect(task).toBeDefined();
    expect(task!.status).toBe("completed");

    // A gem item should have been produced
    const expectedName = gemMaterial.charAt(0).toUpperCase() + gemMaterial.slice(1);
    const gemItem = result.items.find(i => i.name === expectedName);
    expect(gemItem).toBeDefined();
    expect(gemItem!.material).toBe(gemMaterial);
    expect(gemItem!.category).toBe("gem");
    expect(gemItem!.value).toBe(15);

    // The mined tile should now be open_air
    const minedTile = result.fortressTileOverrides.find(
      t => t.x === gemX && t.y === gemY && t.z === gemZ,
    );
    expect(minedTile).toBeDefined();
    expect(minedTile!.tile_type).toBe("open_air");
  });

  it("mining an ore tile via override uses the override material", async () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0]!;
    const caveZ = deriver.getZForEntrance(entrance.x, entrance.y)!;

    // Find a cavern_floor tile to place our override on
    let floorX = -1, floorY = -1;
    for (let x = 192; x < 320 && floorX < 0; x++) {
      for (let y = 192; y < 320 && floorX < 0; y++) {
        const tile = deriver.deriveTile(x, y, caveZ);
        if (tile.tileType === "cavern_floor") {
          floorX = x;
          floorY = y;
        }
      }
    }
    expect(floorX).toBeGreaterThan(0);

    // Place a gold ore override at this position
    const oreOverride: FortressTile = {
      id: "override-ore",
      civilization_id: CIV_ID,
      x: floorX,
      y: floorY,
      z: caveZ,
      tile_type: "ore",
      material: "gold",
      is_revealed: true,
      is_mined: false,
      created_at: new Date().toISOString(),
    };

    const dwarf = makeDwarf({
      id: "d1",
      civilization_id: CIV_ID,
      name: "Urist",
      position_x: floorX,
      position_y: floorY,
      position_z: caveZ,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const mineTask = makeTask("mine", {
      civilization_id: CIV_ID,
      status: "pending",
      target_x: floorX,
      target_y: floorY,
      target_z: caveZ,
      work_required: WORK_MINE_BASE,
    });

    const skills = [
      makeSkill(dwarf.id, "mining", 3),
      makeSkill(dwarf.id, "building", 1),
      makeSkill(dwarf.id, "farming", 1),
      makeSkill(dwarf.id, "fighting", 1),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      tasks: [mineTask],
      fortressDeriver: deriver,
      fortressTileOverrides: [oreOverride],
      ticks: 300,
      seed: 42,
    });

    const task = result.tasks.find(t => t.task_type === "mine");
    expect(task!.status).toBe("completed");

    const goldOre = result.items.find(i => i.name === "Gold ore");
    expect(goldOre).toBeDefined();
    expect(goldOre!.material).toBe("gold");
    expect(goldOre!.category).toBe("raw_material");
  });

  it("mining a cave_mushroom tile produces food and reverts to cavern_floor", async () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0]!;
    const caveZ = deriver.getZForEntrance(entrance.x, entrance.y)!;

    // Find a cave_mushroom tile
    let mushX = -1, mushY = -1;
    for (let x = 192; x < 320 && mushX < 0; x++) {
      for (let y = 192; y < 320 && mushX < 0; y++) {
        const tile = deriver.deriveTile(x, y, caveZ);
        if (tile.tileType === "cave_mushroom") {
          mushX = x;
          mushY = y;
        }
      }
    }
    expect(mushX).toBeGreaterThan(0);

    const dwarf = makeDwarf({
      id: "d1",
      civilization_id: CIV_ID,
      name: "Urist",
      position_x: mushX,
      position_y: mushY,
      position_z: caveZ,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const mineTask = makeTask("mine", {
      civilization_id: CIV_ID,
      status: "pending",
      target_x: mushX,
      target_y: mushY,
      target_z: caveZ,
      work_required: WORK_MINE_BASE,
    });

    const skills = [
      makeSkill(dwarf.id, "mining", 3),
      makeSkill(dwarf.id, "building", 1),
      makeSkill(dwarf.id, "farming", 1),
      makeSkill(dwarf.id, "fighting", 1),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      tasks: [mineTask],
      fortressDeriver: deriver,
      ticks: 200,
      seed: 42,
    });

    const task = result.tasks.find(t => t.task_type === "mine");
    expect(task!.status).toBe("completed");

    // The mine should produce a food item. It may have been auto-cooked into
    // a "Prepared meal" by the time the scenario ends, so check for either.
    const mushroom = result.items.find(i => i.name === "Cave mushroom");
    const meal = result.items.find(i => i.name === "Prepared meal");
    expect(mushroom ?? meal).toBeDefined();

    // Tile should revert to cavern_floor, not open_air
    const minedTile = result.fortressTileOverrides.find(
      t => t.x === mushX && t.y === mushY && t.z === caveZ,
    );
    expect(minedTile).toBeDefined();
    expect(minedTile!.tile_type).toBe("cavern_floor");
  });

  it("cave_mushroom tiles are generated in caves", () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0]!;
    const caveZ = deriver.getZForEntrance(entrance.x, entrance.y)!;

    let mushroomCount = 0;
    for (let x = 192; x < 320; x++) {
      for (let y = 192; y < 320; y++) {
        const tile = deriver.deriveTile(x, y, caveZ);
        if (tile.tileType === "cave_mushroom") mushroomCount++;
      }
    }

    // Mushrooms should exist in caves (threshold 0.78 = ~22% of floor tiles)
    expect(mushroomCount).toBeGreaterThan(0);
    // But not dominate (should be significantly less than total floor tiles)
    expect(mushroomCount).toBeLessThan(5000);
  });

  it("dwarves scout cave, walk underground, and mine walls end-to-end", async () => {
    const deriver = createFortressDeriver(SEED, CIV_ID);
    const entrance = deriver.entrances[0]!;
    const caveZ = deriver.getZForEntrance(entrance.x, entrance.y)!;

    // 3 dwarves at fortress center — tests real-world long-distance pathfinding
    const dwarves = Array.from({ length: 3 }, (_, i) =>
      makeDwarf({
        civilization_id: CIV_ID,
        name: `Miner${i}`,
        position_x: 256 + i,
        position_y: 256,
        position_z: 0,
        need_food: 100, need_drink: 100, need_sleep: 100,
      }),
    );
    const skills = dwarves.flatMap(d => [
      makeSkill(d.id, "mining", 3),
      makeSkill(d.id, "building", 1),
      makeSkill(d.id, "farming", 1),
      makeSkill(d.id, "fighting", 1),
    ]);

    // Phase 1: Scout
    const scoutTask = makeTask("scout_cave", {
      civilization_id: CIV_ID, status: "pending",
      target_x: entrance.x, target_y: entrance.y, target_z: 0,
      work_progress: 0, work_required: WORK_MINE_BASE,
    });

    const scoutResult = await runScenario({
      dwarves, dwarfSkills: skills, fortressDeriver: deriver,
      tasks: [scoutTask], ticks: 500, seed: 42,
    });

    const scout = scoutResult.tasks.find(t => t.task_type === "scout_cave");
    expect(scout?.status).toBe("completed");

    // cave_entrance must exist at z=0
    const eTile = scoutResult.fortressTileOverrides.find(
      t => t.x === entrance.x && t.y === entrance.y && t.z === 0,
    );
    expect(eTile?.tile_type).toBe("cave_entrance");

    // Phase 2: Find mineable walls and create tasks
    const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    const targets: Array<{ x: number; y: number }> = [];
    for (let dx = -15; dx <= 15 && targets.length < 5; dx++) {
      for (let dy = -15; dy <= 15 && targets.length < 5; dy++) {
        const tx = entrance.x + dx, ty = entrance.y + dy;
        if (tx === entrance.x && ty === entrance.y) continue;
        const tile = deriver.deriveTile(tx, ty, caveZ);
        if (tile.tileType !== "cavern_wall") continue;
        const hasFloor = deltas.some(([ddx, ddy]) => {
          const n = deriver.deriveTile(tx + ddx, ty + ddy, caveZ);
          return n.tileType === "cavern_floor" || n.tileType === "cave_mushroom";
        });
        if (hasFloor) targets.push({ x: tx, y: ty });
      }
    }
    expect(targets.length).toBeGreaterThan(0);

    const mineTasks = targets.map(t => makeTask("mine", {
      civilization_id: CIV_ID, status: "pending", priority: 5,
      target_x: t.x, target_y: t.y, target_z: caveZ,
      work_progress: 0, work_required: WORK_MINE_BASE,
    }));

    // Phase 3: Mine — dwarves must pathfind underground and complete tasks
    const mineResult = await runScenario({
      dwarves: scoutResult.dwarves,
      dwarfSkills: scoutResult.dwarfSkills,
      items: scoutResult.items,
      structures: scoutResult.structures,
      fortressDeriver: deriver,
      fortressTileOverrides: scoutResult.fortressTileOverrides,
      tasks: [...scoutResult.tasks, ...mineTasks],
      ticks: 1000, seed: 99,
    });

    const completed = mineResult.tasks.filter(
      t => t.task_type === "mine" && t.target_z === caveZ && t.status === "completed",
    );
    console.log(`E2E cave mining: ${completed.length}/${targets.length} tasks completed`);
    expect(completed.length).toBeGreaterThan(0);
    expect(mineResult.dwarves.filter(d => d.status === "alive").length).toBe(3);
  }, 60_000);
});
