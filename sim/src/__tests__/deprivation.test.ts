import { describe, it, expect } from "vitest";
import { STARVATION_TICKS, DEHYDRATION_TICKS, WITNESS_DEATH_STRESS, WITNESS_DEATH_RADIUS } from "@pwarf/shared";
import { handleDeprivationDeaths, killDwarf, applyWitnessStress } from "../phases/deprivation.js";
import { createTask } from "../task-helpers.js";
import { makeDwarf, makeContext } from "./test-helpers.js";

describe("handleDeprivationDeaths", () => {
  it("increments zero-food tick counter when food is 0", () => {
    const dwarf = makeDwarf({ need_food: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    handleDeprivationDeaths(ctx);

    expect(ctx.state.zeroFoodTicks.get(dwarf.id)).toBe(1);
  });

  it("resets zero-food counter when food is above 0", () => {
    const dwarf = makeDwarf({ need_food: 10 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.zeroFoodTicks.set(dwarf.id, 100);

    handleDeprivationDeaths(ctx);

    expect(ctx.state.zeroFoodTicks.has(dwarf.id)).toBe(false);
  });

  it("kills dwarf after STARVATION_TICKS at zero food", () => {
    const dwarf = makeDwarf({ need_food: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.zeroFoodTicks.set(dwarf.id, STARVATION_TICKS - 1);

    handleDeprivationDeaths(ctx);

    expect(dwarf.status).toBe("dead");
    expect(dwarf.cause_of_death).toBe("starvation");
  });

  it("kills dwarf after DEHYDRATION_TICKS at zero drink", () => {
    const dwarf = makeDwarf({ need_drink: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.zeroDrinkTicks.set(dwarf.id, DEHYDRATION_TICKS - 1);

    handleDeprivationDeaths(ctx);

    expect(dwarf.status).toBe("dead");
    expect(dwarf.cause_of_death).toBe("dehydration");
  });

  it("does not affect dead dwarves", () => {
    const dwarf = makeDwarf({ status: "dead", need_food: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    handleDeprivationDeaths(ctx);

    expect(ctx.state.zeroFoodTicks.has(dwarf.id)).toBe(false);
  });
});

describe("killDwarf", () => {
  it("sets dwarf to dead with cause", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, "starvation", ctx);

    expect(dwarf.status).toBe("dead");
    expect(dwarf.cause_of_death).toBe("starvation");
    expect(dwarf.died_year).toBe(1);
    expect(ctx.state.dirtyDwarfIds.has(dwarf.id)).toBe(true);
  });

  it("fails the dwarf's current task", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });
    const task = createTask(ctx, {
      task_type: "haul",
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    killDwarf(dwarf, "starvation", ctx);

    expect(task.status).toBe("failed");
    expect(task.assigned_dwarf_id).toBeNull();
    expect(dwarf.current_task_id).toBeNull();
  });

  it("clears tantrum state on death", () => {
    const dwarf = makeDwarf({ is_in_tantrum: true });
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, "starvation", ctx);

    expect(dwarf.is_in_tantrum).toBe(false);
  });

  it("fires fortress_fallen event when last dwarf dies", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, "starvation", ctx);

    const fallen = ctx.state.pendingEvents.filter(e => e.category === "fortress_fallen");
    expect(fallen).toHaveLength(1);
    expect(fallen[0]!.description).toContain("fortress has fallen");
  });

  it("does not fire fortress_fallen when other dwarves survive", () => {
    const dwarf1 = makeDwarf();
    const dwarf2 = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf1, dwarf2] });

    killDwarf(dwarf1, "starvation", ctx);

    const fallen = ctx.state.pendingEvents.filter(e => e.category === "fortress_fallen");
    expect(fallen).toHaveLength(0);
  });
});

describe("applyWitnessStress", () => {
  it("applies stress to alive dwarves within witness radius", () => {
    const deceased = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const witness = makeDwarf({ stress_level: 10, position_x: 2, position_y: 2, position_z: 0 });
    const ctx = makeContext({ dwarves: [deceased, witness] });

    applyWitnessStress(deceased, ctx.state);

    // Manhattan distance = 4 <= WITNESS_DEATH_RADIUS (5)
    expect(witness.stress_level).toBe(10 + WITNESS_DEATH_STRESS);
    expect(ctx.state.dirtyDwarfIds.has(witness.id)).toBe(true);
  });

  it("does not apply stress to dwarves beyond witness radius", () => {
    const deceased = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const farDwarf = makeDwarf({ stress_level: 10, position_x: 10, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [deceased, farDwarf] });

    applyWitnessStress(deceased, ctx.state);

    // Manhattan distance = 10 > WITNESS_DEATH_RADIUS (5)
    expect(farDwarf.stress_level).toBe(10);
    expect(ctx.state.dirtyDwarfIds.size).toBe(0);
  });

  it("does not apply stress across z-levels", () => {
    const deceased = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const aboveDwarf = makeDwarf({ stress_level: 10, position_x: 0, position_y: 0, position_z: 1 });
    const ctx = makeContext({ dwarves: [deceased, aboveDwarf] });

    applyWitnessStress(deceased, ctx.state);

    expect(aboveDwarf.stress_level).toBe(10);
  });

  it("does not apply stress to dead dwarves", () => {
    const deceased = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const deadNearby = makeDwarf({ status: 'dead', stress_level: 0, position_x: 1, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [deceased, deadNearby] });

    applyWitnessStress(deceased, ctx.state);

    expect(deadNearby.stress_level).toBe(0);
  });

  it("does not apply stress to the deceased itself", () => {
    const deceased = makeDwarf({ stress_level: 50, position_x: 0, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [deceased] });

    applyWitnessStress(deceased, ctx.state);

    expect(deceased.stress_level).toBe(50);
  });

  it("caps witness stress at 100", () => {
    const deceased = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const witness = makeDwarf({ stress_level: 98, position_x: 1, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [deceased, witness] });

    applyWitnessStress(deceased, ctx.state);

    expect(witness.stress_level).toBe(100);
  });

  it("applies stress to all witnesses within radius, not just the nearest", () => {
    const deceased = makeDwarf({ position_x: 5, position_y: 0, position_z: 0 });
    const witness1 = makeDwarf({ stress_level: 0, position_x: 3, position_y: 0, position_z: 0 });
    const witness2 = makeDwarf({ stress_level: 0, position_x: 7, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [deceased, witness1, witness2] });

    applyWitnessStress(deceased, ctx.state);

    expect(witness1.stress_level).toBe(WITNESS_DEATH_STRESS);
    expect(witness2.stress_level).toBe(WITNESS_DEATH_STRESS);
  });

  it("killDwarf triggers witness stress on nearby dwarves", () => {
    const victim = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const bystander = makeDwarf({ stress_level: 10, position_x: 1, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [victim, bystander] });

    killDwarf(victim, 'starvation', ctx);

    expect(bystander.stress_level).toBe(10 + WITNESS_DEATH_STRESS);
  });
});

describe("fortress collapse (civFallen)", () => {
  it("sets civFallen when the last dwarf dies", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, 'starvation', ctx);

    expect(ctx.state.civFallen).toBe(true);
  });

  it("sets civFallenCause to starvation for starvation/dehydration deaths", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, 'dehydration', ctx);

    expect(ctx.state.civFallenCause).toBe('starvation');
  });

  it("sets civFallenCause to siege for monster attack deaths", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, 'monster attack', ctx);

    expect(ctx.state.civFallenCause).toBe('siege');
  });

  it("maps tantrum_spiral cause correctly", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, 'tantrum_spiral', ctx);

    expect(ctx.state.civFallenCause).toBe('tantrum_spiral');
  });

  it("maps plague cause correctly", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, 'plague', ctx);

    expect(ctx.state.civFallenCause).toBe('plague');
  });

  it("maps unknown causes to unknown", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, 'old age', ctx);

    expect(ctx.state.civFallenCause).toBe('unknown');
  });

  it("does not set civFallen when there are still alive dwarves", () => {
    const victim = makeDwarf();
    const survivor = makeDwarf();
    const ctx = makeContext({ dwarves: [victim, survivor] });

    killDwarf(victim, 'starvation', ctx);

    expect(ctx.state.civFallen).toBe(false);
  });

  it("fires a fortress_fallen event when the last dwarf dies", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, 'starvation', ctx);

    const event = ctx.state.pendingEvents.find(e => e.category === 'fortress_fallen');
    expect(event).toBeDefined();
    expect(event?.description).toContain('fallen');
  });

  it("does not fire a duplicate fortress_fallen event if civFallen is already true", () => {
    const dwarf1 = makeDwarf();
    const dwarf2 = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf1, dwarf2] });

    killDwarf(dwarf1, 'starvation', ctx);
    killDwarf(dwarf2, 'starvation', ctx);

    const events = ctx.state.pendingEvents.filter(e => e.category === 'fortress_fallen');
    expect(events.length).toBe(1);
  });
});
