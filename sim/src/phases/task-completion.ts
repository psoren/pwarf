import {
  FOOD_RESTORE_AMOUNT,
  DRINK_RESTORE_AMOUNT,
  MAX_NEED,
  XP_MINE,
  XP_FARM_TILL,
  XP_FARM_PLANT,
  XP_FARM_HARVEST,
  XP_BUILD,
  XP_HAUL,
} from "@pwarf/shared";
import type { Dwarf, FortressTile, FortressTileType, Task, Item } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { canPickUp } from "../inventory.js";

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

  task.status = 'completed';
  task.completed_at = new Date().toISOString();
  state.dirtyTaskIds.add(task.id);

  dwarf.current_task_id = null;
  state.dirtyDwarfIds.add(dwarf.id);

  // Fire completion event for player-created tasks
  const autonomousTypes: string[] = ['eat', 'drink', 'sleep', 'wander'];
  if (!autonomousTypes.includes(task.task_type)) {
    const dwarfLabel = `${dwarf.name}${dwarf.surname ? ' ' + dwarf.surname : ''}`;
    const taskLabel = task.task_type.replace(/_/g, ' ');
    state.pendingEvents.push({
      id: crypto.randomUUID(),
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

  // Apply completion effects based on task type
  switch (task.task_type) {
    case 'mine':
      completeMine(dwarf, task, ctx);
      awardXp(dwarf.id, 'mining', XP_MINE, state);
      break;
    case 'haul':
      completeHaul(dwarf, task, ctx);
      awardXp(dwarf.id, 'hauling', XP_HAUL, state);
      break;
    case 'farm_till':
      awardXp(dwarf.id, 'farming', XP_FARM_TILL, state);
      break;
    case 'farm_plant':
      awardXp(dwarf.id, 'farming', XP_FARM_PLANT, state);
      break;
    case 'farm_harvest':
      completeFarmHarvest(task, ctx);
      awardXp(dwarf.id, 'farming', XP_FARM_HARVEST, state);
      break;
    case 'eat':
      completeEat(dwarf, task, ctx);
      break;
    case 'drink':
      completeDrink(dwarf, task, ctx);
      break;
    case 'sleep':
      completeSleep(dwarf, ctx);
      break;
    case 'build_wall':
    case 'build_floor':
      completeBuild(task, ctx);
      awardXp(dwarf.id, 'building', XP_BUILD, state);
      break;
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
      id: crypto.randomUUID(),
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

  // Surface features (z=0) become grass; underground becomes open_air
  const resultTile: FortressTileType = task.target_z === 0 ? 'grass' : 'open_air';
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

function completeBuild(task: Task, ctx: SimContext): void {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return;

  const tileType = BUILD_TILE_MAP[task.task_type];
  if (!tileType) return;

  upsertFortressTile(ctx, task.target_x, task.target_y, task.target_z, tileType, 'stone', false);
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
      id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
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

function completeSleep(_dwarf: Dwarf, _ctx: SimContext): void {
  // Sleep restoration happens gradually each tick in task-execution.
  // Nothing extra to do on completion.
}

function awardXp(dwarfId: string, skillName: string, xpAmount: number, state: SimContext['state']): void {
  const skill = state.dwarfSkills.find(s => s.dwarf_id === dwarfId && s.skill_name === skillName);
  if (skill) {
    skill.xp += xpAmount;
    const newLevel = Math.floor(skill.xp / 100);
    if (newLevel > skill.level && newLevel <= 20) {
      skill.level = newLevel;
    }
  }
}
