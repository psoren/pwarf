import {
  FOOD_RESTORE_AMOUNT,
  DRINK_RESTORE_AMOUNT,
  FLOOR_SLEEP_STRESS,
  MAX_NEED,
  XP_MINE,
  XP_FARM_TILL,
  XP_FARM_PLANT,
  XP_FARM_HARVEST,
  WORK_FARM_PLANT_BASE,
  WORK_FARM_HARVEST_BASE,
  XP_BUILD,
  XP_HAUL,
  XP_BREW,
  XP_COOK,
  XP_SMITH,
  XP_FORAGE,
  MORALE_RESTORE_SKILLED_TASK,
  MORALE_RESTORE_HAUL_TASK,
  SKILL_TIER_NAMES,
  AUTONOMOUS_TASK_TYPES,
  generateCaveName,
  getCaveSeed,
} from "@pwarf/shared";
import type { Dwarf, FortressTile, FortressTileType, Task, Item, Structure } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { canPickUp } from "../inventory.js";
import { dwarfName } from "../dwarf-utils.js";
import { createTask } from "../task-helpers.js";
import { consumeResources } from "../resource-check.js";

/** Build task type → resulting fortress tile type. */
const BUILD_TILE_MAP: Record<string, FortressTileType> = {
  build_wall: 'constructed_wall',
  build_floor: 'constructed_floor',
};

/**
 * Completes a task: marks it done, clears the dwarf's assignment,
 * fires a completion event, and applies task-type-specific effects.
 */
