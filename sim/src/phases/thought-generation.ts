import type { SimContext } from "../sim-context.js";
import type { Dwarf } from "@pwarf/shared";

export interface Thought {
  text: string;
  tick: number;
  sentiment: "positive" | "negative" | "neutral";
}

const MAX_THOUGHTS = 10;

// How often to evaluate thoughts (every 10 ticks = 1 second)
const THOUGHT_INTERVAL = 10;

/** Get a trait value, defaulting to 0 if null. */
function trait(dwarf: Dwarf, name: keyof Pick<Dwarf, "trait_openness" | "trait_conscientiousness" | "trait_extraversion" | "trait_agreeableness" | "trait_neuroticism">): number {
  return dwarf[name] ?? 0;
}

/** Threshold adjusted by a personality trait. Positive trait = higher threshold (fires sooner). */
function adjustedThreshold(base: number, traitValue: number): number {
  // trait ranges from -3 to +3. Each point shifts threshold by ~5.
  // Higher threshold means the condition `need < threshold` triggers sooner (at higher need values).
  return base + traitValue * 5;
}

/** Full display name for a dwarf. */
function dwarfName(d: Dwarf): string {
  return d.surname ? `${d.name} ${d.surname}` : d.name;
}

/** Add a thought to a dwarf's memories array, capping at MAX_THOUGHTS. */
function addThought(dwarf: Dwarf, text: string, sentiment: Thought["sentiment"], ctx: SimContext): void {
  const memories = (dwarf.memories ?? []) as Thought[];
  memories.push({ text, tick: ctx.step, sentiment });
  if (memories.length > MAX_THOUGHTS) {
    memories.splice(0, memories.length - MAX_THOUGHTS);
  }
  dwarf.memories = memories;
  ctx.state.dirtyDwarfIds.add(dwarf.id);
}

/** Check if dwarf already has a recent thought with the same text (within last 50 ticks). */
function hasRecentThought(dwarf: Dwarf, text: string, currentTick: number): boolean {
  const memories = (dwarf.memories ?? []) as Thought[];
  return memories.some(m => m.text === text && currentTick - m.tick < 50);
}

/**
 * Thought Generation Phase
 *
 * Scans dwarves for notable states and generates personality-influenced
 * thoughts. Runs every THOUGHT_INTERVAL ticks to avoid spamming.
 *
 * Thoughts are stored in the existing `memories` jsonb column.
 */
export async function thoughtGeneration(ctx: SimContext): Promise<void> {
  if (ctx.step % THOUGHT_INTERVAL !== 0) return;

  const { state } = ctx;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== "alive") continue;

    generateNeedThoughts(dwarf, ctx);
    generateWorkThoughts(dwarf, ctx);
    generateStressThoughts(dwarf, ctx);
    generateHealthThoughts(dwarf, ctx);
  }
}

