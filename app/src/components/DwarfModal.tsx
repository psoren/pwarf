import { useEffect } from "react";
import type { LiveDwarf, DwarfThought } from "../hooks/useDwarves";

interface DwarfModalProps {
  dwarf: LiveDwarf;
  onClose: () => void;
  onGoTo: (dwarf: LiveDwarf) => void;
}

function dwarfJobLabel(d: LiveDwarf): string {
  if (d.current_task_id) return "Working";
  return "Idle";
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

export function DwarfModal({ dwarf, onClose, onGoTo }: DwarfModalProps) {
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

        <div className="text-[var(--text)] mb-2">
          Status: <span className="text-[var(--green)]">{dwarfJobLabel(dwarf)}</span>
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
        </div>

        <div className="border-t border-[var(--border)] pt-2 mt-2">
          <div className="text-[var(--amber)] font-bold mb-0.5">Stress</div>
          {needBar("Stress", dwarf.stress_level, "#ff6600")}
        </div>

        <div className="border-t border-[var(--border)] pt-2 mt-2">
          <div className="text-[var(--amber)] font-bold mb-0.5">Health</div>
          {needBar("HP", dwarf.health, "var(--green)")}
        </div>

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
