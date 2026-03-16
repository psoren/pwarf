/** Placeholder dwarf roster with positions inside the fortress room. */
export interface FortressDwarf {
  name: string;
  job: string;
  /** Fortress-local x coordinate (inside the room: 2–12) */
  x: number;
  /** Fortress-local y coordinate (inside the room: 2–8) */
  y: number;
}

/**
 * Placeholder dwarves placed inside the fortress room.
 * Positions are spread around the interior (wx 2–12, wy 2–8)
 * avoiding the stairs at (7, 5) and the door gap at (7, 2).
 */
export const FORTRESS_DWARVES: readonly FortressDwarf[] = [
  { name: "Urist",  job: "Miner",      x: 3,  y: 3 },
  { name: "Doren",  job: "Mason",       x: 5,  y: 4 },
  { name: "Kadol",  job: "Brewer",      x: 9,  y: 3 },
  { name: "Aban",   job: "Woodcutter",  x: 4,  y: 6 },
  { name: "Likot",  job: "Farmer",      x: 10, y: 7 },
  { name: "Morul",  job: "Idle",        x: 6,  y: 5 },
  { name: "Fikod",  job: "Hauling",     x: 11, y: 4 },
];

/** Build a lookup map keyed by "x,y" for O(1) checks during rendering. */
export const DWARF_POSITION_MAP: ReadonlyMap<string, FortressDwarf> = new Map(
  FORTRESS_DWARVES.map((d) => [`${d.x},${d.y}`, d]),
);
