import { describe, it, expect } from "vitest";
import {
  createFortressDeriver,
  deriveSurfaceTile,
  FORTRESS_MIN_Z,
  FORTRESS_MAX_Z,
} from "./fortress-gen-helpers.js";
import { createNoise2D } from "simplex-noise";
import { createAleaRng } from "./world-gen-helpers.js";

const SEED = 42n;
const CIV_ID = "test-civ-001";

describe("createFortressDeriver", () => {
  it("same seed + civId produces identical tiles", () => {
    const d1 = createFortressDeriver(SEED, CIV_ID);
    const d2 = createFortressDeriver(SEED, CIV_ID);

    for (let z = FORTRESS_MAX_Z; z >= FORTRESS_MIN_Z; z -= 3) {
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

  it("different seeds produce different layouts", () => {
    const d1 = createFortressDeriver(SEED, CIV_ID);
    const d2 = createFortressDeriver(99n, "other-civ");

    let differences = 0;
    for (let x = 100; x < 120; x++) {
      for (let y = 100; y < 120; y++) {
        const t1 = d1.deriveTile(x, y, -7);
        const t2 = d2.deriveTile(x, y, -7);
        if (t1.tileType !== t2.tileType || t1.material !== t2.material) {
          differences++;
        }
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it("different civId with same worldSeed produces different layouts", () => {
    const d1 = createFortressDeriver(SEED, "civ-alpha");
    const d2 = createFortressDeriver(SEED, "civ-beta");

    let differences = 0;
    for (let x = 100; x < 120; x++) {
      for (let y = 100; y < 120; y++) {
        const t1 = d1.deriveTile(x, y, -7);
        const t2 = d2.deriveTile(x, y, -7);
        if (t1.tileType !== t2.tileType || t1.material !== t2.material) {
          differences++;
        }
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it("z=0 has surface features (grass, tree, rock, bush, pond) or stairs", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    const surfaceTypes = new Set(["grass", "tree", "rock", "bush", "pond", "stair_down"]);
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        const tile = d.deriveTile(x, y, 0);
        expect(surfaceTypes.has(tile.tileType)).toBe(true);
      }
    }
  });

  it("z=0 surface has variety (at least 3 different tile types)", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    const tileTypes = new Set<string>();
    for (let x = 0; x < 200; x += 2) {
      for (let y = 0; y < 200; y += 2) {
        const tile = d.deriveTile(x, y, 0);
        tileTypes.add(tile.tileType);
      }
    }
    // Should have at least grass, tree, and one more type
    expect(tileTypes.size).toBeGreaterThanOrEqual(3);
  });

  it("z=-19 is magma or lava_stone (or stairs/ore)", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    const validTypes = new Set([
      "magma",
      "lava_stone",
      "stair_up",
      "stair_both",
      "ore",
      "gem",
    ]);
    for (let x = 100; x < 150; x++) {
      for (let y = 100; y < 150; y++) {
        const tile = d.deriveTile(x, y, -19);
        expect(validTypes.has(tile.tileType)).toBe(true);
      }
    }
  });

  it("soil layer at z=-1 to -4", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    const validTypes = new Set(["soil", "water", "stair_down", "stair_up", "stair_both"]);
    for (let z = -1; z >= -4; z--) {
      for (let x = 200; x < 210; x++) {
        for (let y = 200; y < 210; y++) {
          const tile = d.deriveTile(x, y, z);
          expect(validTypes.has(tile.tileType)).toBe(true);
        }
      }
    }
  });

  it("iron never appears above z=-5", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    for (let z = 0; z >= -4; z--) {
      for (let x = 0; x < 200; x++) {
        for (let y = 0; y < 200; y++) {
          const tile = d.deriveTile(x, y, z);
          if (tile.material === "iron") {
            // This should never happen
            expect(tile.material).not.toBe("iron");
          }
        }
      }
    }
  });

  it("cavern zone z=-15 to -18 has cavern_floor and cavern_wall tiles", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    const tileTypes = new Set<string>();
    for (let z = -15; z >= -18; z--) {
      for (let x = 0; x < 300; x += 3) {
        for (let y = 0; y < 300; y += 3) {
          const tile = d.deriveTile(x, y, z);
          tileTypes.add(tile.tileType);
        }
      }
    }
    expect(tileTypes.has("cavern_floor")).toBe(true);
    expect(tileTypes.has("cavern_wall")).toBe(true);
  });

  it("stair_down at z=n pairs with stair_up or stair_both at z=n-1", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    // Check several z-levels for stair pairing
    for (let z = 0; z >= FORTRESS_MIN_Z + 1; z--) {
      for (let x = 0; x < 512; x += 64) {
        for (let y = 0; y < 512; y += 64) {
          const upper = d.deriveTile(x, y, z);
          if (upper.tileType === "stair_down" || upper.tileType === "stair_both") {
            const lower = d.deriveTile(x, y, z - 1);
            const validBelow = lower.tileType === "stair_up" || lower.tileType === "stair_both";
            expect(validBelow).toBe(true);
          }
        }
      }
    }
  });

  it("aquifer water tiles only in z=-1 to -3", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    for (let z = FORTRESS_MAX_Z; z >= FORTRESS_MIN_Z; z--) {
      for (let x = 0; x < 200; x += 2) {
        for (let y = 0; y < 200; y += 2) {
          const tile = d.deriveTile(x, y, z);
          if (tile.tileType === "water") {
            expect(z).toBeGreaterThanOrEqual(-3);
            expect(z).toBeLessThanOrEqual(-1);
          }
        }
      }
    }
  });

  it("ore/gem tiles have non-null material", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    for (let z = -5; z >= -19; z--) {
      for (let x = 100; x < 200; x += 2) {
        for (let y = 100; y < 200; y += 2) {
          const tile = d.deriveTile(x, y, z);
          if (tile.tileType === "ore" || tile.tileType === "gem") {
            expect(tile.material).not.toBeNull();
          }
        }
      }
    }
  });

  it("out-of-range z returns empty", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    expect(d.deriveTile(100, 100, 1).tileType).toBe("empty");
    expect(d.deriveTile(100, 100, -20).tileType).toBe("empty");
  });

  it("tree tiles have wood material", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    for (let x = 0; x < 300; x += 3) {
      for (let y = 0; y < 300; y += 3) {
        const tile = d.deriveTile(x, y, 0);
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
        const tile = d.deriveTile(x, y, 0);
        if (tile.tileType === "rock") {
          expect(tile.material).toBe("stone");
        }
      }
    }
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
    // bush and pond may or may not appear with this seed, but grass/tree/rock are guaranteed
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
    // Mountain should be at least 40% stone/rock
    expect(stoneOrRock / total).toBeGreaterThan(0.4);
  });

  it("createFortressDeriver with terrain affects z=0", () => {
    const forestD = createFortressDeriver(SEED, CIV_ID, "forest");
    const desertD = createFortressDeriver(SEED, CIV_ID, "desert");

    let differences = 0;
    for (let x = 100; x < 200; x += 2) {
      for (let y = 100; y < 200; y += 2) {
        const t1 = forestD.deriveTile(x, y, 0);
        const t2 = desertD.deriveTile(x, y, 0);
        if (t1.tileType !== t2.tileType) differences++;
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it("createFortressDeriver terrain does not affect subsurface layers", () => {
    const forestD = createFortressDeriver(SEED, CIV_ID, "forest");
    const desertD = createFortressDeriver(SEED, CIV_ID, "desert");

    for (let z = -1; z >= -5; z--) {
      for (let x = 100; x < 120; x++) {
        for (let y = 100; y < 120; y++) {
          const t1 = forestD.deriveTile(x, y, z);
          const t2 = desertD.deriveTile(x, y, z);
          expect(t1.tileType).toBe(t2.tileType);
          expect(t1.material).toBe(t2.material);
        }
      }
    }
  });
});
