import { describe, it, expect } from "vitest";
import { DebugLogger, debugPathfindingFailure, debugTaskFailure } from "./debug.js";

describe("DebugLogger", () => {
  it("collects entries with the current step", () => {
    const logger = new DebugLogger();
    logger.setStep(42);
    logger.warn("pathfinding", "test message", { foo: 1 });

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]).toEqual({
      step: 42,
      category: "pathfinding",
      message: "test message",
      data: { foo: 1 },
    });
  });

  it("drain() returns and clears entries", () => {
    const logger = new DebugLogger();
    logger.setStep(1);
    logger.warn("task_failure", "a");
    logger.warn("task_failure", "b");

    const drained = logger.drain();
    expect(drained).toHaveLength(2);
    expect(logger.entries).toHaveLength(0);
  });

  it("detects task cycling after threshold failures", () => {
    const logger = new DebugLogger();
    logger.setStep(1);

    // Record failures below threshold — no task_cycle entry
    for (let i = 0; i < DebugLogger.CYCLE_THRESHOLD - 1; i++) {
      logger.recordTaskFailure("task-1", "mine", "Urist", "pathfinding");
    }
    const beforeEntries = logger.entries.filter(e => e.category === "task_cycle");
    expect(beforeEntries).toHaveLength(0);

    // One more failure triggers a cycle warning
    logger.recordTaskFailure("task-1", "mine", "Urist", "pathfinding");
    const cycleEntries = logger.entries.filter(e => e.category === "task_cycle");
    expect(cycleEntries).toHaveLength(1);
    expect(cycleEntries[0].message).toContain("task-1");
    expect(cycleEntries[0].message).toContain("mine");
    expect(cycleEntries[0].data?.failCount).toBe(DebugLogger.CYCLE_THRESHOLD);
  });

  it("tracks failure counts per task independently", () => {
    const logger = new DebugLogger();
    logger.setStep(1);

    logger.recordTaskFailure("task-A", "mine", "Urist", "path");
    logger.recordTaskFailure("task-B", "haul", "Dok", "blocked");

    expect(logger.taskFailureCounts.get("task-A")).toBe(1);
    expect(logger.taskFailureCounts.get("task-B")).toBe(1);
  });
});

describe("debugPathfindingFailure", () => {
  it("no-ops when debug is undefined", () => {
    // Should not throw
    debugPathfindingFailure(undefined, "Urist", { x: 0, y: 0, z: 0 }, { x: 5, y: 5, z: 0 }, "mine");
  });

  it("logs a structured entry when debug is set", () => {
    const logger = new DebugLogger();
    logger.setStep(10);
    debugPathfindingFailure(logger, "Urist", { x: 0, y: 0, z: 0 }, { x: 5, y: 5, z: 0 }, "mine");

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0].category).toBe("pathfinding");
    expect(logger.entries[0].data?.dwarfName).toBe("Urist");
    expect(logger.entries[0].data?.distance).toBe(10);
  });
});

describe("debugTaskFailure", () => {
  it("no-ops when debug is undefined", () => {
    debugTaskFailure(undefined, "Urist", "task-1", "mine", "path failed");
  });

  it("logs a task_failure entry and records failure count", () => {
    const logger = new DebugLogger();
    logger.setStep(5);
    debugTaskFailure(logger, "Urist", "task-1", "mine", "path failed");

    const failures = logger.entries.filter(e => e.category === "task_failure");
    expect(failures).toHaveLength(1);
    expect(failures[0].data?.reason).toBe("path failed");
    expect(logger.taskFailureCounts.get("task-1")).toBe(1);
  });
});
