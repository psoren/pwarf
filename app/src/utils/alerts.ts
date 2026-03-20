export interface AlertInfo {
  message: string;
  severity: "critical" | "warning";
}

interface DwarfAlertData {
  name: string;
  is_in_tantrum: boolean;
  need_food: number;
  need_drink: number;
  health: number;
  stress_level: number;
}

const CRITICAL_NEED_THRESHOLD = 15;
const CRITICAL_HEALTH_THRESHOLD = 20;
const HIGH_STRESS_THRESHOLD = 90;

/**
 * Derives the highest-priority alert from the current dwarf list.
 * Returns null if everything is fine.
 */
export function deriveAlert(dwarves: DwarfAlertData[]): AlertInfo | null {
  const aliveDwarves = dwarves.filter(d => d.need_food > 0 || d.need_drink > 0 || d.health > 0);

  // Priority 1: tantrum
  const tantrumDwarves = aliveDwarves.filter(d => d.is_in_tantrum);
  if (tantrumDwarves.length === 1) {
    return { message: `${tantrumDwarves[0].name} in tantrum`, severity: "critical" };
  }
  if (tantrumDwarves.length > 1) {
    return { message: `${tantrumDwarves.length} dwarves in tantrum`, severity: "critical" };
  }

  // Priority 2: starvation / dehydration
  const starvingDwarves = aliveDwarves.filter(d => d.need_food < CRITICAL_NEED_THRESHOLD || d.need_drink < CRITICAL_NEED_THRESHOLD);
  if (starvingDwarves.length === 1) {
    return { message: `${starvingDwarves[0].name} starving`, severity: "critical" };
  }
  if (starvingDwarves.length > 1) {
    return { message: `${starvingDwarves.length} dwarves starving`, severity: "critical" };
  }

  // Priority 3: critical health
  const criticalHealth = aliveDwarves.filter(d => d.health < CRITICAL_HEALTH_THRESHOLD);
  if (criticalHealth.length === 1) {
    return { message: `${criticalHealth[0].name} critically wounded`, severity: "critical" };
  }
  if (criticalHealth.length > 1) {
    return { message: `${criticalHealth.length} dwarves critically wounded`, severity: "critical" };
  }

  // Priority 4: high stress
  const stressedDwarves = aliveDwarves.filter(d => d.stress_level >= HIGH_STRESS_THRESHOLD);
  if (stressedDwarves.length === 1) {
    return { message: `${stressedDwarves[0].name} at breaking point`, severity: "warning" };
  }
  if (stressedDwarves.length > 1) {
    return { message: `${stressedDwarves.length} dwarves near breaking point`, severity: "warning" };
  }

  return null;
}
