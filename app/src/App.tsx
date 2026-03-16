import { useState, useCallback, useRef } from "react";
import Toolbar from "./components/Toolbar";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import MainViewport from "./components/MainViewport";
import BottomBar from "./components/BottomBar";
import { useKeyboard, type KeyAction } from "./hooks/useKeyboard";
import { useViewport } from "./hooks/useViewport";
import { useWorldTiles } from "./hooks/useWorldTiles";
import { createAndGenerateWorld } from "./lib/world-gen";
import { embark } from "./lib/embark";

type Mode = "fortress" | "world";

export default function App() {
  const [mode, setMode] = useState<Mode>("world");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // World state
  const [worldId, setWorldId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [civId, setCivId] = useState<string | null>(null);

  // Viewport size (reported from MainViewport)
  const [vpCols, setVpCols] = useState(120);
  const [vpRows, setVpRows] = useState(44);
  const vpSizeRef = useRef({ cols: 120, rows: 44 });

  const viewport = useViewport();

  const { tileMap, getTile } = useWorldTiles({
    worldId,
    offsetX: viewport.offsetX,
    offsetY: viewport.offsetY,
    viewportCols: vpCols,
    viewportRows: vpRows,
  });

  const cursorTile = worldId ? getTile(viewport.cursorX, viewport.cursorY) : null;

  const handleKeyAction = useCallback(
    (action: KeyAction) => {
      switch (action.type) {
        case "pan":
          viewport.pan(action.dx, action.dy);
          break;
        case "toggle_mode":
          if (civId) {
            setMode((m) => (m === "fortress" ? "world" : "fortress"));
          }
          break;
        case "toggle_left_panel":
          setLeftOpen((o) => !o);
          break;
        case "toggle_right_panel":
          setRightOpen((o) => !o);
          break;
      }
    },
    [viewport.pan, civId],
  );

  useKeyboard(handleKeyAction);

  const handleViewportSize = useCallback((cols: number, rows: number) => {
    if (cols !== vpSizeRef.current.cols || rows !== vpSizeRef.current.rows) {
      vpSizeRef.current = { cols, rows };
      setVpCols(cols);
      setVpRows(rows);
    }
  }, []);

  const handleGenerateWorld = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    setGenProgress(0);
    try {
      const { worldId: wid } = await createAndGenerateWorld("New World", (pct) => {
        setGenProgress(pct);
      });
      setWorldId(wid);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleEmbark = useCallback(async () => {
    if (!worldId || !cursorTile || cursorTile.terrain === "ocean") return;
    try {
      const id = await embark(worldId, viewport.cursorX, viewport.cursorY);
      setCivId(id);
      setMode("fortress");
    } catch (err) {
      console.error("Embark failed:", err);
    }
  }, [worldId, cursorTile, viewport.cursorX, viewport.cursorY]);

  // Pre-world screen: generate button
  if (!worldId && !generating) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-panel)] gap-4">
        <h1 className="text-[var(--amber)] text-2xl font-bold tracking-wider">pWarf</h1>
        <p className="text-[var(--text)] text-sm">A dwarf fortress adventure awaits.</p>
        {genError && (
          <p className="text-red-400 text-xs max-w-md text-center">{genError}</p>
        )}
        <button
          onClick={handleGenerateWorld}
          className="px-6 py-2 border border-[var(--green)] text-[var(--green)] font-bold text-sm hover:bg-[var(--green)] hover:text-[var(--bg-panel)] cursor-pointer"
        >
          Generate World
        </button>
      </div>
    );
  }

  // Generating screen
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-panel)] gap-4">
        <h1 className="text-[var(--amber)] text-2xl font-bold tracking-wider">pWarf</h1>
        <p className="text-[var(--text)] text-sm">Generating world...</p>
        <div className="w-64 h-4 border border-[var(--border)] bg-[var(--bg-panel)]">
          <div
            className="h-full bg-[var(--green)] transition-[width] duration-200"
            style={{ width: `${genProgress}%` }}
          />
        </div>
        <p className="text-[var(--text)] text-xs">{genProgress}%</p>
      </div>
    );
  }

  const terrainForBar = mode === "world" ? (cursorTile?.terrain ?? null) : null;

  return (
    <div className="flex flex-col h-full w-full">
      <Toolbar mode={mode} />

      <div className="flex flex-1 min-h-0">
        <LeftPanel
          mode={mode}
          collapsed={!leftOpen}
          onToggle={() => setLeftOpen((o) => !o)}
          cursorTile={cursorTile}
          onEmbark={mode === "world" && !civId ? handleEmbark : undefined}
        />

        <MainViewport
          mode={mode}
          offsetX={viewport.offsetX}
          offsetY={viewport.offsetY}
          cursorX={viewport.cursorX}
          cursorY={viewport.cursorY}
          onCursorMove={viewport.setCursor}
          onDragStart={viewport.onDragStart}
          onDragMove={viewport.onDragMove}
          onDragEnd={viewport.onDragEnd}
          worldTiles={mode === "world" ? tileMap : undefined}
          onViewportSize={handleViewportSize}
        />

        <RightPanel
          collapsed={!rightOpen}
          onToggle={() => setRightOpen((o) => !o)}
        />
      </div>

      <div className="flex items-center justify-center gap-2 py-0.5 bg-[var(--bg-panel)] border-t border-[var(--border)] text-xs select-none">
        <button
          onClick={() => civId && setMode("fortress")}
          className={`px-2 py-0.5 cursor-pointer ${mode === "fortress" ? "text-[var(--green)]" : "text-[var(--text)] hover:text-[var(--amber)]"} ${!civId ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={!civId}
        >
          Fortress
        </button>
        <span className="text-[var(--border)]">|</span>
        <button
          onClick={() => setMode("world")}
          className={`px-2 py-0.5 cursor-pointer ${mode === "world" ? "text-[var(--green)]" : "text-[var(--text)] hover:text-[var(--amber)]"}`}
        >
          World
        </button>
      </div>

      <BottomBar mode={mode} cursorX={viewport.cursorX} cursorY={viewport.cursorY} terrain={terrainForBar} />
    </div>
  );
}
