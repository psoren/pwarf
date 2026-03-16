import type { SimContext } from "../sim-context.js";

/**
 * Job Claiming Phase
 *
 * Finds all idle dwarves (those without a current task) and matches them
 * to available work orders based on skill, proximity, and priority.
 * Assigns the best-fit job to each idle dwarf.
 */
export async function jobClaiming(_ctx: SimContext): Promise<void> {
  // stub
}
