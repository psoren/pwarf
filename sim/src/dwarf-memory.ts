import {
  MEMORY_WITNESSED_DEATH_INTENSITY,
  MEMORY_WITNESSED_DEATH_DURATION_YEARS,
  MEMORY_ARTIFACT_INTENSITY,
  MEMORY_ARTIFACT_DURATION_YEARS,
  MEMORY_MASTERWORK_INTENSITY,
  MEMORY_MASTERWORK_DURATION_YEARS,
  WITNESS_DEATH_RADIUS,
} from "@pwarf/shared";
import type { Dwarf, DwarfMemory } from "@pwarf/shared";
import type { CachedState } from "./sim-context.js";

/**
 * Reads the typed memories array from a dwarf's JSONB field.
 * Casts the unknown[] to DwarfMemory[]. Invalid entries are silently dropped.
 */
export function getMemories(dwarf: Dwarf): DwarfMemory[] {
  if (!Array.isArray(dwarf.memories)) return [];
  return dwarf.memories.filter(isValidMemory);
}

function isValidMemory(m: unknown): m is DwarfMemory {
  if (typeof m !== 'object' || m === null) return false;
  const mem = m as Record<string, unknown>;
  return typeof mem['type'] === 'string'
    && typeof mem['intensity'] === 'number'
    && typeof mem['year'] === 'number'
    && typeof mem['expires_year'] === 'number';
}

/**
 * Adds a memory to a dwarf, marking them dirty.
 */
export function addMemory(dwarf: Dwarf, memory: DwarfMemory, state: CachedState): void {
  const existing = getMemories(dwarf);
  dwarf.memories = [...existing, memory] as unknown[];
  state.dirtyDwarfIds.add(dwarf.id);
}

/**
 * Returns only the active (non-expired) memories for a dwarf.
 */
export function activeMemories(dwarf: Dwarf, currentYear: number): DwarfMemory[] {
  return getMemories(dwarf).filter(m => currentYear <= m.expires_year);
}

/**
 * Strips expired memories from a dwarf's memories array.
 * Returns true if any were removed (dwarf is dirty).
 */
export function decayMemories(dwarf: Dwarf, currentYear: number, state: CachedState): void {
  const before = getMemories(dwarf);
  const after = before.filter(m => currentYear <= m.expires_year);
  if (after.length < before.length) {
    dwarf.memories = after as unknown[];
    state.dirtyDwarfIds.add(dwarf.id);
  }
}

/**
 * Applies witnessed_death memories to all alive dwarves within radius of the deceased.
 * Called from all death paths (deprivation, disease, combat, yearly).
 */
export function createWitnessDeathMemories(
  deceased: Dwarf,
  state: CachedState,
  currentYear: number,
): void {
  for (const witness of state.dwarves) {
    if (witness.id === deceased.id) continue;
    if (witness.status !== 'alive') continue;
    if (witness.position_z !== deceased.position_z) continue;
    const dist = Math.abs(witness.position_x - deceased.position_x)
      + Math.abs(witness.position_y - deceased.position_y);
    if (dist > WITNESS_DEATH_RADIUS) continue;

    addMemory(witness, {
      type: 'witnessed_death',
      intensity: MEMORY_WITNESSED_DEATH_INTENSITY,
      year: currentYear,
      expires_year: currentYear + MEMORY_WITNESSED_DEATH_DURATION_YEARS,
    }, state);
  }
}

/**
 * Applies a created_artifact memory to the dwarf who completed the artifact.
 */
export function createArtifactMemory(dwarf: Dwarf, state: CachedState, currentYear: number): void {
  addMemory(dwarf, {
    type: 'created_artifact',
    intensity: MEMORY_ARTIFACT_INTENSITY,
    year: currentYear,
    expires_year: currentYear + MEMORY_ARTIFACT_DURATION_YEARS,
  }, state);
}

/**
 * Applies a created_masterwork memory to the dwarf who created a masterwork/exceptional item.
 */
export function createMasterworkMemory(dwarf: Dwarf, state: CachedState, currentYear: number): void {
  addMemory(dwarf, {
    type: 'created_masterwork',
    intensity: MEMORY_MASTERWORK_INTENSITY,
    year: currentYear,
    expires_year: currentYear + MEMORY_MASTERWORK_DURATION_YEARS,
  }, state);
}
