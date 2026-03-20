import {
  MEMORY_WITNESSED_DEATH_INTENSITY,
  MEMORY_WITNESSED_DEATH_DURATION_YEARS,
  MEMORY_ARTIFACT_INTENSITY,
  MEMORY_ARTIFACT_DURATION_YEARS,
  MEMORY_MASTERWORK_INTENSITY,
  MEMORY_MASTERWORK_DURATION_YEARS,
  MEMORY_GRIEF_FRIEND_INTENSITY,
  MEMORY_GRIEF_FRIEND_DURATION_YEARS,
  GRIEF_FRIEND_STRESS,
  MEMORY_MARRIAGE_JOY_INTENSITY,
  MEMORY_MARRIAGE_JOY_DURATION_YEARS,
  GRIEF_SPOUSE_STRESS,
  MEMORY_SPOUSE_GRIEF_INTENSITY,
  MEMORY_SPOUSE_GRIEF_DURATION_YEARS,
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

/**
 * Applies a married_joy memory to both spouses on marriage.
 */
export function createMarriageMemories(
  spouseA: Dwarf,
  spouseB: Dwarf,
  state: CachedState,
  currentYear: number,
): void {
  for (const spouse of [spouseA, spouseB]) {
    addMemory(spouse, {
      type: 'married_joy',
      intensity: MEMORY_MARRIAGE_JOY_INTENSITY,
      year: currentYear,
      expires_year: currentYear + MEMORY_MARRIAGE_JOY_DURATION_YEARS,
    }, state);
  }
}

/**
 * Applies a grief_spouse memory + immediate stress to the surviving spouse of the deceased.
 * Called from all death paths.
 */
export function createGriefSpouseMemories(
  deceased: Dwarf,
  state: CachedState,
  currentYear: number,
): void {
  for (const rel of state.dwarfRelationships) {
    if (rel.type !== 'spouse') continue;
    const spouseId = rel.dwarf_a_id === deceased.id
      ? rel.dwarf_b_id
      : rel.dwarf_b_id === deceased.id
        ? rel.dwarf_a_id
        : null;
    if (!spouseId) continue;

    const spouse = state.dwarves.find(d => d.id === spouseId);
    if (!spouse || spouse.status !== 'alive') continue;

    spouse.stress_level = Math.min(100, spouse.stress_level + GRIEF_SPOUSE_STRESS);
    state.dirtyDwarfIds.add(spouse.id);

    addMemory(spouse, {
      type: 'grief_spouse',
      intensity: MEMORY_SPOUSE_GRIEF_INTENSITY,
      year: currentYear,
      expires_year: currentYear + MEMORY_SPOUSE_GRIEF_DURATION_YEARS,
    }, state);
  }
}

/**
 * Applies a grief_friend memory to all alive dwarves who were 'friend' with the deceased.
 * Called from all death paths after createWitnessDeathMemories.
 */
export function createGriefFriendMemories(
  deceased: Dwarf,
  state: CachedState,
  currentYear: number,
): void {
  for (const rel of state.dwarfRelationships) {
    if (rel.type !== 'friend') continue;
    const friendId = rel.dwarf_a_id === deceased.id
      ? rel.dwarf_b_id
      : rel.dwarf_b_id === deceased.id
        ? rel.dwarf_a_id
        : null;
    if (!friendId) continue;

    const friend = state.dwarves.find(d => d.id === friendId);
    if (!friend || friend.status !== 'alive') continue;

    // Immediate stress spike
    friend.stress_level = Math.min(100, friend.stress_level + GRIEF_FRIEND_STRESS);
    state.dirtyDwarfIds.add(friend.id);

    addMemory(friend, {
      type: 'grief_friend',
      intensity: MEMORY_GRIEF_FRIEND_INTENSITY,
      year: currentYear,
      expires_year: currentYear + MEMORY_GRIEF_FRIEND_DURATION_YEARS,
    }, state);
  }
}
