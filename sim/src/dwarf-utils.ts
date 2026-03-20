import type { Dwarf } from "@pwarf/shared";

/** Returns the dwarf's full name, including surname if present. */
export function dwarfName(d: Pick<Dwarf, 'name' | 'surname'>): string {
  return d.surname ? `${d.name} ${d.surname}` : d.name;
}
