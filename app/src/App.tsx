import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
import { useDwarves } from "./hooks/useDwarves";
import { useSimRunner } from "./hooks/useSimRunner";
import { useTasks } from "./hooks/useTasks";
import { createAndGenerateWorld } from "./lib/world-gen";
import { embark } from "./lib/embark";
import { ensurePlayer } from "./lib/ensure-player";
import { loadSession } from "./lib/load-session";
import { supabase } from "./lib/supabase";
import { FORTRESS_MAX_Z, FORTRESS_MIN_Z, FORTRESS_SIZE, WORK_MINE_BASE } from "@pwarf/shared";

type Mode = "fortress" | "world";
type DesignationMode = "none" | "mine";

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

  // Designation mode
  const [designationMode, setDesignationMode] = useState<DesignationMode>("none");

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

  // Live dwarves from DB
  const liveDwarves = useDwarves(civId);

  // Build dwarf position map for rendering
  const dwarfPositions = useMemo(() => {
    const map = new Map<string, { name: string }>();
    for (const d of liveDwarves) {
      if (d.position_z === zLevel) {
        map.set(`${d.position_x},${d.position_y}`, { name: d.name });
      }
    }
    return map;
  }, [liveDwarves, zLevel]);

  // Sim runner
  useSimRunner(civId, worldId);

  // Active tasks
  const { designatedTiles } = useTasks(civId);

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
            // Center viewport on fortress center where dwarves spawn
            const center = Math.floor(FORTRESS_SIZE / 2);
            viewport.setOffset(center - Math.floor(vpCols / 2), center - Math.floor(vpRows / 2));
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
        case "designate_mine":
          if (mode === "fortress") {
            setDesignationMode((m) => (m === "mine" ? "none" : "mine"));
          }
          break;
        case "cancel_designation":
          setDesignationMode("none");
          break;
      }
    },
    [viewport.pan, civId, mode],
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
    if (!worldId || !worldSeed || !cursorTile || cursorTile.terrain === "ocean") return;
    try {
      const id = await embark(worldId, viewport.cursorX, viewport.cursorY, worldSeed);
      setCivId(id);
      setMode("fortress");
      const center = Math.floor(FORTRESS_SIZE / 2);
      viewport.setOffset(center - Math.floor(vpCols / 2), center - Math.floor(vpRows / 2));
    } catch (err) {
      console.error("Embark failed:", err);
    }
  }, [worldId, worldSeed, cursorTile, viewport.cursorX, viewport.cursorY]);

  const handleTileClick = useCallback(async (x: number, y: number) => {
    if (designationMode !== 'mine' || !civId) return;

    // Check that the tile is minable
    const tile = getFortressTile(x, y);
    if (!tile) return;
    const mineable: string[] = ['stone', 'ore', 'gem', 'soil', 'cavern_wall'];
    if (!mineable.includes(tile.tileType)) return;

    // Don't double-designate
    if (designatedTiles.has(`${x},${y}`)) return;

    const { error } = await supabase.from('tasks').insert({
      civilization_id: civId,
      task_type: 'mine',
      status: 'pending',
      priority: 5,
      target_x: x,
      target_y: y,
      target_z: zLevel,
      work_required: WORK_MINE_BASE,
    });

    if (error) {
      console.error('[designate] Failed to create mine task:', error.message);
    }
  }, [designationMode, civId, zLevel, getFortressTile, designatedTiles]);

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
      <Toolbar
        mode={mode}
        onSignOut={signOut}
        population={liveDwarves.length}
        year={1}
        civName={mode === "fortress" ? "Stonegear" : undefined}
      />

      <div className="flex flex-1 min-h-0">
        <LeftPanel
          mode={mode}
          collapsed={!leftOpen}
          onToggle={() => setLeftOpen((o) => !o)}
          cursorTile={cursorTile}
          onEmbark={mode === "world" ? handleEmbark : undefined}
          dwarves={liveDwarves}
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
          fortressTiles={mode === "fortress" ? fortressTileMap : undefined}
          onViewportSize={handleViewportSize}
          dwarfPositions={mode === "fortress" ? dwarfPositions : undefined}
          designatedTiles={mode === "fortress" ? designatedTiles : undefined}
          designationMode={mode === "fortress" ? designationMode : undefined}
          onTileClick={mode === "fortress" ? handleTileClick : undefined}
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
        designationMode={mode === "fortress" ? designationMode : undefined}
      />
    </div>
  );
}

function formatFortressTileLabel(tileType: string, material: string | null): string {
  const label = tileType.replace(/_/g, " ");
  if (material) return `${label} (${material})`;
  return label;
}
