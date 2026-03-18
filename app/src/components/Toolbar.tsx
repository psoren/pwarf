interface ToolbarProps {
  mode: "fortress" | "world";
  onSignOut?: () => void;
  population?: number;
  year?: number;
  civName?: string;
}

export default function Toolbar({ mode, onSignOut, population = 0, year = 1, civName }: ToolbarProps) {
  return (
    <header className="flex items-center justify-between px-3 py-1 border-b border-[var(--border)] bg-[var(--bg-panel)] text-xs select-none shrink-0">
      <div className="flex gap-4 items-center">
        <span className="text-[var(--amber)] font-bold tracking-wider">
          pWarf
        </span>
        <span className="text-[var(--text)]">Year {year}</span>
        <span className="text-[var(--green)]">
          {mode === "fortress" ? (civName ?? "Fortress") : "World Map"}
        </span>
      </div>

      <div className="flex gap-4 items-center">
        <span>Pop: {population}</span>
        <span className="text-[var(--amber)]">No alerts</span>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="px-2 py-0.5 border border-[var(--border)] text-[var(--text)] hover:text-[var(--amber)] hover:border-[var(--amber)] cursor-pointer"
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}
