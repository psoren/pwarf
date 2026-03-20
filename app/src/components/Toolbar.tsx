import type { Item } from "@pwarf/shared";
import ResourceCounter from "./ResourceCounter";

const SPEEDS = [1, 2, 5] as const;

interface ToolbarProps {
  mode: "fortress" | "world";
  onSignOut?: () => void;
  onRestart?: () => void;
  onTogglePause?: () => void;
  isPaused?: boolean;
  speed?: number;
  onSetSpeed?: (multiplier: number) => void;
  population?: number;
  year?: number;
  civName?: string;
  items?: Item[];
}

export default function Toolbar({ mode, onSignOut, onRestart, onTogglePause, isPaused = false, speed = 1, onSetSpeed, population = 0, year = 1, civName, items = [] }: ToolbarProps) {
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
        {mode === "fortress" && items.length > 0 && <ResourceCounter items={items} />}
        <span className="text-[var(--amber)]">No alerts</span>
        {mode === "fortress" && onTogglePause && (
          <div className="flex items-center gap-1">
            <button
              onClick={onTogglePause}
              className={`px-2 py-0.5 border cursor-pointer ${
                isPaused
                  ? "border-[var(--amber)] text-[var(--amber)] hover:text-[var(--green)] hover:border-[var(--green)]"
                  : "border-[var(--border)] text-[var(--text)] hover:text-[var(--amber)] hover:border-[var(--amber)]"
              }`}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
            {onSetSpeed && SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => onSetSpeed(s)}
                disabled={isPaused}
                className={`px-1.5 py-0.5 border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  speed === s
                    ? "border-[var(--green)] text-[var(--green)]"
                    : "border-[var(--border)] text-[var(--text)] hover:text-[var(--amber)] hover:border-[var(--amber)]"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        )}
        {onRestart && (
          <button
            onClick={onRestart}
            className="px-2 py-0.5 border border-[var(--border)] text-[var(--text)] hover:text-[var(--red,#f87171)] hover:border-[var(--red,#f87171)] cursor-pointer"
          >
            New Game
          </button>
        )}
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
