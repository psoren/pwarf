import { describe, it, expect } from "vitest";
import type { TerrainType, FortressTileType } from "@pwarf/shared";
import { TERRAIN_GLYPHS, FORTRESS_GLYPHS, DESIGNATION_PREVIEW } from "./tile-glyphs";

const ALL_TERRAINS: TerrainType[] = [
  "mountain", "forest", "plains", "desert", "tundra",
  "swamp", "ocean", "volcano", "underground", "haunted",
  "savage", "evil",
];

const ALL_FORTRESS_TILES: FortressTileType[] = [
  "open_air", "soil", "stone", "ore", "gem", "water", "magma",
  "lava_stone", "cavern_floor", "cavern_wall", "constructed_wall",
  "constructed_floor", "stair_up", "stair_down", "stair_both", "empty",
];

describe("TERRAIN_GLYPHS", () => {
  it("has an entry for every terrain type", () => {
    for (const terrain of ALL_TERRAINS) {
      expect(TERRAIN_GLYPHS[terrain]).toBeDefined();
      expect(TERRAIN_GLYPHS[terrain].ch.length).toBe(1);
      expect(TERRAIN_GLYPHS[terrain].fg).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });
});

describe("FORTRESS_GLYPHS", () => {
  it("has an entry for every fortress tile type", () => {
    for (const tile of ALL_FORTRESS_TILES) {
      expect(FORTRESS_GLYPHS[tile]).toBeDefined();
      expect(FORTRESS_GLYPHS[tile].ch.length).toBeLessThanOrEqual(1);
      expect(FORTRESS_GLYPHS[tile].fg).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });
});

describe("DESIGNATION_PREVIEW", () => {
  it("has entries for all designation types", () => {
    const expected = ["mine", "build_wall", "build_floor", "build_stairs_up", "build_stairs_down", "build_stairs_both"];
    for (const key of expected) {
      expect(DESIGNATION_PREVIEW[key]).toBeDefined();
    }
  });
});
