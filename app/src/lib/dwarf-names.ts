export const DWARF_NAMES = [
  'Urist', 'Doren', 'Kadol', 'Aban', 'Likot', 'Morul', 'Fikod',
  'Bomrek', 'Ducim', 'Erith', 'Goden', 'Ingiz', 'Kumil', 'Litast',
  'Mosus', 'Nish', 'Olon', 'Rigoth', 'Sodel', 'Tekkud',
];

export const SURNAMES = [
  'Hammerstone', 'Ironpick', 'Deepdelve', 'Coppervein', 'Granitearm',
  'Boulderfist', 'Axebeard', 'Goldseam', 'Rockjaw', 'Tunnelborn',
];

/** Pick `count` unique names from the name list */
export function pickUniqueNames(count: number): string[] {
  const pool = [...DWARF_NAMES];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}
