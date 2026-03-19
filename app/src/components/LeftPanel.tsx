import { useState } from "react";
import type { WorldTile } from "@pwarf/shared";
import type { LiveDwarf, DwarfThought } from "../hooks/useDwarves";

interface LeftPanelProps {
  mode: "fortress" | "world";
  collapsed: boolean;
  onToggle: () => void;
  cursorTile?: WorldTile | null;
  onEmbark?: () => void;
  dwarves?: LiveDwarf[];
  onGoToDwarf?: (dwarf: LiveDwarf) => void;
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
      <span className="w-12 text-[var(--text)]">{label}</span>
      <div className="flex-1 h-1.5 bg-[#333] rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="w-6 text-right" style={{ color: barColor }}>{pct}</span>
    </div>
  );
}

export default function LeftPanel({ mode, collapsed, onToggle, cursorTile, onEmbark, dwarves = [], onGoToDwarf }: LeftPanelProps) {
  const isOcean = cursorTile?.terrain === "ocean";
  const [selectedDwarfId, setSelectedDwarfId] = useState<string | null>(null);

  const selectedDwarf = selectedDwarfId ? dwarves.find(d => d.id === selectedDwarfId) : null;

  return (
    <aside
      className="border-r border-[var(--border)] bg-[var(--bg-panel)] flex flex-col shrink-0 overflow-hidden transition-[width] duration-150"
      style={{ width: collapsed ? 24 : 200 }}
    >
      <button
        onClick={onToggle}
        className="text-[var(--text)] hover:text-[var(--green)] text-xs px-1 py-0.5 self-end cursor-pointer"
        title={collapsed ? "Expand [" : "Collapse ["}
      >
        {collapsed ? ">" : "<"}
      </button>

      {!collapsed && (
        <div className="px-2 pb-2 overflow-y-auto text-xs">
          {mode === "fortress" ? (
            selectedDwarf ? (
              // Dwarf detail view
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedDwarfId(null)}
                    className="text-[var(--amber)] hover:text-[var(--green)] cursor-pointer"
                  >
                    &larr;
                  </button>
                  <h2 className="text-[var(--green)] font-bold">
                    {selectedDwarf.name}{selectedDwarf.surname ? ` ${selectedDwarf.surname}` : ""}
                  </h2>
                </div>

                <div className="text-[var(--text)]">
                  Status: <span className="text-[var(--green)]">{dwarfJobLabel(selectedDwarf)}</span>
                </div>

                <div className="text-[var(--text)] flex items-center justify-between">
                  <span>
                    Pos: <span className="text-[var(--green)]">({selectedDwarf.position_x}, {selectedDwarf.position_y}, z{selectedDwarf.position_z})</span>
                  </span>
                  {onGoToDwarf && (
                    <button
                      onClick={() => onGoToDwarf(selectedDwarf)}
                      className="text-[var(--amber)] hover:text-[var(--green)] cursor-pointer"
                      title="Jump camera to this dwarf"
                    >
                      Go to
                    </button>
                  )}
                </div>

                <div className="border-t border-[var(--border)] pt-1 mt-1 space-y-1">
                  <div className="text-[var(--amber)] font-bold mb-0.5">Needs</div>
                  {needBar("Food", selectedDwarf.need_food, "var(--green)")}
                  {needBar("Drink", selectedDwarf.need_drink, "#4488ff")}
                  {needBar("Sleep", selectedDwarf.need_sleep, "#aa88ff")}
                </div>

                <div className="border-t border-[var(--border)] pt-1 mt-1">
                  <div className="text-[var(--amber)] font-bold mb-0.5">Stress</div>
                  {needBar("Stress", selectedDwarf.stress_level, "#ff6600")}
                </div>

                <div className="border-t border-[var(--border)] pt-1 mt-1">
                  <div className="text-[var(--amber)] font-bold mb-0.5">Health</div>
                  {needBar("HP", selectedDwarf.health, "var(--green)")}
                </div>

                {selectedDwarf.memories && selectedDwarf.memories.length > 0 && (
                  <div className="border-t border-[var(--border)] pt-1 mt-1">
                    <div className="text-[var(--amber)] font-bold mb-0.5">Thoughts</div>
                    <ul className="space-y-0.5">
                      {[...selectedDwarf.memories].reverse().slice(0, 5).map((thought: DwarfThought, i: number) => (
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
            ) : (
              // Dwarf roster
              <>
                <h2 className="text-[var(--amber)] mb-1 font-bold">Dwarves</h2>
                <ul className="space-y-0.5">
                  {dwarves.map((d) => (
                    <li
                      key={d.id}
                      className="flex justify-between hover:bg-[var(--bg-hover)] px-1 cursor-pointer"
                      onClick={() => setSelectedDwarfId(d.id)}
                    >
                      <span className="text-[var(--green)]">{d.name}</span>
                      <span className="text-[var(--text)]">
                        <span className="text-[var(--border)] mr-1">z{d.position_z}</span>
                        {dwarfJobLabel(d)}
                      </span>
                    </li>
                  ))}
                  {dwarves.length === 0 && (
                    <li className="text-[var(--text)]">No dwarves</li>
                  )}
                </ul>
              </>
            )
          ) : cursorTile ? (
            <div className="space-y-1">
              <h2 className="text-[var(--amber)] mb-1 font-bold">Tile Info</h2>
              <p>
                Terrain:{" "}
                <span className="text-[var(--green)]">{cursorTile.terrain}</span>
              </p>
              <p>
                Elevation:{" "}
                <span className="text-[var(--green)]">{cursorTile.elevation}m</span>
              </p>
              <p>
                Biome:{" "}
                <span className="text-[var(--green)]">
                  {cursorTile.biome_tags?.join(", ") ?? "unknown"}
                </span>
              </p>
              <p>
                Explored:{" "}
                <span className="text-[var(--green)]">
                  {cursorTile.explored ? "Yes" : "No"}
                </span>
              </p>
              {onEmbark && (
                <button
                  onClick={onEmbark}
                  disabled={isOcean}
                  className={`mt-2 w-full px-2 py-1 text-xs font-bold border cursor-pointer ${
                    isOcean
                      ? "border-[var(--border)] text-[var(--border)] cursor-not-allowed"
                      : "border-[var(--green)] text-[var(--green)] hover:bg-[var(--green)] hover:text-[var(--bg-panel)]"
                  }`}
                  title={isOcean ? "Cannot embark on ocean" : "Embark here"}
                >
                  {isOcean ? "Cannot Embark (Ocean)" : "Embark Here"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1 text-[var(--text)]">
              <h2 className="text-[var(--amber)] mb-1 font-bold">Tile Info</h2>
              <p>Hover over a tile to see info</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
