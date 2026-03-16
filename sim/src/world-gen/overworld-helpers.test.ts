import { describe, it, expect } from "vitest";
import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import {
  createAleaRng,
  fbm,
  deriveTerrain,
  deriveBiomeTags,
  deriveSpecialOverlay,
  elevationToMeters,
} from "./overworld-helpers.js";

// ============================================================
// createAleaRng
// ============================================================

describe("createAleaRng", () => {
  it("returns numbers in [0, 1)", () => {
    const rng = createAleaRng(12345n);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("same seed produces same sequence (determinism)", () => {
    const rng1 = createAleaRng(42n);
    const rng2 = createAleaRng(42n);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("different seeds produce different sequences", () => {
    const rng1 = createAleaRng(1n);
    const rng2 = createAleaRng(2n);
    // At least one of the first 10 values should differ
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

// ============================================================
// fbm
// ============================================================

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

  it("same inputs produce same output (determinism)", () => {
    const rng1 = createAleaRng(55n);
    const noise1 = createNoise2D(rng1);
    const rng2 = createAleaRng(55n);
    const noise2 = createNoise2D(rng2);

    const val1 = fbm(noise1, 10, 20, 6, 0.005, 1.0);
    const val2 = fbm(noise2, 10, 20, 6, 0.005, 1.0);
    expect(val1).toBe(val2);
  });

  it("different coordinates produce different values", () => {
    const rng = createAleaRng(77n);
    const noise = createNoise2D(rng);
    const val1 = fbm(noise, 0, 0, 6, 0.005, 1.0);
    const val2 = fbm(noise, 100, 200, 6, 0.005, 1.0);
    expect(val1).not.toBe(val2);
  });
});

// ============================================================
// deriveTerrain — all 10 priority rules
// ============================================================

describe("deriveTerrain", () => {
  it("elevation < 0.25 → ocean", () => {
    expect(deriveTerrain(0.1, 0.5, 0.5)).toBe("ocean");
    expect(deriveTerrain(0.0, 0.9, 0.1)).toBe("ocean");
    expect(deriveTerrain(0.24, 0.5, 0.5)).toBe("ocean");
  });

  it("elevation > 0.85 and temperature < 0.3 → tundra", () => {
    expect(deriveTerrain(0.9, 0.5, 0.2)).toBe("tundra");
    expect(deriveTerrain(0.86, 0.1, 0.1)).toBe("tundra");
  });

  it("elevation > 0.85 (temp >= 0.3) → mountain", () => {
    expect(deriveTerrain(0.9, 0.5, 0.5)).toBe("mountain");
    expect(deriveTerrain(0.86, 0.5, 0.3)).toBe("mountain");
  });

  it("elevation > 0.75, moisture < 0.2, temp > 0.7 → volcano", () => {
    expect(deriveTerrain(0.8, 0.1, 0.8)).toBe("volcano");
    expect(deriveTerrain(0.76, 0.19, 0.71)).toBe("volcano");
  });

  it("temperature < 0.15 (non-ocean, non-mountain) → tundra", () => {
    // elevation in mid-range, temp below 0.15
    expect(deriveTerrain(0.5, 0.5, 0.1)).toBe("tundra");
    expect(deriveTerrain(0.3, 0.8, 0.0)).toBe("tundra");
  });

  it("moisture > 0.7 and temperature > 0.6 → swamp", () => {
    expect(deriveTerrain(0.5, 0.8, 0.7)).toBe("swamp");
    expect(deriveTerrain(0.4, 0.71, 0.61)).toBe("swamp");
  });

  it("moisture < 0.2 and temperature > 0.6 → desert", () => {
    expect(deriveTerrain(0.5, 0.1, 0.7)).toBe("desert");
    expect(deriveTerrain(0.3, 0.19, 0.61)).toBe("desert");
  });

  it("moisture > 0.5 and temperature > 0.3 → forest", () => {
    expect(deriveTerrain(0.5, 0.6, 0.4)).toBe("forest");
    expect(deriveTerrain(0.4, 0.51, 0.31)).toBe("forest");
  });

  it("elevation > 0.6 (nothing else matches) → mountain", () => {
    // Need: elev > 0.6 but <= 0.85, moisture 0.2-0.5, temp 0.15-0.3
    expect(deriveTerrain(0.65, 0.3, 0.2)).toBe("mountain");
    expect(deriveTerrain(0.7, 0.4, 0.25)).toBe("mountain");
  });

  it("default → plains", () => {
    // Need: elev 0.25-0.6, moisture 0.2-0.5, temp 0.15-0.3
    expect(deriveTerrain(0.4, 0.3, 0.2)).toBe("plains");
    expect(deriveTerrain(0.5, 0.4, 0.25)).toBe("plains");
  });
});

// ============================================================
// deriveBiomeTags
// ============================================================

describe("deriveBiomeTags", () => {
  it("returns correct temperature tags", () => {
    expect(deriveBiomeTags(0.5, 0.5, 0.1)).toContain("freezing");
    expect(deriveBiomeTags(0.5, 0.5, 0.3)).toContain("cold");
    expect(deriveBiomeTags(0.5, 0.5, 0.5)).toContain("temperate");
    expect(deriveBiomeTags(0.5, 0.5, 0.7)).toContain("warm");
    expect(deriveBiomeTags(0.5, 0.5, 0.9)).toContain("hot");
  });

  it("returns correct moisture tags", () => {
    expect(deriveBiomeTags(0.5, 0.1, 0.5)).toContain("arid");
    expect(deriveBiomeTags(0.5, 0.3, 0.5)).toContain("dry");
    expect(deriveBiomeTags(0.5, 0.5, 0.5)).toContain("moderate");
    expect(deriveBiomeTags(0.5, 0.7, 0.5)).toContain("humid");
    expect(deriveBiomeTags(0.5, 0.9, 0.5)).toContain("drenched");
  });

  it("returns correct elevation tags", () => {
    expect(deriveBiomeTags(0.1, 0.5, 0.5)).toContain("submerged");
    expect(deriveBiomeTags(0.3, 0.5, 0.5)).toContain("lowland");
    expect(deriveBiomeTags(0.5, 0.5, 0.5)).toContain("midland");
    expect(deriveBiomeTags(0.7, 0.5, 0.5)).toContain("highland");
    expect(deriveBiomeTags(0.9, 0.5, 0.5)).toContain("alpine");
  });

  it("always returns exactly 3 tags", () => {
    const cases = [
      [0.0, 0.0, 0.0],
      [0.5, 0.5, 0.5],
      [1.0, 1.0, 1.0],
      [0.1, 0.9, 0.4],
    ];
    for (const [e, m, t] of cases) {
      expect(deriveBiomeTags(e, m, t)).toHaveLength(3);
    }
  });
});

// ============================================================
// elevationToMeters
// ============================================================

describe("elevationToMeters", () => {
  it("0.0 → -200", () => {
    expect(elevationToMeters(0.0)).toBe(-200);
  });

  it("1.0 → 2000", () => {
    expect(elevationToMeters(1.0)).toBe(2000);
  });

  it("ocean range (0.25) maps to reasonable values", () => {
    const meters = elevationToMeters(0.25);
    expect(meters).toBe(350);
    expect(meters).toBeLessThan(500);
    expect(meters).toBeGreaterThan(-200);
  });

  it("mountain range (0.85+) maps to high values", () => {
    const meters85 = elevationToMeters(0.85);
    const meters95 = elevationToMeters(0.95);
    expect(meters85).toBeGreaterThan(1500);
    expect(meters95).toBeGreaterThan(1800);
  });
});

// ============================================================
// deriveSpecialOverlay
// ============================================================

describe("deriveSpecialOverlay", () => {
  it("returns null when no noise exceeds threshold", () => {
    // Noise function that always returns 0 → normalized to 0.5 (below 0.95)
    const lowNoise: NoiseFunction2D = () => 0;
    const result = deriveSpecialOverlay([lowNoise, lowNoise, lowNoise, lowNoise], 10, 10, 0.003);
    expect(result).toBeNull();
  });

  it("returns a special terrain when noise > 0.95", () => {
    // Noise function returning 0.95 → normalized: (0.95 + 1) / 2 = 0.975 > 0.95
    const highNoise: NoiseFunction2D = () => 0.95;
    const lowNoise: NoiseFunction2D = () => 0;
    const result = deriveSpecialOverlay([lowNoise, lowNoise, lowNoise, highNoise], 10, 10, 0.003);
    expect(result).toBe("evil");
  });

  it("first matching special terrain wins (priority order)", () => {
    // All noises are high — first one ("underground") should win
    const highNoise: NoiseFunction2D = () => 0.95;
    const result = deriveSpecialOverlay([highNoise, highNoise, highNoise, highNoise], 10, 10, 0.003);
    expect(result).toBe("underground");
  });
});
