import type { SimContext } from "../sim-context.js";

/**
 * Tantrum Check Phase
 *
 * Evaluates each dwarf whose stress exceeds the tantrum threshold. Triggers
 * a tantrum event which may cause the dwarf to destroy items, start fights
 * with other dwarves, or go berserk. Severity scales with stress level.
 */
export async function tantrumCheck(_ctx: SimContext): Promise<void> {
  // stub
}
