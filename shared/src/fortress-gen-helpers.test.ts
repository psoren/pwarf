import { describe, it, expect } from "vitest";
import {
  createFortressDeriver,
  FORTRESS_MIN_Z,
  FORTRESS_MAX_Z,
} from "./fortress-gen-helpers.js";

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

  it("z=0 is always open_air", () => {
    const d = createFortressDeriver(SEED, CIV_ID);
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        const tile = d.deriveTile(x, y, 0);
        // Stairs are allowed at z=0
        if (tile.tileType !== "stair_down") {
          expect(tile.tileType).toBe("open_air");
        }
      }
    }
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
});
