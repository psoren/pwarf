import type { SimContext } from "../sim-context.js";

/**
 * Construction Progress Phase
 *
 * Advances all active construction/build jobs by one step. Checks material
 * availability, builder assignment, and skill modifiers. Marks structures
 * as complete when their build progress reaches 100%.
 */
export async function constructionProgress(_ctx: SimContext): Promise<void> {
  // stub
}
