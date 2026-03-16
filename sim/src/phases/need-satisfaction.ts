import type { SimContext } from "../sim-context.js";

/**
 * Need Satisfaction Phase
 *
 * Checks whether dwarves are adjacent to or on top of need-satisfying sources
 * (food stockpiles, drink barrels, beds, meeting halls). If so, consumes
 * the resource and refills the corresponding need meter.
 */
export async function needSatisfaction(_ctx: SimContext): Promise<void> {
  // stub
}