export function completeTask(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  const { state } = ctx;

  // For build tasks, try to consume resources before completing.
  // If resources are unavailable, revert the task to pending so it can be retried later.
  let buildSuccess = true;
  switch (task.task_type) {
    case 'build_wall':
    case 'build_floor':
      buildSuccess = completeBuild(task, ctx);
      break;
    case 'build_bed':
      buildSuccess = completeBuildBed(task, ctx);
      break;
    case 'build_well':
      buildSuccess = completeBuildStructure(task, ctx, 'well', 'well');
      break;
    case 'build_mushroom_garden':
      buildSuccess = completeBuildStructure(task, ctx, 'mushroom_garden', 'mushroom_garden');
      break;
    case 'build_door':
      buildSuccess = completeBuildStructure(task, ctx, 'door', 'door');
      break;
  }

  if (!buildSuccess) {
    // Not enough resources — revert task to pending and free the dwarf
    task.status = 'pending';
    task.assigned_dwarf_id = null;
    task.work_progress = 0;
    state.dirtyTaskIds.add(task.id);
    dwarf.current_task_id = null;
    state.dirtyDwarfIds.add(dwarf.id);

    const dwarfLabel = dwarfName(dwarf);
    const taskLabel = task.task_type.replace(/_/g, ' ');
    state.pendingEvents.push({
      id: ctx.rng.uuid(),
      world_id: '',
      year: ctx.year,
      category: 'discovery',
      civilization_id: ctx.civilizationId,
      ruin_id: null,
      dwarf_id: dwarf.id,
      item_id: null,
      faction_id: null,
      monster_id: null,
      description: `${dwarfLabel} cannot ${taskLabel}: not enough resources.`,
      event_data: { task_type: task.task_type, task_id: task.id },
      created_at: new Date().toISOString(),
    });
    return;
  }

  task.status = 'completed';
  task.completed_at = new Date().toISOString();
  state.dirtyTaskIds.add(task.id);

  dwarf.current_task_id = null;
  state.dirtyDwarfIds.add(dwarf.id);

  // Fire completion event for player-created tasks
  if (!AUTONOMOUS_TASK_TYPES.has(task.task_type)) {
    const dwarfLabel = dwarfName(dwarf);
    const taskLabel = task.task_type.replace(/_/g, ' ');
    state.pendingEvents.push({
      id: ctx.rng.uuid(),
      world_id: '',
      year: ctx.year,
      category: 'discovery',
      civilization_id: ctx.civilizationId,
      ruin_id: null,
      dwarf_id: dwarf.id,
      item_id: null,
      faction_id: null,
      monster_id: null,
      description: `${dwarfLabel} has finished ${taskLabel}.`,
      event_data: { task_type: task.task_type, task_id: task.id },
      created_at: new Date().toISOString(),
    });
  }

  // Apply completion effects based on task type (non-build tasks)
  switch (task.task_type) {
    case 'mine':
      completeMine(dwarf, task, ctx);
      awardXp(dwarf.id, 'mining', XP_MINE, ctx, dwarf);
      break;
    case 'haul':
      completeHaul(dwarf, task, ctx);
      awardXp(dwarf.id, 'hauling', XP_HAUL, ctx, dwarf);
      break;
    case 'farm_till':
      awardXp(dwarf.id, 'farming', XP_FARM_TILL, ctx, dwarf);
      // Chain: till → plant
      if (task.target_x !== null && task.target_y !== null && task.target_z !== null) {
        createTask(ctx, {
          task_type: 'farm_plant',
          priority: task.priority,
          target_x: task.target_x,
          target_y: task.target_y,
          target_z: task.target_z,
          work_required: WORK_FARM_PLANT_BASE,
        });
      }
      break;
    case 'farm_plant':
      awardXp(dwarf.id, 'farming', XP_FARM_PLANT, ctx, dwarf);
      // Chain: plant → harvest
      if (task.target_x !== null && task.target_y !== null && task.target_z !== null) {
        createTask(ctx, {
          task_type: 'farm_harvest',
          priority: task.priority,
          target_x: task.target_x,
          target_y: task.target_y,
          target_z: task.target_z,
          work_required: WORK_FARM_HARVEST_BASE,
        });
      }
      break;
    case 'farm_harvest':
      completeFarmHarvest(task, ctx);
      awardXp(dwarf.id, 'farming', XP_FARM_HARVEST, ctx, dwarf);
      break;
    case 'eat':
      completeEat(dwarf, task, ctx);
      break;
    case 'drink':
      completeDrink(dwarf, task, ctx);
      break;
    case 'sleep':
      completeSleep(dwarf, task, ctx);
      break;
    case 'build_wall':
    case 'build_floor':
    case 'build_bed':
    case 'build_well':
    case 'build_mushroom_garden':
    case 'build_door':
      // Already handled above — just award XP
      awardXp(dwarf.id, 'building', XP_BUILD, ctx, dwarf);
      break;
    case 'deconstruct':
      completeDeconstruct(task, ctx);
      awardXp(dwarf.id, 'building', XP_BUILD, ctx, dwarf);
      break;
    case 'brew':
      completeBrew(dwarf, task, ctx);
      awardXp(dwarf.id, 'brewing', XP_BREW, ctx, dwarf);
      break;
    case 'cook':
      completeCook(dwarf, task, ctx);
      awardXp(dwarf.id, 'cooking', XP_COOK, ctx, dwarf);
      break;
    case 'smith':
      completeSmith(dwarf, task, ctx);
      awardXp(dwarf.id, 'smithing', XP_SMITH, ctx, dwarf);
      break;
    case 'forage':
      completeForage(dwarf, task, ctx);
      awardXp(dwarf.id, 'foraging', XP_FORAGE, ctx, dwarf);
      break;
    case 'scout_cave':
      completeScoutCave(dwarf, task, ctx);
      break;
  }

  // Morale restoration: work gives dwarves a sense of meaning (restores need_social which is morale)
  restoreMoraleOnTaskComplete(dwarf, task.task_type);
}

/**
 * Restores morale (need_social) on task completion.
 * Skilled tasks restore more than hauling. Autonomous tasks restore nothing.
 * Conscientiousness modifier: restore * (1 + (trait - 0.5) * 0.5)
 * Exported for unit testing.
 */
