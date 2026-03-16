import { describe, it, expect } from "vitest";
import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import {
  createAleaRng,
  createWorldDeriver,
  fbm,
  deriveTerrain,
  deriveBiomeTags,
  deriveSpecialOverlay,
  elevationToMeters,
} from "./world-gen-helpers.js";

describe("createAleaRng", () => {
  it("returns numbers in [0, 1)", () => {
    const rng = createAleaRng(12345n);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("same seed produces same sequence", () => {
    const rng1 = createAleaRng(42n);
    const rng2 = createAleaRng(42n);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("different seeds produce different sequences", () => {
    const rng1 = createAleaRng(1n);
    const rng2 = createAleaRng(2n);
    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (rng1() !== rng2()) {
        allSame = false;
        break;
      }
    }
    expect(allSame).toBe(false);
  });
});

describe("fbm", () => {
  it("returns values in [0, 1] range", () => {
    const rng = createAleaRng(99n);
    const noise = createNoise2D(rng);
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        const val = fbm(noise, x, y, 6, 0.005, 1.0);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("deriveTerrain", () => {
  it("elevation < 0.25 -> ocean", () => {
    expect(deriveTerrain(0.1, 0.5, 0.5)).toBe("ocean");
  });

  it("high elevation + cold -> tundra", () => {
    expect(deriveTerrain(0.9, 0.5, 0.2)).toBe("tundra");
  });

  it("high elevation + warm -> mountain", () => {
    expect(deriveTerrain(0.9, 0.5, 0.5)).toBe("mountain");
  });

  it("default -> plains", () => {
    expect(deriveTerrain(0.4, 0.3, 0.2)).toBe("plains");
  });
});

describe("deriveBiomeTags", () => {
  it("always returns exactly 3 tags", () => {
    expect(deriveBiomeTags(0.5, 0.5, 0.5)).toHaveLength(3);
    expect(deriveBiomeTags(0.0, 0.0, 0.0)).toHaveLength(3);
    expect(deriveBiomeTags(1.0, 1.0, 1.0)).toHaveLength(3);
  });
});

describe("elevationToMeters", () => {
  it("maps 0 to -200", () => {
    expect(elevationToMeters(0.0)).toBe(-200);
  });

  it("maps 1 to 2000", () => {
    expect(elevationToMeters(1.0)).toBe(2000);
  });
});

describe("createWorldDeriver", () => {
  it("same seed produces identical tiles", () => {
    const d1 = createWorldDeriver(42n);
    const d2 = createWorldDeriver(42n);
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        const t1 = d1.deriveTile(x, y);
        const t2 = d2.deriveTile(x, y);
        expect(t1.terrain).toBe(t2.terrain);
        expect(t1.elevation).toBe(t2.elevation);
        expect(t1.biome_tags).toEqual(t2.biome_tags);
      }
    }
  });

  it("different seeds produce different tiles", () => {
    const d1 = createWorldDeriver(1n);
    const d2 = createWorldDeriver(2n);
    let allSame = true;
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        if (d1.deriveTile(x, y).terrain !== d2.deriveTile(x, y).terrain) {
          allSame = false;
          break;
        }
      }
      if (!allSame) break;
    }
    expect(allSame).toBe(false);
  });

  it("returns valid terrain types and biome tags", () => {
    const d = createWorldDeriver(99n);
    const tile = d.deriveTile(100, 100);
    expect(typeof tile.terrain).toBe("string");
    expect(typeof tile.elevation).toBe("number");
    expect(tile.biome_tags).toHaveLength(3);
  });
});

describe("deriveSpecialOverlay", () => {
  it("returns null when no noise exceeds threshold", () => {
    const lowNoise: NoiseFunction2D = () => 0;
    expect(deriveSpecialOverlay([lowNoise, lowNoise, lowNoise, lowNoise], 10, 10, 0.003)).toBeNull();
  });

  it("returns special terrain when noise is high", () => {
    const highNoise: NoiseFunction2D = () => 0.95;
    const lowNoise: NoiseFunction2D = () => 0;
    expect(deriveSpecialOverlay([lowNoise, lowNoise, lowNoise, highNoise], 10, 10, 0.003)).toBe("evil");
  });
});
