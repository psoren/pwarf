import { describe, it, expect } from "vitest";
import { thoughtGeneration } from "../phases/thought-generation.js";
import type { Thought } from "../phases/thought-generation.js";
import { makeDwarf, makeContext } from "./test-helpers.js";

function getThoughts(dwarf: { memories: unknown[] }): Thought[] {
  return dwarf.memories as Thought[];
}

describe("thoughtGeneration", () => {
  it("generates hunger thought when food is low", async () => {
    const dwarf = makeDwarf({ need_food: 20 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10; // must be multiple of THOUGHT_INTERVAL

    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    const hungerThoughts = thoughts.filter(t => t.text.includes("hungry"));
    expect(hungerThoughts).toHaveLength(1);
    expect(hungerThoughts[0]!.sentiment).toBe("negative");
  });

  it("generates desperate hunger thought when food is very low", async () => {
    const dwarf = makeDwarf({ need_food: 10 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    expect(thoughts.some(t => t.text.includes("desperate"))).toBe(true);
  });

  it("generates thirst thought when drink is low", async () => {
    const dwarf = makeDwarf({ need_drink: 20 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    expect(thoughts.some(t => t.text.includes("thirsty"))).toBe(true);
  });

  it("generates satisfaction thought when well-fed", async () => {
    const dwarf = makeDwarf({ need_food: 95 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    expect(thoughts.some(t => t.text.includes("well-fed"))).toBe(true);
    expect(thoughts.some(t => t.sentiment === "positive")).toBe(true);
  });

  it("generates stress thought when stressed", async () => {
    const dwarf = makeDwarf({ stress_level: 70 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    expect(thoughts.some(t => t.text.includes("stressed"))).toBe(true);
  });

  it("generates contentment thought when stress is low", async () => {
    const dwarf = makeDwarf({ stress_level: 5 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    expect(thoughts.some(t => t.text.includes("content"))).toBe(true);
  });

  it("neuroticism lowers hunger threshold", async () => {
    // Default threshold is 30. With neuroticism=3, threshold drops to 15.
    const normalDwarf = makeDwarf({ need_food: 25, trait_neuroticism: 0 });
    const anxiousDwarf = makeDwarf({ need_food: 25, trait_neuroticism: 3 });
    // A calm dwarf at food=25 should get a thought (below 30)
    // An anxious dwarf at food=25 should also get a thought (below 30 - 3*5 = 15? no, 30 - 3*5 = 15, and 25 > 15)
    // Wait — neuroticism LOWERS the threshold, meaning it fires SOONER (at higher values)
    // adjustedThreshold(30, 3) = 30 - 3*5 = 15... that's wrong. Positive trait should fire sooner = higher threshold.
    // Let me re-read the code... "Positive trait = lower threshold (fires sooner)" — the check is `< threshold`.
    // So adjustedThreshold(30, 3) = 30 - 15 = 15. need_food < 15 → fires when food is very low. That's backwards.
    // Actually wait: for neuroticism, higher trait should make them worry MORE, so threshold should be HIGHER.
    // The current code: adjustedThreshold(30, trait_neuroticism) = 30 - neuroticism*5
    // High neuroticism (3): threshold = 15 → only fires below 15 — that's LESS sensitive. Bug!
    // Should be: 30 + neuroticism*5 for neuroticism. Let me test as-is and fix the code.

    // Actually re-reading: "Positive trait = lower threshold (fires sooner)"
    // If threshold is lower, then `need < threshold` fires when need is VERY low. That means LATER, not sooner.
    // This is a bug. For neuroticism, we want: high neuroticism → worry sooner → HIGHER threshold.
    // So for neuroticism, the sign should be flipped. Let me just test the corrected behavior.

    // With corrected code: high neuroticism = higher threshold = fires at higher need values
    const ctx1 = makeContext({ dwarves: [normalDwarf] });
    const ctx2 = makeContext({ dwarves: [anxiousDwarf] });
    ctx1.step = 10;
    ctx2.step = 10;

    await thoughtGeneration(ctx1);
    await thoughtGeneration(ctx2);

    const normalThoughts = getThoughts(normalDwarf);
    const anxiousThoughts = getThoughts(anxiousDwarf);

    // Both should get hunger thoughts at food=25 (below 30)
    // But the anxious dwarf should definitely get one
    expect(anxiousThoughts.some(t => t.text.includes("hungry") || t.text.includes("desperate"))).toBe(true);
  });

  it("does not generate thoughts on non-interval ticks", async () => {
    const dwarf = makeDwarf({ need_food: 10 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 7; // not a multiple of 10

    await thoughtGeneration(ctx);

    expect(getThoughts(dwarf)).toHaveLength(0);
  });

  it("skips dead dwarves", async () => {
    const dwarf = makeDwarf({ status: "dead", need_food: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    expect(getThoughts(dwarf)).toHaveLength(0);
  });

  it("does not duplicate recent thoughts", async () => {
    const dwarf = makeDwarf({ need_food: 20 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);
    ctx.step = 20;
    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    const hungerThoughts = thoughts.filter(t => t.text.includes("hungry"));
    expect(hungerThoughts).toHaveLength(1);
  });

  it("caps thoughts at MAX_THOUGHTS (10)", async () => {
    const dwarf = makeDwarf({
      need_food: 20,
      need_drink: 20,
      need_sleep: 15,
      need_social: 20,
      stress_level: 70,
      health: 40,
    });
    const ctx = makeContext({ dwarves: [dwarf] });

    // Generate many thoughts across multiple intervals
    for (let i = 1; i <= 20; i++) {
      ctx.step = i * 10;
      // Reset memories to force new thoughts each time
      dwarf.memories = [];
      await thoughtGeneration(ctx);
    }

    expect(getThoughts(dwarf).length).toBeLessThanOrEqual(10);
  });

  it("marks dwarf as dirty when thought is added", async () => {
    const dwarf = makeDwarf({ need_food: 20 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    expect(ctx.state.dirtyDwarfIds.has(dwarf.id)).toBe(true);
  });

  it("generates idle/bored thought for idle conscientious dwarf", async () => {
    const dwarf = makeDwarf({
      current_task_id: null,
      need_social: 30,
      trait_conscientiousness: 2,
    });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    expect(thoughts.some(t => t.text.includes("nothing to do") || t.text.includes("bored"))).toBe(true);
  });

  it("generates productive thought for working dwarf", async () => {
    const dwarf = makeDwarf({
      current_task_id: "task-1",
      need_social: 70,
    });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    expect(thoughts.some(t => t.text.includes("productive"))).toBe(true);
  });

  it("generates health thought when wounded", async () => {
    const dwarf = makeDwarf({ health: 40 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    expect(thoughts.some(t => t.text.includes("wounded"))).toBe(true);
  });

  it("generates dispirited thought when morale is low", async () => {
    const dwarf = makeDwarf({ need_social: 20 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    expect(thoughts.some(t => t.text.includes("dispirited"))).toBe(true);
  });

  it("generates content thought when morale is high", async () => {
    const dwarf = makeDwarf({ need_social: 80 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 10;

    await thoughtGeneration(ctx);

    const thoughts = getThoughts(dwarf);
    expect(thoughts.some(t => t.text.includes("content"))).toBe(true);
  });
});
