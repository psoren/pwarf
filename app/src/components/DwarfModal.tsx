import { useEffect, useState } from "react";
import type { DwarfSkill, Item } from "@pwarf/shared";
import { DWARF_CARRY_CAPACITY } from "@pwarf/shared";
import { supabase } from "../lib/supabase";
import type { LiveDwarf, DwarfThought } from "../hooks/useDwarves";
import type { ActiveTask } from "../hooks/useTasks";
import { skillStars } from "../utils/skillStars";

interface DwarfModalProps {
  dwarf: LiveDwarf;
  onClose: () => void;
  onGoTo: (dwarf: LiveDwarf) => void;
  items?: Item[];
  tasks?: ActiveTask[];
}

const AUTONOMOUS_TASK_TYPES: ReadonlySet<string> = new Set(['eat', 'drink', 'sleep', 'wander']);

function dwarfJobLabel(d: LiveDwarf, tasks?: ActiveTask[]): string {
  if (!d.current_task_id) return "Idle";
  const task = tasks?.find(t => t.id === d.current_task_id);
  if (!task) return "Working";
  const label = task.task_type.replace(/_/g, " ");
  if (AUTONOMOUS_TASK_TYPES.has(task.task_type) || task.work_required === 0) {
    return label;
  }
  const pct = Math.round((task.work_progress / task.work_required) * 100);
  return `${label} (${pct}%)`;
}

function needBar(label: string, value: number, color: string) {
  const pct = Math.round(value);
  const barColor = value < 25 ? "var(--red, #f87171)" : color;
  return (
    <div className="flex items-center gap-1">
      <span className="w-14 text-[var(--text)]">{label}</span>
      <div className="flex-1 h-2 bg-[#333] rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="w-8 text-right" style={{ color: barColor }}>{pct}</span>
    </div>
  );
}

export function DwarfModal({ dwarf, onClose, onGoTo, items = [], tasks }: DwarfModalProps) {
  const [skills, setSkills] = useState<DwarfSkill[]>([]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onClose]);

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

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-panel)] border border-[var(--amber)] p-4 min-w-[280px] max-w-[360px] text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[var(--green)] font-bold text-sm">
            {dwarf.name}{dwarf.surname ? ` ${dwarf.surname}` : ""}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text)] hover:text-[var(--amber)] cursor-pointer"
          >
            [Esc]
          </button>
        </div>

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
            Pos: <span className="text-[var(--green)]">({dwarf.position_x}, {dwarf.position_y}, z{dwarf.position_z})</span>
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
          {needBar("Social", dwarf.need_social, "#44ccaa")}
          {needBar("Purpose", dwarf.need_purpose, "#ccaa44")}
          {needBar("Beauty", dwarf.need_beauty, "#cc44aa")}
        </div>

        <div className="border-t border-[var(--border)] pt-2 mt-2">
          <div className="text-[var(--amber)] font-bold mb-0.5">Stress</div>
          {needBar("Stress", dwarf.stress_level, "#ff6600")}
        </div>

        <div className="border-t border-[var(--border)] pt-2 mt-2">
          <div className="text-[var(--amber)] font-bold mb-0.5">Health</div>
          {needBar("HP", dwarf.health, "var(--green)")}
        </div>

        <div className="border-t border-[var(--border)] pt-2 mt-2">
          <div className="text-[var(--amber)] font-bold mb-0.5">Personality</div>
          {needBar("Open", dwarf.trait_openness * 100, "#6699cc")}
          {needBar("Consc.", dwarf.trait_conscientiousness * 100, "#6699cc")}
          {needBar("Extrav.", dwarf.trait_extraversion * 100, "#6699cc")}
          {needBar("Agree.", dwarf.trait_agreeableness * 100, "#44ccaa")}
          {needBar("Neuro.", dwarf.trait_neuroticism * 100, "#f97316")}
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
      </div>
    </div>
  );
}
