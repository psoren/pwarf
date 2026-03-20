import type { Dwarf } from "@pwarf/shared";
import type { Rng } from "./rng.js";

const ADJECTIVES = [
  'Eternal', 'Storied', 'Unyielding', 'Resonant', 'Forgotten', 'Blazing',
  'Ancient', 'Hollow', 'Gleaming', 'Shadowed', 'Thunderous', 'Crimson',
  'Ashen', 'Golden', 'Iron', 'Silent', 'Twisted', 'Radiant',
];

const NOUNS = [
  'Hammer', 'Chalice', 'Tome', 'Idol', 'Helm', 'Gauntlet',
  'Scepter', 'Mask', 'Cloak', 'Spire', 'Anvil', 'Rune',
  'Vessel', 'Sigil', 'Effigy', 'Crown', 'Blade', 'Tablet',
];

const CATEGORIES = [
  'weapon', 'armor', 'crafted', 'book', 'gem',
] as const;

const MATERIALS = [
  'obsidian', 'granite', 'iron', 'gold', 'silver', 'bone', 'crystal', 'bronze',
];

const QUALITIES = ['fine', 'superior', 'exceptional', 'masterwork', 'artifact'] as const;

/**
 * Generates a random artifact name in the style "The [Adjective] [Noun] of [DwarfName]".
 * Exported for unit testing.
 */
export function generateArtifactName(dwarf: Dwarf, rng: Rng): string {
  const adj = ADJECTIVES[rng.int(0, ADJECTIVES.length - 1)];
  const noun = NOUNS[rng.int(0, NOUNS.length - 1)];
  const dwarfSurname = dwarf.surname ?? dwarf.name;
  return `The ${adj} ${noun} of ${dwarfSurname}`;
}

/**
 * Picks a random artifact category.
 */
export function randomArtifactCategory(rng: Rng): typeof CATEGORIES[number] {
  return CATEGORIES[rng.int(0, CATEGORIES.length - 1)];
}

/**
 * Picks a random artifact material.
 */
export function randomArtifactMaterial(rng: Rng): string {
  return MATERIALS[rng.int(0, MATERIALS.length - 1)];
}

/**
 * Picks a random artifact quality (skewed toward higher-end).
 */
export function randomArtifactQuality(rng: Rng): typeof QUALITIES[number] {
  return QUALITIES[rng.int(0, QUALITIES.length - 1)];
}
