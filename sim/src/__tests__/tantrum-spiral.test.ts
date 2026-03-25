import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf } from "./test-helpers.js";
import { STRESS_TANTRUM_THRESHOLD } from "@pwarf/shared";

describe("tantrum spiral scenario (issue #477)", () => {
  it("high stress and no food/drink leads to tantrums and fortress fall", async () => {
    // 3 dwarves with near-zero needs, high stress, no food/drink available.
    // Stress will cross the tantrum threshold quickly. With no food/drink,
    // dwarves eventually die. All dwarves die -> fortress falls.
    const dwarves = [
      makeDwarf({
        position_x: 5, position_y: 5, position_z: 0,
        need_food: 3, need_drink: 3, need_sleep: 10,
        need_social: 0, need_purpose: 0, need_beauty: 0,
        stress_level: 75,
      }),
      makeDwarf({
        position_x: 6, position_y: 5, position_z: 0,
        need_food: 3, need_drink: 3, need_sleep: 10,
        need_social: 0, need_purpose: 0, need_beauty: 0,
        stress_level: 75,
      }),
      makeDwarf({
        position_x: 7, position_y: 5, position_z: 0,
        need_food: 3, need_drink: 3, need_sleep: 10,
        need_social: 0, need_purpose: 0, need_beauty: 0,
        stress_level: 75,
      }),
    ];

    // No food, no drink, no items -- dwarves will starve/dehydrate or be killed
    // by monsters. DEHYDRATION_TICKS=9000, need_drink=3 decays at 0.0033/tick
    // -> 0 at ~tick 909, then 9000 more ticks to die = ~10000 total.
    // Monsters may also kill dwarves after MONSTER_PEACE_PERIOD_TICKS (5400).
    const result = await runScenario({
      dwarves,
      items: [],
      ticks: 12_000,
    });

    // All dwarves should be dead (starvation/dehydration/monster attack)
    const deadDwarves = result.dwarves.filter(d => d.status === "dead");
    expect(deadDwarves.length).toBe(3);

    // All deaths should have a cause
    for (const d of deadDwarves) {
      expect(d.cause_of_death).not.toBeNull();
    }

    // Fortress should have fallen (all dwarves dead -> fortress_fallen event)
    const fortressFallenEvent = result.events.find(e => e.category === "fortress_fallen");
    expect(fortressFallenEvent).toBeDefined();
  });

  it("stress compounds from witnessing deaths", async () => {
    // Place 3 dwarves close together so they witness each other's deaths.
    // Start with moderate stress -- the first death should push survivors
    // over the tantrum threshold via WITNESS_DEATH_STRESS.
    const dwarves = [
      makeDwarf({
        position_x: 5, position_y: 5, position_z: 0,
        need_food: 1, need_drink: 1, need_sleep: 50,
        need_social: 0, need_purpose: 0, need_beauty: 0,
        stress_level: 60,
      }),
      makeDwarf({
        position_x: 6, position_y: 5, position_z: 0,
        need_food: 50, need_drink: 50, need_sleep: 50,
        need_social: 0, need_purpose: 0, need_beauty: 0,
        stress_level: 60,
      }),
      makeDwarf({
        position_x: 7, position_y: 5, position_z: 0,
        need_food: 50, need_drink: 50, need_sleep: 50,
        need_social: 0, need_purpose: 0, need_beauty: 0,
        stress_level: 60,
      }),
    ];

    // First dwarf: need_drink=1, decays at ~0.0033/tick -> 0 at ~tick 303
    // Then DEHYDRATION_TICKS=9000 to die -> ~9300 ticks total.
    // Monsters may kill the first dwarf sooner (after tick 5400).
    const result = await runScenario({
      dwarves,
      items: [],
      ticks: 12_000,
    });

    // First dwarf (low food/drink) should die first
    const firstDwarf = result.dwarves[0];
    expect(firstDwarf.status).toBe("dead");

    // Surviving dwarves should have stress above the tantrum threshold
    // (60 base + WITNESS_DEATH_STRESS from seeing death nearby)
    const survivors = result.dwarves.filter(d => d.status === "alive");
    for (const s of survivors) {
      expect(s.stress_level).toBeGreaterThanOrEqual(STRESS_TANTRUM_THRESHOLD);
    }
  }, 30_000);

  it("dwarves in tantrum cannot work (current_task_id cleared)", async () => {
    // Single dwarf at tantrum threshold -- should immediately enter tantrum
    // and have their task cancelled
    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      need_food: 50, need_drink: 50, need_sleep: 50,
      need_social: 0, need_purpose: 0, need_beauty: 0,
      stress_level: STRESS_TANTRUM_THRESHOLD + 1,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [],
      ticks: 10,
    });

    // Dwarf should be in tantrum (or was -- stress might have been above threshold)
    const finalDwarf = result.dwarves[0];
    // With stress > 80 and all needs dropping, tantrum should have triggered.
    // Tantrum clears current_task_id.
    expect(finalDwarf.is_in_tantrum).toBe(true);
    expect(finalDwarf.current_task_id).toBeNull();
  });
});
