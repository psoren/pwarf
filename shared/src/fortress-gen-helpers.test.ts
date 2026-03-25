import { describe, it, expect } from "vitest";
import {
  createFortressDeriver,
  deriveSurfaceTile,
  SURFACE_Z,
  CAVE_Z,
  FORTRESS_SIZE,
  generateCaveName,
} from "./fortress-gen-helpers.js";
import { CAVE_OFFSET, CAVE_SIZE } from "./constants.js";
import { createNoise2D } from "simplex-noise";
import { createAleaRng } from "./world-gen-helpers.js";

const SEED = 42n;
const CIV_ID = "test-civ-001";

/** Sample range inside the cave grid (centered at CAVE_OFFSET). */
const CAVE_X0 = CAVE_OFFSET + 10;
const CAVE_X1 = CAVE_OFFSET + 30;

describe("createFortressDeriver", () => {
  it("same seed + civId produces identical tiles", () => {
    const d1 = createFortressDeriver(SEED, CIV_ID);
    const d2 = createFortressDeriver(SEED, CIV_ID);

    for (const z of [SURFACE_Z, CAVE_Z]) {
      for (let x = 100; x < 110; x++) {
        for (let y = 100; y < 110; y++) {
          const t1 = d1.deriveTile(x, y, z);
          const t2 = d2.deriveTile(x, y, z);
          expect(t1.tileType).toBe(t2.tileType);
          expect(t1.material).toBe(t2.material);
        }
      }
    }
  });

  it("different seeds produce different cave layouts", () => {
    const d1 = createFortressDeriver(SEED, CIV_ID);
    const d2 = createFortressDeriver(99n, "other-civ");
    // Use first entrance z-level from each deriver
    const z1 = d1.entrances[0]?.z ?? CAVE_Z;
    const z2 = d2.entrances[0]?.z ?? CAVE_Z;

    let differences = 0;
    for (let x = CAVE_X0; x < CAVE_X1; x++) {
      for (let y = CAVE_X0; y < CAVE_X1; y++) {
        const t1 = d1.deriveTile(x, y, z1);
        const t2 = d2.deriveTile(x, y, z2);
        if (t1.tileType !== t2.tileType || t1.material !== t2.material) {
          differences++;
        }
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it("different civId with same worldSeed produces different cave layouts", () => {
    const d1 = createFortressDeriver(SEED, "civ-alpha");
    const d2 = createFortressDeriver(SEED, "civ-beta");
    const z1 = d1.entrances[0]?.z ?? CAVE_Z;
    const z2 = d2.entrances[0]?.z ?? CAVE_Z;

    let differences = 0;
    for (let x = CAVE_X0; x < CAVE_X1; x++) {
      for (let y = CAVE_X0; y < CAVE_X1; y++) {
        const t1 = d1.deriveTile(x, y, z1);
        const t2 = d2.deriveTile(x, y, z2);
        if (t1.tileType !== t2.tileType || t1.material !== t2.material) {
          differences++;
        }
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it("z=0 has surface features (grass, tree, rock, bush, pond, flower, spring) or cave_entrance", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    const surfaceTypes = new Set([
      "grass", "tree", "rock", "bush", "pond", "cave_entrance", "flower", "spring",
    ]);
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        const tile = d.deriveTile(x, y, SURFACE_Z);
        expect(surfaceTypes.has(tile.tileType)).toBe(true);
      }
    }
  });

  it("z=0 surface has variety (at least 3 different tile types)", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    const tileTypes = new Set<string>();
    for (let x = 0; x < 200; x += 2) {
      for (let y = 0; y < 200; y += 2) {
        const tile = d.deriveTile(x, y, SURFACE_Z);
        tileTypes.add(tile.tileType);
      }
    }
    expect(tileTypes.size).toBeGreaterThanOrEqual(3);
  });

  it("first entrance cave has cavern_floor and cavern_wall tiles", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    expect(d.entrances.length).toBeGreaterThan(0);
    const z = d.entrances[0].z;
    const tileTypes = new Set<string>();
    for (let x = CAVE_OFFSET; x < CAVE_OFFSET + CAVE_SIZE; x += 3) {
      for (let y = CAVE_OFFSET; y < CAVE_OFFSET + CAVE_SIZE; y += 3) {
        const tile = d.deriveTile(x, y, z);
        tileTypes.add(tile.tileType);
      }
    }
    expect(tileTypes.has("cavern_floor")).toBe(true);
    expect(tileTypes.has("cavern_wall")).toBe(true);
  });

  it("cave entrances exist on the surface", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    let found = false;
    for (let x = 0; x < FORTRESS_SIZE; x += 4) {
      for (let y = 0; y < FORTRESS_SIZE; y += 4) {
        const tile = d.deriveTile(x, y, SURFACE_Z);
        if (tile.tileType === "cave_entrance") {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });

  it("cave entrances map to valid z-levels with open cave center", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    expect(d.entrances.length).toBeGreaterThan(0);

    for (const entrance of d.entrances) {
      // Entrance exists on the surface
      const surface = d.deriveTile(entrance.x, entrance.y, SURFACE_Z);
      expect(surface.tileType).toBe("cave_entrance");

      // The cave center (128/2 = 64 tiles in, offset by CAVE_OFFSET) should be cavern_floor
      const caveCenter = CAVE_OFFSET + Math.floor(CAVE_SIZE / 2);
      const center = d.deriveTile(caveCenter, caveCenter, entrance.z);
      expect(center.tileType).toBe("cavern_floor");

      // getZForEntrance returns the correct z
      expect(d.getZForEntrance(entrance.x, entrance.y)).toBe(entrance.z);
      expect(d.getEntranceForZ(entrance.z)).toEqual(entrance);
    }
  });

  it("ore/gem/crystal tiles in caves have non-null material", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    const z = d.entrances[0]?.z ?? CAVE_Z;
    for (let x = CAVE_OFFSET; x < CAVE_OFFSET + CAVE_SIZE; x += 2) {
      for (let y = CAVE_OFFSET; y < CAVE_OFFSET + CAVE_SIZE; y += 2) {
        const tile = d.deriveTile(x, y, z);
        if (tile.tileType === "ore" || tile.tileType === "gem" || tile.tileType === "crystal") {
          expect(tile.material).not.toBeNull();
        }
      }
    }
  });

  it("out-of-range z returns empty", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    expect(d.deriveTile(100, 100, 1).tileType).toBe("empty");
    // Use a z far beyond any possible entrance (max 5 entrances → z=-5 is deepest)
    expect(d.deriveTile(100, 100, -50).tileType).toBe("empty");
    expect(d.deriveTile(100, 100, -100).tileType).toBe("empty");
  });

  it("tree tiles have wood material", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    for (let x = 0; x < 300; x += 3) {
      for (let y = 0; y < 300; y += 3) {
        const tile = d.deriveTile(x, y, SURFACE_Z);
        if (tile.tileType === "tree") {
          expect(tile.material).toBe("wood");
        }
      }
    }
  });

  it("rock tiles have stone material", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    for (let x = 0; x < 300; x += 3) {
      for (let y = 0; y < 300; y += 3) {
        const tile = d.deriveTile(x, y, SURFACE_Z);
        if (tile.tileType === "rock") {
          expect(tile.material).toBe("stone");
        }
      }
    }
  });

  it("terrain does not affect cave level", () => {
    const forestD = createFortressDeriver(SEED, CIV_ID, "forest");
    const desertD = createFortressDeriver(SEED, CIV_ID, "desert");
    // Both derivers have the same seed+civId, so same entrances and caves
    const z = forestD.entrances[0]?.z ?? CAVE_Z;

    for (let x = CAVE_X0; x < CAVE_X1; x++) {
      for (let y = CAVE_X0; y < CAVE_X1; y++) {
        const t1 = forestD.deriveTile(x, y, z);
        const t2 = desertD.deriveTile(x, y, z);
        expect(t1.tileType).toBe(t2.tileType);
        expect(t1.material).toBe(t2.material);
      }
    }
  });

  it("getCaveName returns a name for valid entrances", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    for (const entrance of d.entrances) {
      const name = d.getCaveName(entrance.z);
      expect(name).not.toBeNull();
      expect(name).toMatch(/^The .+ of .+$/);
    }
    // Invalid z returns null
    expect(d.getCaveName(-99)).toBeNull();
  });

  it("generateCaveName is deterministic", () => {
    const name1 = generateCaveName(12345n);
    const name2 = generateCaveName(12345n);
    expect(name1).toBe(name2);
    // Different seeds → different names (usually)
    const name3 = generateCaveName(99999n);
    expect(name3).toMatch(/^The .+ of .+$/);
  });

  it("entrances have unique z-levels in descending order", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    const zLevels = d.entrances.map(e => e.z);
    for (let i = 0; i < zLevels.length; i++) {
      expect(zLevels[i]).toBe(-(i + 1));
    }
    // All unique
    expect(new Set(zLevels).size).toBe(zLevels.length);
  });

  it("createFortressDeriver with terrain affects z=0", () => {
    const forestD = createFortressDeriver(SEED, CIV_ID, "forest");
    const desertD = createFortressDeriver(SEED, CIV_ID, "desert");

    let differences = 0;
    for (let x = 100; x < 200; x += 2) {
      for (let y = 100; y < 200; y += 2) {
        const t1 = forestD.deriveTile(x, y, SURFACE_Z);
        const t2 = desertD.deriveTile(x, y, SURFACE_Z);
        if (t1.tileType !== t2.tileType) differences++;
      }
    }
    expect(differences).toBeGreaterThan(0);
  });
});