export function restoreMoraleOnTaskComplete(dwarf: Dwarf, taskType: string): void {
  const SKILLED_TASKS = new Set(['mine', 'build_wall', 'build_floor', 'build_bed', 'build_well', 'build_mushroom_garden', 'build_door', 'deconstruct', 'farm_till', 'farm_plant', 'farm_harvest', 'brew', 'cook', 'smith', 'forage']);
  let restore = SKILLED_TASKS.has(taskType)
    ? MORALE_RESTORE_SKILLED_TASK
    : taskType === 'haul'
      ? MORALE_RESTORE_HAUL_TASK
      : taskType === 'eat' || taskType === 'drink' || taskType === 'sleep'
        ? 0  // autonomous tasks don't restore morale
        : 0;

  if (restore > 0) {
    // Apply conscientiousness modifier
    if (dwarf.trait_conscientiousness !== null) {
      restore *= (1 + (dwarf.trait_conscientiousness - 0.5) * 0.5);
    }
    dwarf.need_social = Math.min(MAX_NEED, dwarf.need_social + restore);
  }
}

function completeMine(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return;

  // Look up the tile type being mined (check overrides first, then deriver)
  const key = `${task.target_x},${task.target_y},${task.target_z}`;
  const override = ctx.state.fortressTileOverrides.get(key);
  let tileType = override?.tile_type ?? null;
  if (!tileType && ctx.fortressDeriver) {
    tileType = ctx.fortressDeriver.deriveTile(task.target_x, task.target_y, task.target_z).tileType;
  }

  const { itemName, itemMaterial, itemWeight, itemValue } = getMineProduct(tileType);

  if (itemName) {
    const minedItem: Item = {
      id: ctx.rng.uuid(),
      name: itemName,
      category: 'raw_material',
      quality: 'standard',
      material: itemMaterial,
      weight: itemWeight,
      value: itemValue,
      is_artifact: false,
      created_by_dwarf_id: dwarf.id,
      created_in_civ_id: ctx.civilizationId,
      created_year: ctx.year,
      held_by_dwarf_id: null,
      located_in_civ_id: ctx.civilizationId,
      located_in_ruin_id: null,
      position_x: null,
      position_y: null,
      position_z: null,
      lore: null,
      properties: {},
      created_at: new Date().toISOString(),
    };

    // Dwarf picks up the item if they can carry it, otherwise drop at mine tile
    if (canPickUp(dwarf.id, minedItem, ctx.state.items)) {
      minedItem.held_by_dwarf_id = dwarf.id;
    } else {
      minedItem.position_x = task.target_x;
      minedItem.position_y = task.target_y;
      minedItem.position_z = task.target_z;
    }

    ctx.state.items.push(minedItem);
    ctx.state.dirtyItemIds.add(minedItem.id);
  }

  // Surface features (z=0) become the biome base tile (grass, mud, sand, etc.);
  // underground becomes open_air
  const baseTile = ctx.fortressDeriver?.baseTileType ?? 'grass';
  const resultTile: FortressTileType = task.target_z === 0 ? baseTile : 'open_air';
  upsertFortressTile(ctx, task.target_x, task.target_y, task.target_z, resultTile, null, true);
}

/** Returns the item produced when mining a given tile type. */
export function getMineProduct(tileType: string | null): {
  itemName: string | null;
  itemMaterial: string;
  itemWeight: number;
  itemValue: number;
} {
  switch (tileType) {
    case 'tree':
      return { itemName: 'Wood log', itemMaterial: 'wood', itemWeight: 8, itemValue: 2 };
    case 'rock':
      return { itemName: 'Stone block', itemMaterial: 'stone', itemWeight: 10, itemValue: 1 };
    case 'bush':
      return { itemName: null, itemMaterial: '', itemWeight: 0, itemValue: 0 };
    default:
      return { itemName: 'Stone block', itemMaterial: 'stone', itemWeight: 10, itemValue: 1 };
  }
}

function completeBuild(task: Task, ctx: SimContext): boolean {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return false;

  const tileType = BUILD_TILE_MAP[task.task_type];
  if (!tileType) return false;

  if (!consumeResources(task.task_type, ctx)) return false;

  upsertFortressTile(ctx, task.target_x, task.target_y, task.target_z, tileType, 'stone', false);
  return true;
}

