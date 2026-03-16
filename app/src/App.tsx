import { useState, useCallback, useRef, useEffect } from "react";
import Toolbar from "./components/Toolbar";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import MainViewport from "./components/MainViewport";
import BottomBar from "./components/BottomBar";
import AuthScreen from "./components/AuthScreen";
import { useKeyboard, type KeyAction } from "./hooks/useKeyboard";
import { useViewport } from "./hooks/useViewport";
import { useWorldTiles } from "./hooks/useWorldTiles";
import { useFortressTiles } from "./hooks/useFortressTiles";
import { useAuth } from "./hooks/useAuth";
import { createAndGenerateWorld } from "./lib/world-gen";
import { embark } from "./lib/embark";
import { ensurePlayer } from "./lib/ensure-player";
import { loadSession } from "./lib/load-session";
import { supabase } from "./lib/supabase";
import { FORTRESS_MAX_Z, FORTRESS_MIN_Z } from "@pwarf/shared";

type Mode = "fortress" | "world";

export default function App() {
  const { session, user, loading, signIn, signUp, signOut } = useAuth();
  const [playerEnsured, setPlayerEnsured] = useState(false);

  const [mode, setMode] = useState<Mode>("world");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // World state
  const [worldId, setWorldId] = useState<string | null>(null);
  const [worldSeed, setWorldSeed] = useState<bigint | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [civId, setCivId] = useState<string | null>(null);

  // Fortress z-level
  const [zLevel, setZLevel] = useState(0);

  // Viewport size (reported from MainViewport)
  const [vpCols, setVpCols] = useState(120);
  const [vpRows, setVpRows] = useState(44);
  const vpSizeRef = useRef({ cols: 120, rows: 44 });

  const viewport = useViewport();

  const { tileMap, getTile } = useWorldTiles({
    worldId,
    worldSeed,
    offsetX: viewport.offsetX,
    offsetY: viewport.offsetY,
    viewportCols: vpCols,
    viewportRows: vpRows,
  });

  const { tileMap: fortressTileMap, getTile: getFortressTile } = useFortressTiles({
    civId,
    worldSeed,
    offsetX: viewport.offsetX,
    offsetY: viewport.offsetY,
    zLevel,
    viewportCols: vpCols,
    viewportRows: vpRows,
  });

  const cursorTile = worldId ? getTile(viewport.cursorX, viewport.cursorY) : null;
  const cursorFortressTile = civId ? getFortressTile(viewport.cursorX, viewport.cursorY) : null;

  // Ensure player profile exists after auth, then restore any existing session
  useEffect(() => {
    if (user && !playerEnsured) {
      ensurePlayer(supabase, user.id, user.email ?? "unknown")
        .then(() => loadSession(user.id))
        .then((session) => {
          if (session.worldId) {
            setWorldId(session.worldId);
            setWorldSeed(session.worldSeed);
          }
          if (session.civId) {
            setCivId(session.civId);
            setMode("fortress");
            if (session.fortressX != null && session.fortressY != null) {
              viewport.setOffset(session.fortressX, session.fortressY);
            }
          }
          setPlayerEnsured(true);
        })
        .catch((err) => console.error("Failed to ensure player:", err));
    }
    if (!user) {
      setPlayerEnsured(false);
      setWorldId(null);
      setWorldSeed(null);
      setCivId(null);
    }
  }, [user, playerEnsured, viewport.setOffset]);

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
        case "z_up":
          setZLevel((z) => Math.min(FORTRESS_MAX_Z, z + 1));
          break;
        case "z_down":
          setZLevel((z) => Math.max(FORTRESS_MIN_Z, z - 1));
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
    setCreating(true);
    setCreateError(null);
    try {
      const { worldId: wid, seed } = await createAndGenerateWorld("New World");
      setWorldId(wid);
      setWorldSeed(seed);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
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

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-panel)] gap-4">
        <h1 className="text-[var(--amber)] text-2xl font-bold tracking-wider">pWarf</h1>
        <p className="text-[var(--text)] text-sm">Loading...</p>
      </div>
    );
  }

  // Auth screen
  if (!session) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  // Restoring session
  if (user && !playerEnsured) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-panel)] gap-4">
        <h1 className="text-[var(--amber)] text-2xl font-bold tracking-wider">pWarf</h1>
        <p className="text-[var(--text)] text-sm">Restoring session...</p>
      </div>
    );
  }

  // Pre-world screen: generate button
  if (!worldId && !creating) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-panel)] gap-4">
        <h1 className="text-[var(--amber)] text-2xl font-bold tracking-wider">pWarf</h1>
        <p className="text-[var(--text)] text-sm">A dwarf fortress adventure awaits.</p>
        {createError && (
          <p className="text-red-400 text-xs max-w-md text-center">{createError}</p>
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

  // Creating world (just the DB insert, very fast)
  if (creating) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-panel)] gap-4">
        <h1 className="text-[var(--amber)] text-2xl font-bold tracking-wider">pWarf</h1>
        <p className="text-[var(--text)] text-sm">Creating world...</p>
      </div>
    );
  }

  const terrainForBar = mode === "world" ? (cursorTile?.terrain ?? null) : null;
  const fortressTileLabel = mode === "fortress" && cursorFortressTile
    ? formatFortressTileLabel(cursorFortressTile.tileType, cursorFortressTile.material)
    : null;

  return (
    <div className="flex flex-col h-full w-full">
      <Toolbar mode={mode} onSignOut={signOut} />

      <div className="flex flex-1 min-h-0">
        <LeftPanel
          mode={mode}
          collapsed={!leftOpen}
          onToggle={() => setLeftOpen((o) => !o)}
          cursorTile={cursorTile}
          onEmbark={mode === "world" ? handleEmbark : undefined}
        />

        <MainViewport
          mode={mode}
          offsetX={viewport.offsetX}
          offsetY={viewport.offsetY}
          cursorX={viewport.cursorX}
          cursorY={viewport.cursorY}
          zLevel={zLevel}
          onCursorMove={viewport.setCursor}
          onDragStart={viewport.onDragStart}
          onDragMove={viewport.onDragMove}
          onDragEnd={viewport.onDragEnd}
          worldTiles={mode === "world" ? tileMap : undefined}
          fortressTiles={mode === "fortress" ? fortressTileMap : undefined}
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

      <BottomBar
        mode={mode}
        cursorX={viewport.cursorX}
        cursorY={viewport.cursorY}
        terrain={terrainForBar}
        zLevel={mode === "fortress" ? zLevel : undefined}
        fortressTileLabel={fortressTileLabel}
      />
    </div>
  );
}

function formatFortressTileLabel(tileType: string, material: string | null): string {
  const label = tileType.replace(/_/g, " ");
  if (material) return `${label} (${material})`;
  return label;
}
