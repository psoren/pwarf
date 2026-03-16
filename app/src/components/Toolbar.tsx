interface ToolbarProps {
  mode: "fortress" | "world";
  onSignOut?: () => void;
}

export default function Toolbar({ mode, onSignOut }: ToolbarProps) {
  return (
    <header className="flex items-center justify-between px-3 py-1 border-b border-[var(--border)] bg-[var(--bg-panel)] text-xs select-none shrink-0">
      <div className="flex gap-4 items-center">
        <span className="text-[var(--amber)] font-bold tracking-wider">
          pWarf
        </span>
        <span className="text-[var(--text)]">Year 205</span>
        <span className="text-[var(--green)]">
          {mode === "fortress" ? "Stonegear" : "World Map"}
        </span>
      </div>

      <div className="flex gap-4 items-center">
        <span>Pop: 7</span>
        <span>Wealth: 1240</span>
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