function generateNeedThoughts(dwarf: Dwarf, ctx: SimContext): void {
  const name = dwarfName(dwarf);

  // Hunger thoughts — neuroticism makes dwarves worry about food sooner
  const hungerThreshold = adjustedThreshold(30, trait(dwarf, "trait_neuroticism"));
  if (dwarf.need_food < hungerThreshold && dwarf.need_food > 0) {
    const text = dwarf.need_food < 15
      ? `${name} is desperate for food.`
      : `${name} is getting hungry.`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "negative", ctx);
    }
  }

  // Thirst thoughts
  const thirstThreshold = adjustedThreshold(30, trait(dwarf, "trait_neuroticism"));
  if (dwarf.need_drink < thirstThreshold && dwarf.need_drink > 0) {
    const text = dwarf.need_drink < 15
      ? `${name} is parched.`
      : `${name} is getting thirsty.`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "negative", ctx);
    }
  }

  // Sleep thoughts
  const sleepThreshold = adjustedThreshold(25, trait(dwarf, "trait_neuroticism"));
  if (dwarf.need_sleep < sleepThreshold && dwarf.need_sleep > 0) {
    const text = dwarf.need_sleep < 10
      ? `${name} can barely keep their eyes open.`
      : `${name} is feeling tired.`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "negative", ctx);
    }
  }

  // Social thoughts — extraversion amplifies loneliness
  const socialThreshold = adjustedThreshold(30, trait(dwarf, "trait_extraversion"));
  if (dwarf.need_social < socialThreshold && dwarf.need_social > 0) {
    const text = trait(dwarf, "trait_extraversion") > 1
      ? `${name} craves company.`
      : `${name} is feeling lonely.`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "negative", ctx);
    }
  }

  // Purpose thoughts — conscientiousness amplifies need for purpose
  const purposeThreshold = adjustedThreshold(25, trait(dwarf, "trait_conscientiousness"));
  if (dwarf.need_purpose < purposeThreshold && dwarf.need_purpose > 0) {
    const text = trait(dwarf, "trait_conscientiousness") > 1
      ? `${name} needs something meaningful to do.`
      : `${name} feels aimless.`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "negative", ctx);
    }
  }

  // Beauty thoughts — openness amplifies need for beauty
  const beautyThreshold = adjustedThreshold(20, trait(dwarf, "trait_openness"));
  if (dwarf.need_beauty < beautyThreshold && dwarf.need_beauty > 0) {
    const text = trait(dwarf, "trait_openness") > 1
      ? `${name} longs for something beautiful.`
      : `${name} finds the surroundings dreary.`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "negative", ctx);
    }
  }

  // Satisfaction thoughts — when needs are well-met
  if (dwarf.need_food > 90) {
    const text = `${name} feels well-fed.`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "positive", ctx);
    }
  }

  if (dwarf.need_sleep > 90) {
    const text = `${name} feels well-rested.`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "positive", ctx);
    }
  }
}

function generateWorkThoughts(dwarf: Dwarf, ctx: SimContext): void {
  const name = dwarfName(dwarf);

  // Idle thoughts — conscientiousness makes idle dwarves more distressed
  if (!dwarf.current_task_id) {
    const threshold = adjustedThreshold(40, trait(dwarf, "trait_conscientiousness"));
    if (dwarf.need_purpose < threshold) {
      const text = trait(dwarf, "trait_conscientiousness") > 1
        ? `${name} hates having nothing to do.`
        : `${name} is bored.`;
      if (!hasRecentThought(dwarf, text, ctx.step)) {
        addThought(dwarf, text, "negative", ctx);
      }
    }
  } else {
    // Working — generate occasional satisfaction
    if (dwarf.need_purpose > 60) {
      const text = `${name} feels productive.`;
      if (!hasRecentThought(dwarf, text, ctx.step)) {
        addThought(dwarf, text, "positive", ctx);
      }
    }
  }
}

function generateStressThoughts(dwarf: Dwarf, ctx: SimContext): void {
  const name = dwarfName(dwarf);

  // Stress thoughts — neuroticism lowers the threshold (fires sooner)
  // For stress, the check is `> threshold`, so we subtract to fire sooner.
  const stressThreshold = 60 - trait(dwarf, "trait_neuroticism") * 5;
  if (dwarf.stress_level > stressThreshold) {
    const text = dwarf.stress_level > 80
      ? `${name} is about to lose it.`
      : `${name} is feeling stressed.`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "negative", ctx);
    }
  }

  // Low stress — contentment
  if (dwarf.stress_level < 10) {
    const text = `${name} is content.`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "positive", ctx);
    }
  }

  // Tantrum
  if (dwarf.is_in_tantrum) {
    const text = `${name} is throwing a tantrum!`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "negative", ctx);
    }
  }
}

function generateHealthThoughts(dwarf: Dwarf, ctx: SimContext): void {
  const name = dwarfName(dwarf);

  if (dwarf.health < 50 && dwarf.health > 0) {
    const text = dwarf.health < 25
      ? `${name} is in terrible pain.`
      : `${name} is wounded.`;
    if (!hasRecentThought(dwarf, text, ctx.step)) {
      addThought(dwarf, text, "negative", ctx);
    }
  }
}
