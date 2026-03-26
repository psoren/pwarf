import { useState, useEffect } from "react";
import type { DwarfSkill, Item } from "@pwarf/shared";
import { DWARF_CARRY_CAPACITY, AUTONOMOUS_TASK_TYPES, IDLE_TASK_TYPES } from "@pwarf/shared";
import { supabase } from "../lib/supabase";
import type { LiveDwarf, DwarfThought } from "../hooks/useDwarves";
import type { ActiveTask } from "../hooks/useTasks";
import { skillStars } from "../utils/skillStars";
import { EntityModal } from "./EntityModal";
import { needBar } from "./needBar";

interface DwarfModalProps {
  dwarf: LiveDwarf;
  onClose: () => void;
  onGoTo: (dwarf: LiveDwarf) => void;
  items?: Item[];
  tasks?: ActiveTask[];
}

/** Task types that should not show a work percentage in the dwarf job label. */
const NO_PROGRESS_TASK_TYPES: ReadonlySet<string> = new Set([
  ...AUTONOMOUS_TASK_TYPES,
  ...IDLE_TASK_TYPES,
]);

function dwarfJobLabel(d: LiveDwarf, tasks?: ActiveTask[]): string {
  if (!d.current_task_id) return "Idle";
  const task = tasks?.find(t => t.id === d.current_task_id);
  if (!task) return "Working";
  const label = task.task_type.replace(/_/g, " ");
  if (NO_PROGRESS_TASK_TYPES.has(task.task_type) || task.work_required === 0) {
    return label;
  }
  const pct = Math.round((task.work_progress / task.work_required) * 100);
  return `${label} (${pct}%)`;
}

export function DwarfModal({ dwarf, onClose, onGoTo, items = [], tasks }: DwarfModalProps) {
  const [skills, setSkills] = useState<DwarfSkill[]>([]);

  useEffect(() => {
    supabase
      .from("dwarf_skills")
      .select("*")
      .eq("dwarf_id", dwarf.id)
      .gt("level", 0)
      .order("level", { ascending: false })
      .then(({ data }) => {
        if (data) setSkills(data as DwarfSkill[]);
      });
  }, [dwarf.id]);

  const carried = items.filter(i => i.held_by_dwarf_id === dwarf.id);
  const totalWeight = carried.reduce((sum, i) => sum + (i.weight ?? 0), 0);

  const title = dwarf.name + (dwarf.surname ? ` ${dwarf.surname}` : "");

  return (
    <EntityModal title={title} onClose={onClose}>
        <div className="text-[var(--text)] mb-1 flex gap-3">
          <span>Status: <span className="text-[var(--green)]">{dwarfJobLabel(dwarf, tasks)}</span></span>
          {dwarf.age != null && (
            <span>Age: <span className="text-[var(--green)]">{dwarf.age}</span></span>
          )}
          {dwarf.gender && (
            <span className="capitalize text-[var(--text)]">{dwarf.gender}</span>
          )}
          {dwarf.is_in_tantrum && (
            <span className="text-[#f87171] font-bold">TANTRUM</span>
          )}
        </div>

        <div className="text-[var(--text)] flex items-center justify-between mb-2">
          <span>
            Pos: <span className="text-[var(--green)]">({dwarf.position_x}, {dwarf.position_y}) Level {dwarf.position_z}</span>
          </span>
          <button
            onClick={() => onGoTo(dwarf)}
            className="text-[var(--amber)] hover:text-[var(--green)] cursor-pointer"
          >
            Go to
          </button>
        </div>

        <div className="border-t border-[var(--border)] pt-2 mt-2 space-y-1">
          <div className="text-[var(--amber)] font-bold mb-0.5">Needs</div>
          {needBar("Food", dwarf.need_food, "var(--green)")}
          {needBar("Drink", dwarf.need_drink, "#4488ff")}
          {needBar("Sleep", dwarf.need_sleep, "#aa88ff")}
          {needBar("Morale", dwarf.need_social, "#44ccaa")}
        </div>

        <div className="border-t border-[var(--border)] pt-2 mt-2">
          <div className="text-[var(--amber)] font-bold mb-0.5">Stress</div>
          {needBar("Stress", dwarf.stress_level, "#ff6600")}
        </div>

        <div className="border-t border-[var(--border)] pt-2 mt-2">
          <div className="text-[var(--amber)] font-bold mb-0.5">Health</div>
          {needBar("HP", dwarf.health, "var(--green)")}
        </div>

        {skills.length > 0 && (
          <div className="border-t border-[var(--border)] pt-2 mt-2">
            <div className="text-[var(--amber)] font-bold mb-0.5">Skills</div>
            <ul className="space-y-0.5">
              {skills.slice(0, 5).map((s) => (
                <li key={s.id} className="flex justify-between">
                  <span className="text-[var(--text)] capitalize">{s.skill_name.replace(/_/g, ' ')}</span>
                  <span className="text-[var(--amber)] tracking-wider">{skillStars(s.level)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {carried.length > 0 && (
          <div className="border-t border-[var(--border)] pt-2 mt-2">
            <div className="text-[var(--amber)] font-bold mb-0.5">Inventory</div>
            {needBar("Carry", (totalWeight / DWARF_CARRY_CAPACITY) * 100, "#cc9933")}
            <div className="text-[var(--text)] text-[10px] mb-1">{totalWeight} / {DWARF_CARRY_CAPACITY} weight</div>
            <ul className="space-y-0.5">
              {carried.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span className="text-[var(--green)]">{item.name}</span>
                  <span className="text-[var(--text)]">{item.weight ?? 0}w</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(dwarf.trait_openness !== null || dwarf.trait_conscientiousness !== null || dwarf.trait_extraversion !== null || dwarf.trait_agreeableness !== null || dwarf.trait_neuroticism !== null) && (
          <div className="border-t border-[var(--border)] pt-2 mt-2">
            <div className="text-[var(--amber)] font-bold mb-0.5">Personality</div>
            <div className="space-y-1">
              {dwarf.trait_openness !== null && needBar("Open", dwarf.trait_openness * 100, "var(--cyan)")}
              {dwarf.trait_conscientiousness !== null && needBar("Consc.", dwarf.trait_conscientiousness * 100, "var(--green)")}
              {dwarf.trait_extraversion !== null && needBar("Extra.", dwarf.trait_extraversion * 100, "#44ccaa")}
              {dwarf.trait_agreeableness !== null && needBar("Agree.", dwarf.trait_agreeableness * 100, "var(--green)")}
              {dwarf.trait_neuroticism !== null && needBar("Neuro.", dwarf.trait_neuroticism * 100, "var(--red, #f87171)")}
            </div>
          </div>
        )}

        {dwarf.memories && dwarf.memories.length > 0 && (
          <div className="border-t border-[var(--border)] pt-2 mt-2">
            <div className="text-[var(--amber)] font-bold mb-0.5">Thoughts</div>
            <ul className="space-y-0.5">
              {[...dwarf.memories].reverse().slice(0, 5).map((thought: DwarfThought, i: number) => (
                <li key={i} className="flex items-start gap-1">
                  <span className={
                    thought.sentiment === "positive" ? "text-[var(--green)]" :
                    thought.sentiment === "negative" ? "text-[#f87171]" :
                    "text-[var(--text)]"
                  }>
                    {thought.sentiment === "positive" ? "+" : thought.sentiment === "negative" ? "-" : "·"}
                  </span>
                  <span className="text-[var(--text)]">{thought.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
    </EntityModal>
  );
}