function upsertFortressTile(
  ctx: SimContext,
  x: number, y: number, z: number,
  tileType: FortressTileType,
  material: string | null,
  isMined: boolean,
): void {
  const key = `${x},${y},${z}`;
  const existing = ctx.state.fortressTileOverrides.get(key);

  if (existing) {
    existing.tile_type = tileType;
    existing.material = material;
    existing.is_mined = isMined;
  } else {
    const tile: FortressTile = {
      id: ctx.rng.uuid(),
      civilization_id: ctx.civilizationId,
      x, y, z,
      tile_type: tileType,
      material,
      is_revealed: true,
      is_mined: isMined,
      created_at: new Date().toISOString(),
    };
    ctx.state.fortressTileOverrides.set(key, tile);
  }

  ctx.state.dirtyFortressTileKeys.add(key);
}

function completeHaul(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  if (!task.target_item_id) return;

  const item = ctx.state.items.find(i => i.id === task.target_item_id);
  if (!item) return;

  // Drop item at haul target position (stockpile tile)
  item.held_by_dwarf_id = null;
  item.position_x = task.target_x;
  item.position_y = task.target_y;
  item.position_z = task.target_z;
  item.located_in_civ_id = ctx.civilizationId;
  ctx.state.dirtyItemIds.add(item.id);
}

function completeFarmHarvest(task: Task, ctx: SimContext): void {
  const food: Item = {
    id: ctx.rng.uuid(),
    name: 'Plump helmet',
    category: 'food',
    quality: 'standard',
    material: 'plant',
    weight: 1,
    value: 2,
    is_artifact: false,
    created_by_dwarf_id: null,
    created_in_civ_id: ctx.civilizationId,
    created_year: ctx.year,
    held_by_dwarf_id: null,
    located_in_civ_id: ctx.civilizationId,
    located_in_ruin_id: null,
    position_x: task.target_x,
    position_y: task.target_y,
    position_z: task.target_z,
    lore: null,
    properties: {},
    created_at: new Date().toISOString(),
  };

  ctx.state.items.push(food);
  ctx.state.dirtyItemIds.add(food.id);
}

/**
 * Exported for unit testing.
 * Forageable food names — picked randomly based on whatever the tile yields.
 */
export const FORAGE_FOOD_NAMES = ['Wild mushroom', 'Berries'] as const;

function completeForage(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  const names = FORAGE_FOOD_NAMES;
  const name = names[Math.floor(ctx.rng.random() * names.length)]!;
  const food: Item = {
    id: ctx.rng.uuid(),
    name,
    category: 'food',
    quality: 'standard',
    material: 'plant',
    weight: 1,
    value: 1,
    is_artifact: false,
    created_by_dwarf_id: dwarf.id,
    created_in_civ_id: ctx.civilizationId,
    created_year: ctx.year,
    held_by_dwarf_id: null,
    located_in_civ_id: ctx.civilizationId,
    located_in_ruin_id: null,
    position_x: task.target_x,
    position_y: task.target_y,
    position_z: task.target_z,
    lore: null,
    properties: {},
    created_at: new Date().toISOString(),
  };

  ctx.state.items.push(food);
  ctx.state.dirtyItemIds.add(food.id);
}

function completeEat(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  if (task.target_item_id) {
    const itemIdx = ctx.state.items.findIndex(i => i.id === task.target_item_id);
    if (itemIdx !== -1) {
      ctx.state.items.splice(itemIdx, 1);
    }
  }

  dwarf.need_food = Math.min(MAX_NEED, dwarf.need_food + FOOD_RESTORE_AMOUNT);
  ctx.state.dirtyDwarfIds.add(dwarf.id);

  ctx.state.zeroFoodTicks.delete(dwarf.id);
}

function completeDrink(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  if (task.target_item_id) {
    const itemIdx = ctx.state.items.findIndex(i => i.id === task.target_item_id);
    if (itemIdx !== -1) {
      ctx.state.items.splice(itemIdx, 1);
    }
  }

  dwarf.need_drink = Math.min(MAX_NEED, dwarf.need_drink + DRINK_RESTORE_AMOUNT);
  ctx.state.dirtyDwarfIds.add(dwarf.id);

  ctx.state.zeroDrinkTicks.delete(dwarf.id);
}

