import type { TerrainType, FortressTileType } from "@pwarf/shared";

/** World map terrain → glyph + color. */
export const TERRAIN_GLYPHS: Record<TerrainType, { ch: string; fg: string }> = {
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

/** Fortress tile type → glyph + color. */
export const FORTRESS_GLYPHS: Record<FortressTileType, { ch: string; fg: string }> = {
  open_air:           { ch: ".",  fg: "#446" },
  grass:              { ch: ".",  fg: "#4a8b3f" },
  tree:               { ch: "\u2663", fg: "#228B22" },
  rock:               { ch: "\u2022", fg: "#999" },
  bush:               { ch: "\u2698", fg: "#5a9b40" },
  pond:               { ch: "~",  fg: "#5599dd" },
  soil:               { ch: "\u2592", fg: "#8B6914" },
  stone:              { ch: "\u2593", fg: "#888" },
  ore:                { ch: "$",  fg: "#ffbf00" },
  gem:                { ch: "\u2666", fg: "#ff44ff" },
  water:              { ch: "~",  fg: "#4488ff" },
  magma:              { ch: "~",  fg: "#ff4400" },
  lava_stone:         { ch: "\u2593", fg: "#993300" },
  cavern_floor:       { ch: ".",  fg: "#556655" },
  cavern_wall:        { ch: "\u2593", fg: "#666" },
  constructed_wall:   { ch: "#",  fg: "#aaa" },
  constructed_floor:  { ch: "+",  fg: "#888" },
  bed:                { ch: "\u2261", fg: "#8B6914" },
  well:               { ch: "O",  fg: "#5599dd" },
  mushroom_garden:    { ch: "\u2261", fg: "#aa66cc" },
  sand:               { ch: "≡",  fg: "#cc9944" },
  ice:                { ch: "≈",  fg: "#aaddff" },
  mud:                { ch: "≈",  fg: "#665533" },
  cave_entrance:      { ch: "\u25BC", fg: "#ff9944" },
  smooth_stone:       { ch: "\u2591", fg: "#aaa" },
  engraved_stone:     { ch: "\u2593", fg: "#ddbbaa" },
  engraved_floor:     { ch: "+",  fg: "#ddbbaa" },
  empty:              { ch: " ",  fg: "#000" },
};

/** Designation preview glyphs (shown on designated tiles before construction). */
export const DESIGNATION_PREVIEW: Record<string, { ch: string; fg: string }> = {
  mine:              { ch: "X", fg: "#cc6600" },
  build_wall:        { ch: "#", fg: "#cc8844" },
  build_floor:       { ch: "+", fg: "#cc8844" },
  build_bed:         { ch: "\u2261", fg: "#cc8844" },
  deconstruct:       { ch: "X", fg: "#cc4444" },
  stockpile:         { ch: "\u25A1", fg: "#8B6914" },
};

/** Glyph for stockpile tiles. */
export const STOCKPILE_GLYPH = { ch: "░", fg: "#5a7a3a", bg: "#1e3518" };

/** Glyph for items on the ground. */
export const GROUND_ITEM_GLYPH = { ch: "*", fg: "#cc9933" };
