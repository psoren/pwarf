import type { WorldEvent } from "@pwarf/shared";
import type { Rng } from "./rng.js";

/** Fallback scenes used when no world events are available. */
const FALLBACK_SCENES = [
  'This depicts a dwarf working tirelessly in the dark.',
  'This depicts a lone figure descending into the earth.',
  'This depicts the founding of a great fortress.',
  'This depicts mountains and sky, a dream of the surface.',
  'This depicts a dwarf surrounded by stone, at peace.',
];

/**
 * Generates a scene description for an engraved tile based on recent fortress history.
 *
 * Picks a random world event from the provided list and reformulates its description
 * as a scene. Falls back to generic scenes if no events are available.
 *
 * @param events - Recent world events to draw from
 * @param rng - Seeded RNG for deterministic selection
 * @returns A short scene description string
 */
export function generateEngravingScene(events: WorldEvent[], rng: Rng): string {
  if (events.length === 0) {
    return FALLBACK_SCENES[rng.int(0, FALLBACK_SCENES.length - 1)];
  }

  const event = events[rng.int(0, events.length - 1)];
  return sceneFromEvent(event);
}

/**
 * Converts a world event description into an engraving scene.
 * The scene is phrased as "This depicts..." based on the event.
 */
function sceneFromEvent(event: WorldEvent): string {
  const desc = event.description.trim().replace(/\.$/, '');

  switch (event.category) {
    case 'death':
      return `This depicts ${desc.toLowerCase()}.`;
    case 'migration':
      return `This depicts the arrival of new dwarves. ${desc}.`;
    case 'discovery':
      return `This depicts a moment of triumph. ${desc}.`;
    case 'battle':
      return `This depicts a fierce battle. ${desc}.`;
    default:
      return `This depicts a scene from fortress history. ${desc}.`;
  }
}