function completeSleep(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  if (task.target_item_id) {
    // Was sleeping in a bed — release occupancy
    const bed = ctx.state.structures.find(s => s.id === task.target_item_id);
    if (bed) {
      bed.occupied_by_dwarf_id = null;
      ctx.state.dirtyStructureIds.add(bed.id);
    }
  } else {
    // Floor sleep — apply stress penalty
    dwarf.stress_level = Math.min(MAX_NEED, dwarf.stress_level + FLOOR_SLEEP_STRESS);
  }
  ctx.state.dirtyDwarfIds.add(dwarf.id);
}

function completeBuildBed(task: Task, ctx: SimContext): boolean {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return false;

  if (!consumeResources(task.task_type, ctx)) return false;

  const bed: Structure = {
    id: ctx.rng.uuid(),
    civilization_id: ctx.civilizationId,
    name: null,
    type: 'bed',
    completion_pct: 100,
    built_year: ctx.year,
    ruin_id: null,
    quality: 'standard',
    notes: null,
    position_x: task.target_x,
    position_y: task.target_y,
    position_z: task.target_z,
    occupied_by_dwarf_id: null,
  };

  ctx.state.structures.push(bed);
  ctx.state.dirtyStructureIds.add(bed.id);

  // Place bed tile for rendering
  upsertFortressTile(ctx, task.target_x, task.target_y, task.target_z, 'bed', 'wood', false);
  return true;
}

/**
 * Generic handler for structures that don't need special logic beyond
 * creating a Structure record and placing a tile (well, mushroom_garden, etc.).
 */
function completeBuildStructure(
  task: Task,
  ctx: SimContext,
  structureType: string,
  tileType: FortressTileType,
): boolean {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return false;

  if (!consumeResources(task.task_type, ctx)) return false;

  const structure: Structure = {
    id: ctx.rng.uuid(),
    civilization_id: ctx.civilizationId,
    name: null,
    type: structureType,
    completion_pct: 100,
    built_year: ctx.year,
    ruin_id: null,
    quality: 'standard',
    notes: null,
    position_x: task.target_x,
    position_y: task.target_y,
    position_z: task.target_z,
    occupied_by_dwarf_id: null,
  };

  ctx.state.structures.push(structure);
  ctx.state.dirtyStructureIds.add(structure.id);

  upsertFortressTile(ctx, task.target_x, task.target_y, task.target_z, tileType, 'stone', false);
  return true;
}

/** Deconstructible tile types — only these can be targeted for removal. */
const DECONSTRUCTIBLE_TILES = new Set([
  'constructed_wall', 'constructed_floor', 'bed', 'well', 'mushroom_garden', 'door',
]);

function completeDeconstruct(task: Task, ctx: SimContext): void {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return;

  const key = `${task.target_x},${task.target_y},${task.target_z}`;
  const tileOverride = ctx.state.fortressTileOverrides.get(key);
  const tileType = tileOverride?.tile_type ?? null;

  // Only remove deconstructible tiles
  if (tileType && !DECONSTRUCTIBLE_TILES.has(tileType)) return;

  // Release bed occupancy if someone is sleeping in it
  if (tileType === 'bed') {
    const bed = ctx.state.structures.find(
      s => s.type === 'bed'
        && s.position_x === task.target_x
        && s.position_y === task.target_y
        && s.position_z === task.target_z,
    );
    if (bed) {
      // Evict sleeping dwarf
      if (bed.occupied_by_dwarf_id) {
        const occupant = ctx.state.dwarves.find(d => d.id === bed.occupied_by_dwarf_id);
        if (occupant) {
          occupant.current_task_id = null;
          ctx.state.dirtyDwarfIds.add(occupant.id);
        }
      }
      const idx = ctx.state.structures.indexOf(bed);
      if (idx !== -1) ctx.state.structures.splice(idx, 1);
      ctx.state.dirtyStructureIds.add(bed.id);
    }
  }

  // Remove other structures (well, mushroom_garden, door) at this tile
  if (tileType === 'well' || tileType === 'mushroom_garden' || tileType === 'door') {
    const structIdx = ctx.state.structures.findIndex(
      s => s.position_x === task.target_x
        && s.position_y === task.target_y
        && s.position_z === task.target_z,
    );
    if (structIdx !== -1) {
      const [removed] = ctx.state.structures.splice(structIdx, 1);
      ctx.state.dirtyStructureIds.add(removed.id);
    }
  }

  // Restore tile to open_air
  upsertFortressTile(ctx, task.target_x, task.target_y, task.target_z, 'open_air', null, false);
}

