import { describe, it, expect } from "vitest";
import { makeDwarf, makeContext, makeStructure } from "./test-helpers.js";
import { yearlyRollup } from "../phases/yearly-rollup.js";
import { STEPS_PER_YEAR } from "@pwarf/shared";

describe("disease outbreak scenario (issue #471)", () => {
  it("disease spreads to nearby dwarves and kills those with low health", () => {
    // Patient zero is pre-infected. 5 nearby dwarves (within DISEASE_SPREAD_RADIUS=4).
    // Two have low health so they die when disease damage hits.
    const patientZero = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      health: 10,
    });

    const weakDwarf = makeDwarf({
      position_x: 6, position_y: 5, position_z: 0,
      health: 10,
    });

    const healthyDwarves = Array.from({ length: 3 }, (_, i) =>
      makeDwarf({
        position_x: 5 + i, position_y: 6, position_z: 0,
        health: 100,
      }),
    );

    const allDwarves = [patientZero, weakDwarf, ...healthyDwarves];
    const ctx = makeContext({ dwarves: allDwarves });
    ctx.state.infectedDwarfIds.add(patientZero.id);

    // Run multiple yearly rollups so disease spreads and damages
    for (let year = 2; year <= 5; year++) {
      ctx.year = year;
      ctx.step = year * STEPS_PER_YEAR;
      yearlyRollup(ctx);
    }

    // Patient zero should be dead (10 hp - 15 damage = dead)
    expect(patientZero.status).toBe("dead");
    expect(patientZero.cause_of_death).toBe("disease");

    // Disease should have spread to at least one other dwarf
    const spreadEvents = ctx.state.pendingEvents.filter(
      e => (e.event_data as Record<string, unknown>)?.type === "disease_spread",
    );
    expect(spreadEvents.length).toBeGreaterThanOrEqual(1);

    // At least one death event from disease
    const deathEvents = ctx.state.pendingEvents.filter(
      e => (e.event_data as Record<string, unknown>)?.type === "disease_death",
    );
    expect(deathEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("disease kills multiple dwarves over several years", () => {
    // 6 dwarves clustered together, all pre-infected with low health.
    // Over multiple years of 15 damage/year, those who don't recover will die.
    const dwarves = Array.from({ length: 6 }, (_, i) =>
      makeDwarf({
        position_x: 3 + (i % 3), position_y: 3 + Math.floor(i / 3), position_z: 0,
        health: 25, // 2 years of 15 damage = 30, enough to kill
      }),
    );

    const ctx = makeContext({ dwarves });
    for (const d of dwarves) {
      ctx.state.infectedDwarfIds.add(d.id);
    }

    // Run 4 yearly rollups
    for (let year = 2; year <= 5; year++) {
      ctx.year = year;
      ctx.step = year * STEPS_PER_YEAR;
      yearlyRollup(ctx);
    }

    const deadFromDisease = dwarves.filter(
      d => d.status === "dead" && d.cause_of_death === "disease",
    );
    // With 25 hp and 15 dmg/year, dwarves who don't recover die in 2 years.
    // 50% recovery chance per year, so some should die.
    expect(deadFromDisease.length).toBeGreaterThanOrEqual(1);

    // Verify death events match
    const deathEvents = ctx.state.pendingEvents.filter(
      e => (e.event_data as Record<string, unknown>)?.type === "disease_death",
    );
    expect(deathEvents.length).toBe(deadFromDisease.length);
  });

  it("well reduces disease spread", () => {
    // Run two batches with identical setup — one with well, one without.
    // The well batch should have fewer spread events on average.
    const makeDwarfCluster = () => {
      const infected = makeDwarf({
        position_x: 5, position_y: 5, position_z: 0,
        health: 100,
      });
      const neighbors = Array.from({ length: 8 }, (_, i) =>
        makeDwarf({
          position_x: 4 + (i % 3), position_y: 4 + Math.floor(i / 3), position_z: 0,
          health: 100,
        }),
      );
      return { infected, all: [infected, ...neighbors] };
    };

    let spreadsWithoutWell = 0;
    for (let seed = 0; seed < 20; seed++) {
      const { infected, all } = makeDwarfCluster();
      const ctx = makeContext({ dwarves: all }, seed);
      ctx.state.infectedDwarfIds.add(infected.id);
      ctx.year = 2;
      ctx.step = 2 * STEPS_PER_YEAR;
      yearlyRollup(ctx);
      spreadsWithoutWell += ctx.state.pendingEvents.filter(
        e => (e.event_data as Record<string, unknown>)?.type === "disease_spread",
      ).length;
    }

    let spreadsWithWell = 0;
    for (let seed = 0; seed < 20; seed++) {
      const { infected, all } = makeDwarfCluster();
      const well = makeStructure({ type: "well", completion_pct: 100 });
      const ctx = makeContext({ dwarves: all, structures: [well] }, seed);
      ctx.state.infectedDwarfIds.add(infected.id);
      ctx.year = 2;
      ctx.step = 2 * STEPS_PER_YEAR;
      yearlyRollup(ctx);
      spreadsWithWell += ctx.state.pendingEvents.filter(
        e => (e.event_data as Record<string, unknown>)?.type === "disease_spread",
      ).length;
    }

    // Well halves spread chance (40% → 20%), so total should be lower
    expect(spreadsWithWell).toBeLessThan(spreadsWithoutWell);
  });

  it("witness stress applied when dwarf dies of disease", () => {
    // Sick dwarf with 10 hp (guaranteed death). A healthy dwarf nearby
    // should gain witness stress from the death.
    const sickDwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      health: 10,
    });

    const witness = makeDwarf({
      position_x: 6, position_y: 5, position_z: 0,
      stress_level: 0,
      health: 100,
    });

    const ctx = makeContext({ dwarves: [sickDwarf, witness] });
    ctx.state.infectedDwarfIds.add(sickDwarf.id);
    ctx.year = 2;
    ctx.step = 2 * STEPS_PER_YEAR;
    yearlyRollup(ctx);

    // Sick dwarf should be dead
    expect(sickDwarf.status).toBe("dead");
    expect(sickDwarf.cause_of_death).toBe("disease");

    // Witness should have gained stress from witnessing the death
    expect(witness.stress_level).toBeGreaterThan(0);
  });

});
