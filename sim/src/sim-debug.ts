import type { SimContext } from "./sim-context.js";

/** Log categories for sim debug output. */
export type DebugCategory = 'pathfinding' | 'task' | 'timing' | 'phase';

/**
 * Log a debug message if debug mode is enabled on the context.
 * No-op when ctx.debug is false/undefined (zero overhead in production).
 */
export function simDebug(ctx: SimContext, category: DebugCategory, message: string): void {
  if (!ctx.debug) return;

  const debugLog = ctx.debugLog;
  if (debugLog) {
    debugLog.push({ step: ctx.step, category, message });
  }

  // Also log to console in non-test environments
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    console.warn(`[sim:${category}] step=${ctx.step} ${message}`);
  }
}

/** A single debug log entry. */
export interface DebugLogEntry {
  step: number;
  category: DebugCategory;
  message: string;
}