/**
 * Brew: consumes a plant item at the target tile, creates an ale (drink item).
 * Exported for unit testing.
 */
export function completeBrew(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return;

  // Consume a plant raw_material at the target tile (or anywhere in inventory)
  const plant = findItemAt(ctx, task.target_x, task.target_y, task.target_z, 'raw_material', 'plant') ??
    findItemHeldBy(ctx, dwarf.id, 'raw_material', 'plant');
  if (plant) {
    const idx = ctx.state.items.findIndex(i => i.id === plant.id);
    if (idx !== -1) ctx.state.items.splice(idx, 1);
    ctx.state.dirtyItemIds.add(plant.id);
  }

  // Produce ale drink item
  const ale: Item = {
    id: ctx.rng.uuid(),
    name: 'Plump helmet brew',
    category: 'drink',
    quality: 'standard',
    material: 'plant',
    weight: 1,
    value: 3,
    is_artifact: false,
    created_by_dwarf_id: dwarf.id,
    created_in_civ_id: ctx.civilizationId,
    created_year: ctx.year,
    held_by_dwarf_id: null,
    located_in_civ_id: ctx.civilizationId,
    located_in_ruin_id: null,
    position_x: task.target_x,
    position_y: task.target_y,
    position_z: task.target_z,
    lore: null,
    properties: {},
    created_at: new Date().toISOString(),
  };
  ctx.state.items.push(ale);
  ctx.state.dirtyItemIds.add(ale.id);
}

/**
 * Cook: consumes a food item at the target tile, creates a prepared meal (higher value).
 * Exported for unit testing.
 */
export function completeCook(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return;

  const ingredient = findItemAt(ctx, task.target_x, task.target_y, task.target_z, 'food') ??
    findItemHeldBy(ctx, dwarf.id, 'food');
  if (ingredient) {
    const idx = ctx.state.items.findIndex(i => i.id === ingredient.id);
    if (idx !== -1) ctx.state.items.splice(idx, 1);
    ctx.state.dirtyItemIds.add(ingredient.id);
  }

  const meal: Item = {
    id: ctx.rng.uuid(),
    name: 'Prepared meal',
    category: 'food',
    quality: 'fine',
    material: 'cooked',
    weight: 1,
    value: 5,
    is_artifact: false,
    created_by_dwarf_id: dwarf.id,
    created_in_civ_id: ctx.civilizationId,
    created_year: ctx.year,
    held_by_dwarf_id: null,
    located_in_civ_id: ctx.civilizationId,
    located_in_ruin_id: null,
    position_x: task.target_x,
    position_y: task.target_y,
    position_z: task.target_z,
    lore: null,
    properties: {},
    created_at: new Date().toISOString(),
  };
  ctx.state.items.push(meal);
  ctx.state.dirtyItemIds.add(meal.id);
}

/**
 * Smith: consumes an ore/metal raw_material item, creates a tool.
 * Exported for unit testing.
 */
