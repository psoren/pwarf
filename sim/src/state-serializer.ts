import { AUTONOMOUS_TASK_TYPES } from "@pwarf/shared";
import type { Dwarf, WorldEvent } from "@pwarf/shared";
import { getTaskById, type SimContext } from "./sim-context.js";

export interface NeedLabel {
  label: string;
  value: number;
}

export interface DwarfSnapshot {
  name: string;
  status: string;
  needs: {
    food: string;
    drink: string;
    sleep: string;
    morale: string;
  };
  stress: string;
  activity: string;
  is_in_tantrum: boolean;
}

export interface DeathRecord {
  name: string;
  cause: string;
  year: number;
}

export interface Summary {
  tick: number;
  year: number;
  day: number;
  population: { alive: number; dead: number };
  alerts: string[];
  deaths: DeathRecord[];
  tasks_completed: number;
  events_count: number;
}

export interface TaskSnapshot {
  id: string;
  type: string;
  status: string;
  target: { x: number | null; y: number | null; z: number | null };
  progress: string;
}

export interface TileSnapshot {
  x: number;
  y: number;
  z: number;
  tile_type: string;
}

export interface StateSnapshot {
  summary: Summary;
  dwarves: DwarfSnapshot[];
  tasks: TaskSnapshot[];
  tiles: TileSnapshot[];
  recent_events: Array<{ tick: number; text: string }>;
}

function needLabel(value: number, name: string): string {
  const v = Math.round(value);
  if (v <= 10) return `critical (${v})`;
  if (v <= 25) return `very low (${v})`;
  if (v <= 50) return `low (${v})`;
  if (v <= 75) return `ok (${v})`;
  return `good (${v})`;
}

function stressLabel(stress: number): string {
  const v = Math.round(stress);
  if (v >= 80) return `severe (${v})`;
  if (v >= 60) return `high (${v})`;
  if (v >= 40) return `moderate (${v})`;
  if (v >= 20) return `mild (${v})`;
  return `calm (${v})`;
}

function dwarfActivity(dwarf: Dwarf, ctx: SimContext): string {
  if (dwarf.is_in_tantrum) return "tantrum";
  if (dwarf.current_task_id) {
    const task = getTaskById(ctx.state, dwarf.current_task_id);
    if (task) {
      const loc = task.target_x != null
        ? ` at (${task.target_x}, ${task.target_y}, ${task.target_z})`
        : "";
      return `${task.task_type}${loc}`;
    }
    return "working";
  }
  return `idle at (${dwarf.position_x}, ${dwarf.position_y}, ${dwarf.position_z})`;
}

function buildAlerts(dwarves: Dwarf[]): string[] {
  const alerts: string[] = [];

  const criticalHunger = dwarves.filter(d => d.status === "alive" && Math.round(d.need_food) <= 10);
  if (criticalHunger.length > 0) {
    alerts.push(`${criticalHunger.length} dwarf${criticalHunger.length > 1 ? "s" : ""} critically hungry`);
  }

  const criticalThirst = dwarves.filter(d => d.status === "alive" && Math.round(d.need_drink) <= 10);
  if (criticalThirst.length > 0) {
    alerts.push(`${criticalThirst.length} dwarf${criticalThirst.length > 1 ? "s" : ""} critically thirsty`);
  }

  const tantrums = dwarves.filter(d => d.status === "alive" && d.is_in_tantrum);
  if (tantrums.length > 0) {
    alerts.push(`${tantrums.length} dwarf${tantrums.length > 1 ? "s" : ""} in tantrum`);
  }

  const highStress = dwarves.filter(d => d.status === "alive" && d.stress_level >= 70);
  if (highStress.length > 0) {
    alerts.push(`${highStress.length} dwarf${highStress.length > 1 ? "s" : ""} at high stress`);
  }

  return alerts;
}

/** Serialize sim context into an LLM-friendly JSON snapshot. */
export function serializeState(ctx: SimContext, tasksCompleted = 0): StateSnapshot {
  const { state, step, year, day } = ctx;

  const alive = state.dwarves.filter(d => d.status === "alive");
  const dead = state.dwarves.filter(d => d.status === "dead");

  const deaths: DeathRecord[] = dead.map(d => ({
    name: `${d.name} ${d.surname}`,
    cause: d.cause_of_death ?? "unknown",
    year: d.died_year ?? year,
  }));

  const recentEvents = state.worldEvents
    .slice(-20)
    .map(e => ({ tick: e.year, text: e.description }));

  const dwarfSnapshots: DwarfSnapshot[] = state.dwarves.map(d => ({
    name: `${d.name} ${d.surname}`,
    status: d.status,
    needs: {
      food: needLabel(d.need_food, "food"),
      drink: needLabel(d.need_drink, "drink"),
      sleep: needLabel(d.need_sleep, "sleep"),
      morale: needLabel(d.need_social, "morale"),
    },
    stress: stressLabel(d.stress_level),
    activity: d.status === "dead" ? "dead" : dwarfActivity(d, ctx),
    is_in_tantrum: d.is_in_tantrum,
  }));

  const taskSnapshots: TaskSnapshot[] = state.tasks
    .filter(t => !AUTONOMOUS_TASK_TYPES.has(t.task_type) && t.status !== 'completed' && t.status !== 'cancelled')
    .map(t => ({
      id: t.id,
      type: t.task_type,
      status: t.status,
      target: { x: t.target_x, y: t.target_y, z: t.target_z },
      progress: t.work_required > 0
        ? `${Math.round((t.work_progress / t.work_required) * 100)}%`
        : "n/a",
    }));

  const tileSnapshots: TileSnapshot[] = [...state.fortressTileOverrides.values()].map(t => ({
    x: t.x,
    y: t.y,
    z: t.z,
    tile_type: t.tile_type,
  }));

  return {
    summary: {
      tick: step,
      year,
      day,
      population: { alive: alive.length, dead: dead.length },
      alerts: buildAlerts(state.dwarves),
      deaths,
      tasks_completed: tasksCompleted,
      events_count: state.worldEvents.length,
    },
    dwarves: dwarfSnapshots,
    tasks: taskSnapshots,
    tiles: tileSnapshots,
    recent_events: recentEvents,
  };
}
