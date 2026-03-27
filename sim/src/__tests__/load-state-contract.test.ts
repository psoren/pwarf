import { describe, it, expect, beforeEach } from "vitest";
import type { CachedState } from "../sim-context.js";
import { createEmptyCachedState } from "../sim-context.js";
import { makeDwarf, makeTask, makeItem } from "./test-helpers.js";

/**
 * Contract tests for CachedState — verifies that the state shape
 * expected by sim phases matches what loadStateFromSupabase produces.
 *
 * These tests don't hit the DB. They verify that createEmptyCachedState()
 * includes every field the sim accesses, catching cases where a new field
 * is added to a phase but forgotten in the state initializer.
 */
describe("CachedState contract", () => {
  let state: CachedState;

  beforeEach(() => {
    state = createEmptyCachedState();
  });

  it("has all entity arrays initialized empty", () => {
    expect(state.dwarves).toEqual([]);
    expect(state.items).toEqual([]);
    expect(state.structures).toEqual([]);
    expect(state.monsters).toEqual([]);
    expect(state.tasks).toEqual([]);
    expect(state.dwarfSkills).toEqual([]);
    expect(state.dwarfRelationships).toEqual([]);
    expect(state.worldEvents).toEqual([]);
  });

  it("has all dirty tracking sets initialized empty", () => {
    expect(state.dirtyDwarfIds.size).toBe(0);
    expect(state.dirtyItemIds.size).toBe(0);
    expect(state.dirtyStructureIds.size).toBe(0);
    expect(state.dirtyMonsterIds.size).toBe(0);
    expect(state.dirtyTaskIds.size).toBe(0);
    expect(state.dirtyDwarfSkillIds.size).toBe(0);
    expect(state.dirtyFortressTileKeys.size).toBe(0);
    expect(state.dirtyDwarfRelationshipIds.size).toBe(0);
  });

  it("has all staging arrays initialized empty", () => {
    expect(state.newTasks).toEqual([]);
    expect(state.newDwarfRelationships).toEqual([]);
    expect(state.pendingEvents).toEqual([]);
  });

  it("has all maps initialized empty", () => {
    expect(state.stockpileTiles.size).toBe(0);
    expect(state.fortressTileOverrides.size).toBe(0);
    expect(state.zeroFoodTicks.size).toBe(0);
    expect(state.zeroDrinkTicks.size).toBe(0);
    expect(state.tantrumTicks.size).toBe(0);
    expect(state.warnedNeedIds.size).toBe(0);
  });

  it("has civilization state initialized", () => {
    expect(state.civPopulation).toBe(0);
    expect(state.civWealth).toBe(0);
    expect(state.civDirty).toBe(false);
    expect(state.civFallen).toBe(false);
  });

  it("flush-state can access all fields it needs without crashing", async () => {
    // Import sanitizeDanglingRefs and run it on empty state
    // This catches missing fields that would cause runtime errors
    const { sanitizeDanglingRefs } = await import("../flush-state.js");
    expect(() => sanitizeDanglingRefs(state)).not.toThrow();
  });

  it("flush-state fields used by RPC are present on entities", () => {
    // Verify the shape of entities matches what flush_state() RPC expects.
    // If a field is missing, jsonb_populate_recordset will silently null it.
    const requiredDwarfFields = [
      'id', 'civilization_id', 'name', 'surname', 'status', 'age', 'gender',
      'need_food', 'need_drink', 'need_sleep', 'need_social',
      'stress_level', 'is_in_tantrum', 'health', 'memories',
      'current_task_id', 'position_x', 'position_y', 'position_z',
    ];
    const requiredTaskFields = [
      'id', 'civilization_id', 'task_type', 'status', 'priority',
      'assigned_dwarf_id', 'target_x', 'target_y', 'target_z', 'target_item_id',
      'work_progress', 'work_required', 'created_at', 'completed_at',
    ];
    const requiredItemFields = [
      'id', 'name', 'category', 'quality', 'material', 'weight', 'value',
      'is_artifact', 'created_by_dwarf_id', 'created_in_civ_id', 'created_year',
      'held_by_dwarf_id', 'located_in_civ_id',
      'position_x', 'position_y', 'position_z',
    ];

    const dwarf = makeDwarf();
    const task = makeTask("mine");
    const item = makeItem();

    for (const field of requiredDwarfFields) {
      expect(dwarf).toHaveProperty(field);
    }
    for (const field of requiredTaskFields) {
      expect(task).toHaveProperty(field);
    }
    for (const field of requiredItemFields) {
      expect(item).toHaveProperty(field);
    }
  });
});
