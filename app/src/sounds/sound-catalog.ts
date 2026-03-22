import type { EventCategory } from "@pwarf/shared";
import type { SynthPresetName } from "./synth-presets.js";

/** Maps WorldEvent category to a sound preset. */
export const CATEGORY_SOUNDS: Partial<Record<EventCategory, SynthPresetName>> = {
  battle: "sword_clash",
  death: "death_thud",
  artifact_created: "artifact_fanfare",
  fortress_fallen: "fortress_fallen",
  trade_caravan_arrival: "caravan_bells",
  monster_sighting: "monster_roar",
  monster_slain: "monster_die",
  monster_siege: "monster_roar",
  migration: "migration_crowd",
};

/** Pitch offsets (semitones) for monster roar by rough threat tier. */
export function monsterRoarPitch(threatLevel: number): number {
  if (threatLevel >= 8) return -6;  // dragon / titan: deep
  if (threatLevel >= 5) return 0;
  return 6;                          // small monsters: higher
}
