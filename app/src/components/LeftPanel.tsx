interface LeftPanelProps {
  mode: "fortress" | "world";
  collapsed: boolean;
  onToggle: () => void;
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

export default function LeftPanel({ mode, collapsed, onToggle }: LeftPanelProps) {
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
          ) : (
            <div className="space-y-1">
              <p>Terrain: Plains</p>
              <p>Biome: Temperate</p>
              <p>Elevation: 120</p>
              <p>Rainfall: Medium</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