describe("deriveSurfaceTile", () => {
  it("is deterministic for same noise functions", () => {
    const rng1 = createAleaRng(42n);
    const rng2 = createAleaRng(42n);
    const tree1 = createNoise2D(rng1);
    const rock1 = createNoise2D(rng1);
    const pond1 = createNoise2D(rng1);
    const tree2 = createNoise2D(rng2);
    const rock2 = createNoise2D(rng2);
    const pond2 = createNoise2D(rng2);

    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        const t1 = deriveSurfaceTile(x, y, tree1, rock1, pond1);
        const t2 = deriveSurfaceTile(x, y, tree2, rock2, pond2);
        expect(t1.tileType).toBe(t2.tileType);
        expect(t1.material).toBe(t2.material);
      }
    }
  });

  it("produces all expected tile types over a large area", () => {
    const rng = createAleaRng(42n);
    const treeN = createNoise2D(rng);
    const rockN = createNoise2D(rng);
    const pondN = createNoise2D(rng);

    const types = new Set<string>();
    for (let x = 0; x < 512; x += 2) {
      for (let y = 0; y < 512; y += 2) {
        types.add(deriveSurfaceTile(x, y, treeN, rockN, pondN).tileType);
      }
    }
    expect(types.has("grass")).toBe(true);
    expect(types.has("tree")).toBe(true);
    expect(types.has("rock")).toBe(true);
  });

  it("different terrains produce different tile distributions", () => {
    const terrains = ["mountain", "forest", "plains", "desert", "tundra", "swamp", "volcano"] as const;
    const distributions = new Map<string, Map<string, number>>();

    for (const terrain of terrains) {
      const rng = createAleaRng(42n);
      const treeN = createNoise2D(rng);
      const rockN = createNoise2D(rng);
      const pondN = createNoise2D(rng);

      const counts = new Map<string, number>();
      for (let x = 0; x < 256; x += 2) {
        for (let y = 0; y < 256; y += 2) {
          const tile = deriveSurfaceTile(x, y, treeN, rockN, pondN, terrain);
          counts.set(tile.tileType, (counts.get(tile.tileType) ?? 0) + 1);
        }
      }
      distributions.set(terrain, counts);
    }

    // Mountain should have more rock than plains
    const mtnRock = distributions.get("mountain")!.get("rock") ?? 0;
    const plainsRock = distributions.get("plains")!.get("rock") ?? 0;
    expect(mtnRock).toBeGreaterThan(plainsRock);

    // Forest should have more trees than plains
    const forestTrees = distributions.get("forest")!.get("tree") ?? 0;
    const plainsTrees = distributions.get("plains")!.get("tree") ?? 0;
    expect(forestTrees).toBeGreaterThan(plainsTrees);

    // Desert base tile should be sand
    const desertSand = distributions.get("desert")!.get("sand") ?? 0;
    expect(desertSand).toBeGreaterThan(0);
    expect(distributions.get("desert")!.has("tree")).toBe(false);
    expect(distributions.get("desert")!.has("pond")).toBe(false);

    // Tundra water features should be ice, not pond
    expect(distributions.get("tundra")!.has("pond")).toBe(false);
    const tundraIce = distributions.get("tundra")!.get("ice") ?? 0;
    expect(tundraIce).toBeGreaterThan(0);

    // Swamp base tile should be mud
    const swampMud = distributions.get("swamp")!.get("mud") ?? 0;
    expect(swampMud).toBeGreaterThan(0);

    // Volcano base tile should be lava_stone, water features should be magma
    const volcanoLava = distributions.get("volcano")!.get("lava_stone") ?? 0;
    expect(volcanoLava).toBeGreaterThan(0);
    expect(distributions.get("volcano")!.has("tree")).toBe(false);
  });

  it("mountain surface is mostly stone and rock", () => {
    const rng = createAleaRng(42n);
    const treeN = createNoise2D(rng);
    const rockN = createNoise2D(rng);
    const pondN = createNoise2D(rng);

    let stoneOrRock = 0;
    let total = 0;
    for (let x = 0; x < 256; x += 2) {
      for (let y = 0; y < 256; y += 2) {
        const tile = deriveSurfaceTile(x, y, treeN, rockN, pondN, "mountain");
        if (tile.tileType === "stone" || tile.tileType === "rock") stoneOrRock++;
        total++;
      }
    }
    expect(stoneOrRock / total).toBeGreaterThan(0.4);
  });
});
