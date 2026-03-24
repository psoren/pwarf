import type { Expedition, Ruin, Dwarf, DwarfSkill, ItemCategory, ItemQuality } from "@pwarf/shared";

/** Outcome produced by resolving an expedition at a ruin. */
export interface ExpeditionOutcome {
  survivingDwarfIds: string[];
  lostDwarfIds: string[];
  lootedItems: Array<{ category: ItemCategory; material: string; quality: ItemQuality }>;
  wealthExtracted: number;
  log: string;
}

const LOOT_CATEGORIES: ItemCategory[] = ['gem', 'weapon', 'armor', 'crafted', 'raw_material'];
const LOOT_MATERIALS = ['iron', 'bronze', 'gold', 'silver', 'obsidian', 'crystal', 'bone', 'jade'];

const QUALITY_TIERS: ItemQuality[] = ['standard', 'fine', 'superior', 'exceptional', 'masterwork'];

/**
 * Pure function that resolves an expedition's encounter at a ruin.
 *
 * Deterministic when given a seeded RNG. No side effects — caller is
 * responsible for applying the outcome to sim state.
 */
export function resolveExpedition(params: {
  expedition: Expedition;
  ruin: Ruin;
  dwarves: Dwarf[];
  dwarfSkills: DwarfSkill[];
  rng: { random(): number };
}): ExpeditionOutcome {
  const { ruin, dwarves, dwarfSkills, rng } = params;

  // --- Calculate effective danger ---
  let effectiveDanger = ruin.danger_level;
  if (ruin.resident_monster_id) effectiveDanger += 20;
  if (ruin.is_trapped) effectiveDanger += 15;
  if (ruin.is_contaminated) effectiveDanger += 10;

  // --- Party strength (informational, not currently used in survival roll) ---
  const combatLevels = dwarves.reduce((sum, d) => {
    const fighting = dwarfSkills.find(s => s.dwarf_id === d.id && s.skill_name === 'fighting');
    return sum + (fighting?.level ?? 0);
  }, 0);
  const _partyStrength = combatLevels + dwarves.length;

  // --- Per-dwarf survival roll ---
  const survivingDwarfIds: string[] = [];
  const lostDwarfIds: string[] = [];
  const logParts: string[] = [];

  for (const dwarf of dwarves) {
    const survivalRoll = rng.random();
    const deathThreshold = effectiveDanger / 200;
    if (survivalRoll > deathThreshold) {
      survivingDwarfIds.push(dwarf.id);
    } else {
      lostDwarfIds.push(dwarf.id);
      logParts.push(`${dwarf.name} was lost in the ruins.`);
    }
  }

  // --- Loot generation ---
  const lootedItems: ExpeditionOutcome['lootedItems'] = [];
  let wealthExtracted = 0;

  if (ruin.remaining_wealth > 0 && survivingDwarfIds.length > 0) {
    const lootCount = Math.max(1, Math.min(5, Math.floor(ruin.remaining_wealth / 500)));

    for (let i = 0; i < lootCount; i++) {
      const category = LOOT_CATEGORIES[Math.floor(rng.random() * LOOT_CATEGORIES.length)]!;
      const material = LOOT_MATERIALS[Math.floor(rng.random() * LOOT_MATERIALS.length)]!;

      // Quality scales with wealth — higher wealth ruins yield better loot
      const qualityIndex = Math.min(
        QUALITY_TIERS.length - 1,
        Math.floor((ruin.remaining_wealth / 10000) * QUALITY_TIERS.length * rng.random()),
      );
      const quality = QUALITY_TIERS[qualityIndex]!;

      const itemValue = Math.floor(50 + rng.random() * (ruin.remaining_wealth / lootCount));
      wealthExtracted += itemValue;

      lootedItems.push({ category, material, quality });
    }

    // Clamp extracted wealth to remaining
    wealthExtracted = Math.min(wealthExtracted, ruin.remaining_wealth);
  }

  // --- Build narrative log ---
  if (survivingDwarfIds.length === dwarves.length) {
    logParts.unshift('The expedition returned without casualties.');
  } else if (survivingDwarfIds.length === 0) {
    logParts.unshift('The expedition was a total loss. No one returned.');
  } else {
    logParts.unshift(`${lostDwarfIds.length} of ${dwarves.length} dwarves were lost.`);
  }

  if (lootedItems.length > 0) {
    logParts.push(`${lootedItems.length} items were recovered from the ruins.`);
  } else {
    logParts.push('No loot was recovered.');
  }

  return {
    survivingDwarfIds,
    lostDwarfIds,
    lootedItems,
    wealthExtracted,
    log: logParts.join(' '),
  };
}
