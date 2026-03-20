import type { StateSnapshot } from "./state-serializer.js";

/**
 * Builds a prompt for an LLM (e.g. Claude Haiku) to analyze a batch run
 * and produce a structured playtest report.
 *
 * Usage:
 *   const prompt = buildPlaytestPrompt(snapshot, { scenario: "starvation", ticks: 500 });
 *   // Send to Claude API with the prompt as the user message
 */
export function buildPlaytestPrompt(
  snapshot: StateSnapshot,
  meta: { scenario?: string; ticks: number }
): string {
  const scenarioLine = meta.scenario
    ? `Scenario: **${meta.scenario}** (${meta.ticks} ticks)`
    : `Custom run (${meta.ticks} ticks)`;

  return `You are a game QA analyst for a dwarf fortress simulation game called Pwarf. You have been given a JSON state snapshot from an automated headless run. Analyze it and write a concise playtest report.

${scenarioLine}

## State snapshot

\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`

## Your report should cover

1. **Population health** — did dwarves survive? Were there deaths? Were needs met?
2. **Balance issues** — any needs critically low? Any dwarves stuck in tantrum or idle?
3. **Emergent behavior** — anything surprising or worth noting?
4. **Bugs or impossible states** — e.g. dwarves with needs at extreme values with no explanation, tasks never completing, etc.
5. **Verdict** — pass / warn / fail, and a one-sentence summary of why.

Keep the report under 300 words. Be specific — cite dwarf names, need values, and event descriptions when relevant.`;
}
