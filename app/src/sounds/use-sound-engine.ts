import { useEffect, useRef } from "react";
import * as Tone from "tone";
import type { SimSnapshot } from "@pwarf/sim";
import { playPreset } from "./synth-presets.js";
import { CATEGORY_SOUNDS, monsterRoarPitch } from "./sound-catalog.js";

/**
 * Subscribes to the sim snapshot and plays sounds for new events.
 *
 * - Deduplicates: at most one sound per event category per tick.
 * - Skips all sounds when muted or when the AudioContext hasn't been
 *   unlocked yet (browsers require a user gesture).
 */
export function useSoundEngine(
  snapshot: SimSnapshot | null,
  muted: boolean,
): void {
  const prevEventIds = useRef(new Set<string>());
  const audioUnlocked = useRef(false);

  // Unlock AudioContext on first user interaction
  useEffect(() => {
    const unlock = () => {
      if (!audioUnlocked.current) {
        Tone.start().then(() => {
          audioUnlocked.current = true;
        });
      }
    };
    window.addEventListener("click", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!snapshot || muted || !audioUnlocked.current) return;

    const fired = new Set<string>(); // deduplicate by category within this tick

    for (const event of snapshot.events) {
      if (prevEventIds.current.has(event.id)) continue;
      if (fired.has(event.category)) continue;

      const preset = CATEGORY_SOUNDS[event.category];
      if (preset) {
        const options =
          (event.category === "monster_sighting" || event.category === "monster_siege")
            ? { pitch: monsterRoarPitch((event.event_data?.threat_level as number) ?? 5) }
            : undefined;
        playPreset(preset, options);
        fired.add(event.category);
      }
    }

    // Update seen-event tracking: keep last 200 IDs to bound memory
    const allIds = snapshot.events.map((e) => e.id);
    prevEventIds.current = new Set(allIds.slice(-200));
  }, [snapshot, muted]);
}
