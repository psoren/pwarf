import type { WorldTile } from "@pwarf/shared";

interface LeftPanelProps {
  mode: "fortress" | "world";
  collapsed: boolean;
  onToggle: () => void;
  cursorTile?: WorldTile | null;
  onEmbark?: () => void;
}

const PLACEHOLDER_DWARVES = [
  { name: "Urist", job: "Miner" },
  { name: "Doren", job: "Mason" },
  { name: "Kadol", job: "Brewer" },
  { name: "Aban", job: "Woodcutter" },
  { name: "Likot", job: "Farmer" },
  { name: "Morul", job: "Idle" },
  { name: "Fikod", job: "Hauling" },
];

export default function LeftPanel({ mode, collapsed, onToggle, cursorTile, onEmbark }: LeftPanelProps) {
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
          <h2 className="text-[var(--amber)] mb-1 font-bold">
            {mode === "fortress" ? "Dwarves" : "Tile Info"}
          </h2>

          {mode === "fortress" ? (
            <ul className="space-y-0.5">
              {PLACEHOLDER_DWARVES.map((d) => (
                <li
                  key={d.name}
                  className="flex justify-between hover:bg-[var(--bg-hover)] px-1"
                >
                  <span className="text-[var(--green)]">{d.name}</span>
                  <span className="text-[var(--text)]">{d.job}</span>
                </li>
              ))}
            </ul>
          ) : cursorTile ? (
            <div className="space-y-1">
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
              <p>Hover over a tile to see info</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