export function completeSmith(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return;

  const ore = findItemAt(ctx, task.target_x, task.target_y, task.target_z, 'raw_material') ??
    findItemHeldBy(ctx, dwarf.id, 'raw_material');
  if (ore) {
    const idx = ctx.state.items.findIndex(i => i.id === ore.id);
    if (idx !== -1) ctx.state.items.splice(idx, 1);
    ctx.state.dirtyItemIds.add(ore.id);
  }

  const tool: Item = {
    id: ctx.rng.uuid(),
    name: 'Stone pick',
    category: 'tool',
    quality: 'standard',
    material: ore?.material ?? 'stone',
    weight: 3,
    value: 8,
    is_artifact: false,
    created_by_dwarf_id: dwarf.id,
    created_in_civ_id: ctx.civilizationId,
    created_year: ctx.year,
    held_by_dwarf_id: null,
    located_in_civ_id: ctx.civilizationId,
    located_in_ruin_id: null,
    position_x: task.target_x,
    position_y: task.target_y,
    position_z: task.target_z,
    lore: null,
    properties: {},
    created_at: new Date().toISOString(),
  };
  ctx.state.items.push(tool);
  ctx.state.dirtyItemIds.add(tool.id);
}

/**
 * Scout cave: on completion, mark the cave as discovered by writing a marker
 * tile at the cave's z-level, generate a cave name, and fire a discovery event.
 * Exported for unit testing.
 */
export function completeScoutCave(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  if (task.target_x === null || task.target_y === null) return;

  const deriver = ctx.fortressDeriver;
  if (!deriver) return;

  const caveZ = deriver.getZForEntrance(task.target_x, task.target_y);
  if (caveZ === null) return;

  const caveName = deriver.getCaveName(caveZ) ?? 'an unknown cave';

  // Write a marker tile at the entrance position in the cave z-level
  // This signals to the UI that the cave has been discovered
  upsertFortressTile(ctx, task.target_x, task.target_y, caveZ, 'cavern_floor', null, false);

  // Fire discovery event
  const dwarfLabel = dwarfName(dwarf);
  ctx.state.pendingEvents.push({
    id: ctx.rng.uuid(),
    world_id: '',
    year: ctx.year,
    category: 'discovery',
    civilization_id: ctx.civilizationId,
    ruin_id: null,
    dwarf_id: dwarf.id,
    item_id: null,
    faction_id: null,
    monster_id: null,
    description: `${dwarfLabel} discovered ${caveName}!`,
    event_data: { action: 'scout_cave', cave_name: caveName, cave_z: caveZ },
    created_at: new Date().toISOString(),
  });
}

/** Find the first item at a given tile position with the given category (and optionally material). */
function findItemAt(ctx: SimContext, x: number, y: number, z: number, category: string, material?: string): Item | undefined {
  return ctx.state.items.find(
    i => i.category === category
      && (material === undefined || i.material === material)
      && i.position_x === x
      && i.position_y === y
      && i.position_z === z
      && i.held_by_dwarf_id === null,
  );
}

/** Find the first item held by a dwarf with the given category (and optionally material). */
function findItemHeldBy(ctx: SimContext, dwarfId: string, category: string, material?: string): Item | undefined {
  return ctx.state.items.find(i => i.category === category && (material === undefined || i.material === material) && i.held_by_dwarf_id === dwarfId);
}

function awardXp(dwarfId: string, skillName: string, xpAmount: number, ctx: SimContext, dwarf: Dwarf): void {
  const { state } = ctx;
  const skill = state.dwarfSkills.find(s => s.dwarf_id === dwarfId && s.skill_name === skillName);
  if (skill) {
    skill.xp += xpAmount;
    const newLevel = Math.floor(skill.xp / 100);
    if (newLevel > skill.level && newLevel <= 20) {
      skill.level = newLevel;
      state.dirtyDwarfSkillIds.add(skill.id);
      const tierName = SKILL_TIER_NAMES[newLevel] ?? `Level ${newLevel}`;
      const dwarfLabel = dwarfName(dwarf);
      const readableSkill = skillName.replace(/_/g, ' ');
      state.pendingEvents.push({
        id: ctx.rng.uuid(),
        world_id: '',
        year: ctx.year,
        category: 'discovery',
        civilization_id: ctx.civilizationId,
        ruin_id: null,
        dwarf_id: dwarf.id,
        item_id: null,
        faction_id: null,
        monster_id: null,
        description: `${dwarfLabel} has become a ${tierName} ${readableSkill}!`,
        event_data: { skill_name: skillName, new_level: newLevel, tier: tierName },
        created_at: new Date().toISOString(),
      });
    }
  }
}
