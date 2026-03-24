import { describe, it, expect } from "vitest";
import { sanitizeDanglingRefs } from "../flush-state.js";
import { makeDwarf, makeTask, makeItem, makeStructure } from "./test-helpers.js";
import { createEmptyCachedState } from "../sim-context.js";

describe("sanitizeDanglingRefs", () => {
  it("nulls target_item_id when referenced item no longer exists", () => {
    const state = createEmptyCachedState();
    const item = makeItem({ name: "Food" });
    // Item was consumed — NOT in state.items
    const task = makeTask("eat", {
      target_item_id: item.id,
      status: "completed",
    });
    state.tasks.push(task);

    sanitizeDanglingRefs(state);

    expect(task.target_item_id).toBeNull();
    expect(state.dirtyTaskIds.has(task.id)).toBe(true);
  });

  it("preserves target_item_id when referenced item still exists", () => {
    const state = createEmptyCachedState();
    const item = makeItem({ name: "Food" });
    state.items.push(item);
    const task = makeTask("eat", {
      target_item_id: item.id,
      status: "in_progress",
    });
    state.tasks.push(task);

    sanitizeDanglingRefs(state);

    expect(task.target_item_id).toBe(item.id);
  });

  it("preserves target_item_id when it references a structure (sleep/bed)", () => {
    const state = createEmptyCachedState();
    const bed = makeStructure({ type: "bed" });
    state.structures.push(bed);
    const task = makeTask("sleep", {
      target_item_id: bed.id,
      status: "in_progress",
    });
    state.tasks.push(task);

    sanitizeDanglingRefs(state);

    expect(task.target_item_id).toBe(bed.id);
  });

  it("removes completed new tasks with dangling item refs", () => {
    const state = createEmptyCachedState();
    const task = makeTask("eat", {
      target_item_id: "deleted-food-id",
      status: "completed",
    });
    state.tasks.push(task);
    state.newTasks.push(task);

    sanitizeDanglingRefs(state);

    // target_item_id nulled first, then task removed from newTasks
    expect(task.target_item_id).toBeNull();
    expect(state.newTasks).not.toContain(task);
    expect(state.dirtyTaskIds.has(task.id)).toBe(false);
  });

  it("keeps pending new tasks even with dangling refs (they may be retried)", () => {
    const state = createEmptyCachedState();
    const task = makeTask("haul", {
      target_item_id: "deleted-item-id",
      status: "pending",
    });
    state.tasks.push(task);
    state.newTasks.push(task);

    sanitizeDanglingRefs(state);

    // target_item_id is nulled, but task stays in newTasks (it's still pending)
    expect(task.target_item_id).toBeNull();
    expect(state.newTasks).toContain(task);
  });

  it("handles tasks with null target_item_id (no-op)", () => {
    const state = createEmptyCachedState();
    const task = makeTask("mine", {
      target_item_id: null,
      status: "pending",
    });
    state.tasks.push(task);

    sanitizeDanglingRefs(state);

    expect(task.target_item_id).toBeNull();
    // Should NOT be marked dirty since nothing changed
    expect(state.dirtyTaskIds.has(task.id)).toBe(false);
  });
});
