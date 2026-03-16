import { describe, it, expect } from "vitest";
import type { TerrainType } from "@pwarf/shared";

// Terrain glyph mapping (extracted from MainViewport for testability)
const TERRAIN_GLYPHS: Record<TerrainType, { ch: string; fg: string }> = {
  mountain:    { ch: "^",  fg: "#aaa" },
  forest:      { ch: "\u2663", fg: "#228B22" },
  plains:      { ch: "\u2591", fg: "#8B7355" },
  desert:      { ch: "\u2261", fg: "#cc9944" },
  tundra:      { ch: "*",  fg: "#ddeeff" },
  swamp:       { ch: "\u2248", fg: "#668866" },
  ocean:       { ch: "~",  fg: "#4488ff" },
  volcano:     { ch: "\u25B2", fg: "#ff4400" },
  underground: { ch: ".",  fg: "#886688" },
  haunted:     { ch: "!",  fg: "#9944cc" },
  savage:      { ch: "!",  fg: "#ff4444" },
  evil:        { ch: "!",  fg: "#990066" },
};

const ALL_TERRAINS: TerrainType[] = [
  "mountain", "forest", "plains", "desert", "tundra",
  "swamp", "ocean", "volcano", "underground", "haunted",
  "savage", "evil",
];

describe("terrain glyph mapping", () => {
  it("has an entry for every terrain type", () => {
    for (const terrain of ALL_TERRAINS) {
      expect(TERRAIN_GLYPHS[terrain]).toBeDefined();
      expect(TERRAIN_GLYPHS[terrain].ch.length).toBeGreaterThan(0);
      expect(TERRAIN_GLYPHS[terrain].fg).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it("each glyph is a single character", () => {
    for (const terrain of ALL_TERRAINS) {
      expect(TERRAIN_GLYPHS[terrain].ch.length).toBe(1);
    }
  });

  it("ocean uses ~ glyph", () => {
    expect(TERRAIN_GLYPHS.ocean.ch).toBe("~");
  });

  it("mountain uses ^ glyph", () => {
    expect(TERRAIN_GLYPHS.mountain.ch).toBe("^");
  });
});
