interface BottomBarProps {
  mode: "fortress" | "world";
  cursorX: number;
  cursorY: number;
  terrain?: string | null;
  zLevel?: number;
  fortressTileLabel?: string | null;
}

export default function BottomBar({ mode, cursorX, cursorY, terrain, zLevel, fortressTileLabel }: BottomBarProps) {
  const terrainLabel = terrain ?? fortressTileLabel ?? (mode === "fortress" ? "Floor (stone)" : "Plains");

  return (
    <footer className="flex items-center justify-between px-3 py-0.5 border-t border-[var(--border)] bg-[var(--bg-panel)] text-xs select-none shrink-0">
      <div className="flex gap-3">
        <span className="text-[var(--text)]">
          Tile: ({cursorX}, {cursorY})
        </span>
        {zLevel != null && (
          <span className="text-[var(--amber)]">
            Z: {zLevel}
          </span>
        )}
        <span className="text-[var(--text)]">
          {terrainLabel}
        </span>
      </div>

      <div className="flex gap-3 text-[var(--text)]">
        <span>
          <kbd className="text-[var(--amber)]">WASD</kbd> pan
        </span>
        {mode === "fortress" && (
          <span>
            <kbd className="text-[var(--amber)]">&lt; &gt;</kbd> z-level
          </span>
        )}
        <span>
          <kbd className="text-[var(--amber)]">Tab</kbd> mode
        </span>
        <span>
          <kbd className="text-[var(--amber)]">[ ]</kbd> panels
        </span>
      </div>
    </footer>
  );
}
