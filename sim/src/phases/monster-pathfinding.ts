import type { SimContext } from "../sim-context.js";

/**
 * Monster Pathfinding Phase
 *
 * For each active monster, advances its position one step along its path
 * toward its current target (nearest dwarf, fortress entrance, etc.).
 * Recalculates paths when blocked or when the target moves.
 */
export async function monsterPathfinding(_ctx: SimContext): Promise<void> {
  // stub
}
