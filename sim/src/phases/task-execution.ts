import type { SimContext } from "../sim-context.js";

/**
 * Task Execution Phase
 *
 * For each dwarf that has a claimed job, advances that job by one work step.
 * Handles pathfinding progress, material hauling, and skill-based work speed.
 * Completes jobs when their remaining work reaches zero.
 */
export async function taskExecution(_ctx: SimContext): Promise<void> {
  // stub
}
