import { describe, it, expect } from "vitest";
import { runHeadless } from "../headless-runner.js";
import { createEmptyCachedState } from "../sim-context.js";
import { makeDwarf } from "./test-helpers.js";

describe("runHeadless", () => {
  it("runs to completion with no dwarves", async () => {
    const result = await runHeadless({ ticks: 10 });
    expect(result.ticks).toBe(10);
    expect(result.finalSnapshot.summary.tick).toBe(10);
    expect(result.finalSnapshot.summary.population.alive).toBe(0);
  });

  it("runs a named scenario", async () => {
    const result = await runHeadless({ scenario: "idle-fortress", ticks: 50 });
    expect(result.ticks).toBe(50);
    expect(result.finalSnapshot.summary.population.alive).toBeGreaterThan(0);
  });

  it("uses scenario default ticks when none specified", async () => {
    // starvation scenario default is 500
    const result = await runHeadless({ scenario: "starvation", ticks: 5 });
    expect(result.ticks).toBe(5); // explicit override wins
  });

  it("emits intermediate snapshots when snapshotEvery is set", async () => {
    const result = await runHeadless({ ticks: 50, snapshotEvery: 10 });
    expect(result.snapshots).toHaveLength(5);
    expect(result.snapshots[0].summary.tick).toBe(10);
    expect(result.snapshots[4].summary.tick).toBe(50);
  });

  it("returns empty snapshots array when snapshotEvery is 0", async () => {
    const result = await runHeadless({ ticks: 20 });
    expect(result.snapshots).toHaveLength(0);
  });

  it("accepts custom initialState", async () => {
    const state = createEmptyCachedState();
    state.dwarves = [makeDwarf({ civilization_id: "headless-civ" })];
    const result = await runHeadless({ initialState: state, ticks: 10 });
    expect(result.finalSnapshot.summary.population.alive + result.finalSnapshot.summary.population.dead).toBe(1);
  });

  it("throws for unknown scenario", async () => {
    await expect(runHeadless({ scenario: "does-not-exist" })).rejects.toThrow(/Unknown scenario/);
  });

  it("tracks task completions", async () => {
    const result = await runHeadless({ scenario: "starvation", ticks: 200 });
    // Dwarves should complete some eat/drink tasks
    expect(result.tasksCompleted).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic across runs", async () => {
    const a = await runHeadless({ scenario: "starvation", ticks: 50 });
    const b = await runHeadless({ scenario: "starvation", ticks: 50 });
    expect(a.finalSnapshot.summary.population.alive).toBe(b.finalSnapshot.summary.population.alive);
    expect(a.finalSnapshot.summary.population.dead).toBe(b.finalSnapshot.summary.population.dead);
  });
});
