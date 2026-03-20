import { DWARF_FIRST_NAMES, DWARF_SURNAMES } from '@pwarf/shared';

export { DWARF_FIRST_NAMES as DWARF_NAMES, DWARF_SURNAMES as SURNAMES };

/** Pick `count` unique names from the name list */
export function pickUniqueNames(count: number): string[] {
  const pool = [...DWARF_FIRST_NAMES];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}
