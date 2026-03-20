import { FORTRESS_NAME_MATERIALS, FORTRESS_NAME_NOUNS } from "@pwarf/shared";

/** Generates a random dwarven fortress name like "Ironhold" or "Coppergate". */
export function generateFortressName(): string {
  const material = FORTRESS_NAME_MATERIALS[Math.floor(Math.random() * FORTRESS_NAME_MATERIALS.length)];
  const noun = FORTRESS_NAME_NOUNS[Math.floor(Math.random() * FORTRESS_NAME_NOUNS.length)];
  return `${material}${noun}`;
}
