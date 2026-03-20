import type { WorldTile, Item } from "@pwarf/shared";
import type { LiveDwarf } from "../hooks/useDwarves";
import type { ActiveTask } from "../hooks/useTasks";

const AUTONOMOUS_TASK_TYPES: ReadonlySet<string> = new Set(['eat', 'drink', 'sleep', 'wander']);

/** Returns a CSS color for a dwarf's name based on their stress level (0–100). */
export function stressColor(stressLevel: number): string {
  if (stressLevel >= 67) return "var(--red)";
  if (stressLevel >= 34) return "var(--amber)";
  return "var(--green)";
}

interface LeftPanelProps {
  mode: "fortress" | "world";
  collapsed: boolean;
  onToggle: () => void;
  cursorTile?: WorldTile | null;
  onEmbark?: () => void;
  dwarves?: LiveDwarf[];
  onDwarfClick?: (dwarfId: string) => void;
  items?: Item[];
  tasks?: ActiveTask[];
  selectedFortressTile?: { x: number; y: number } | null;
  stockpileTiles?: Set<string>;
  zLevel?: number;
}

function dwarfJobLabel(d: LiveDwarf, tasks?: ActiveTask[]): string {
  if (!d.current_task_id) return "Idle";
  const task = tasks?.find(t => t.id === d.current_task_id);
  if (!task) return "Working";
  const label = task.task_type.replace(/_/g, " ");
  if (AUTONOMOUS_TASK_TYPES.has(task.task_type) || task.work_required === 0) return label;
  const pct = Math.round((task.work_progress / task.work_required) * 100);
  return `${label} (${pct}%)`;
}

export default function LeftPanel({ mode, collapsed, onToggle, cursorTile, onEmbark, dwarves = [], onDwarfClick, items = [], tasks, selectedFortressTile, stockpileTiles, zLevel = 0 }: LeftPanelProps) {
  const isOcean = cursorTile?.terrain === "ocean";

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
            selectedFortressTile && stockpileTiles?.has(`${selectedFortressTile.x},${selectedFortressTile.y},${zLevel}`) ? (
              // Stockpile detail view
              <div className="space-y-2">
                <h2 className="text-[var(--amber)] font-bold">Stockpile</h2>
                <div className="text-[var(--text)]">
                  Pos: <span className="text-[var(--green)]">({selectedFortressTile.x}, {selectedFortressTile.y}, z{zLevel})</span>
                </div>
                {(() => {
                  const tileItems = items.filter(i =>
                    i.held_by_dwarf_id === null &&
                    i.position_x === selectedFortressTile.x &&
                    i.position_y === selectedFortressTile.y &&
                    i.position_z === zLevel
                  );
                  return tileItems.length > 0 ? (
                    <div className="border-t border-[var(--border)] pt-1 mt-1">
                      <div className="text-[var(--text)] mb-1">{tileItems.length} item{tileItems.length !== 1 ? 's' : ''}</div>
                      <ul className="space-y-0.5">
                        {tileItems.map((item) => (
                          <li key={item.id} className="flex justify-between">
                            <span className="text-[var(--green)]">{item.name}</span>
                            <span className="text-[var(--text)]">
                              {item.material && <span className="text-[var(--border)] mr-1">{item.material}</span>}
                              {item.weight ?? 0}w
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-[var(--text)] border-t border-[var(--border)] pt-1 mt-1">Empty</div>
                  );
                })()}
              </div>
            ) : (
              <>
                <h2 className="text-[var(--amber)] mb-1 font-bold">Dwarves</h2>
                <ul className="space-y-0.5">
                  {dwarves.map((d) => (
                    <li
                      key={d.id}
                      className="flex justify-between hover:bg-[var(--bg-hover)] px-1 cursor-pointer"
                      onClick={() => onDwarfClick?.(d.id)}
                    >
                      <span style={{ color: stressColor(d.stress_level) }}>{d.name}</span>
                      <span className="text-[var(--text)]">
                        <span className="text-[var(--border)] mr-1">z{d.position_z}</span>
                        {dwarfJobLabel(d, tasks)}
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
