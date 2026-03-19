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
import { useEvents } from "./hooks/useEvents";
import { useWorldState } from "./hooks/useWorldState";
import { useDesignation, type DesignationMode } from "./hooks/useDesignation";
import BuildMenu, { BUILD_OPTIONS } from "./components/BuildMenu";
import TaskPriorities from "./components/TaskPriorities";
import { DwarfModal } from "./components/DwarfModal";
import { SURFACE_Z, CAVE_Z } from "@pwarf/shared";
import type { LiveDwarf } from "./hooks/useDwarves";

export default function App() {
  const { session, user, loading, signIn, signUp, signOut } = useAuth();

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [zLevel, setZLevel] = useState(0);
  const [selectedWorldTile, setSelectedWorldTile] = useState<{ x: number; y: number } | null>(null);

  // Viewport size (reported from MainViewport)
  const [vpCols, setVpCols] = useState(120);
  const [vpRows, setVpRows] = useState(44);
  const vpSizeRef = useRef({ cols: 120, rows: 44 });

  const viewport = useViewport();

  const world = useWorldState({
    user: user ?? null,
    vpCols,
    vpRows,
    setOffset: viewport.setOffset,
  });

  const { getTile } = useWorldTiles({
    worldId: world.worldId,
    worldSeed: world.worldSeed,
    offsetX: viewport.offsetX,
    offsetY: viewport.offsetY,
    viewportCols: vpCols,
    viewportRows: vpRows,
  });

  const { getTile: getFortressTile } = useFortressTiles({
    civId: world.civId,
    worldSeed: world.worldSeed,
    terrain: world.embarkTerrain,
    offsetX: viewport.offsetX,
    offsetY: viewport.offsetY,
    zLevel,
    viewportCols: vpCols,
    viewportRows: vpRows,
  });

  const cursorTile = world.worldId ? getTile(viewport.cursorX, viewport.cursorY) : null;
  const selectedTileData = world.worldId && selectedWorldTile
    ? getTile(selectedWorldTile.x, selectedWorldTile.y)
    : null;
  const cursorFortressTile = world.civId ? getFortressTile(viewport.cursorX, viewport.cursorY) : null;

  // Sim runner — provides live in-memory state
  const { snapshot } = useSimRunner(world.civId, world.worldId);

  // Active tasks — prefer live snapshot, fall back to DB polling
  const polledTasks = useTasks(world.civId);
  const designatedTiles = useMemo(() => {
    const AUTONOMOUS: ReadonlySet<string> = new Set(['eat', 'drink', 'sleep', 'wander']);
    const tasks = snapshot?.tasks ?? polledTasks.tasks;
    const map = new Map<string, string>();
    for (const t of tasks) {
      const tx = 'target_x' in t ? t.target_x : null;
      const ty = 'target_y' in t ? t.target_y : null;
      if (tx !== null && ty !== null && !AUTONOMOUS.has(t.task_type) && ['pending', 'claimed', 'in_progress'].includes(t.status)) {
        map.set(`${tx},${ty}`, t.task_type);
      }
    }
    return map;
  }, [snapshot?.tasks, polledTasks.tasks]);

  const designation = useDesignation({
    civId: world.civId,
    zLevel,
    getFortressTile,
    designatedTiles,
  });

  // Live dwarves — prefer sim snapshot over DB polling
  const polledDwarves = useDwarves(world.civId);
  const liveDwarves: LiveDwarf[] = useMemo(() => {
    if (snapshot) {
      return snapshot.dwarves
        .filter((d) => d.status === 'alive')
        .map((d) => ({
          id: d.id,
          name: d.name,
          surname: d.surname,
          status: d.status,
          position_x: d.position_x,
          position_y: d.position_y,
          position_z: d.position_z,
          current_task_id: d.current_task_id,
          need_food: d.need_food,
          need_drink: d.need_drink,
          need_sleep: d.need_sleep,
          stress_level: d.stress_level,
          health: d.health,
          memories: d.memories as LiveDwarf['memories'],
        }));
    }
    return polledDwarves;
  }, [snapshot, polledDwarves]);

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

  // Live activity log — prefer snapshot, fall back to DB polling
  const polledEvents = useEvents(world.civId);
  const events = useMemo(() => {
    if (snapshot && snapshot.events.length > 0) {
      return snapshot.events
        .slice(-50)
        .reverse()
        .map((e) => ({
          id: e.id,
          description: e.description,
          category: e.category,
          created_at: e.created_at ?? new Date().toISOString(),
        }));
    }
    return polledEvents;
  }, [snapshot, polledEvents]);

  const handleKeyAction = useCallback(
    (action: KeyAction) => {
      switch (action.type) {
        case "pan":
          viewport.pan(action.dx, action.dy);
          break;
        case "toggle_mode":
          if (world.civId) {
            world.setMode((m) => (m === "fortress" ? "world" : "fortress"));
          }
          break;
        case "toggle_left_panel":
          setLeftOpen((o) => !o);
          break;
        case "toggle_right_panel":
          setRightOpen((o) => !o);
          break;
        case "z_up":
          setZLevel((z) => Math.min(SURFACE_Z, z + 1));
          break;
        case "z_down":
          setZLevel((z) => Math.max(CAVE_Z, z - 1));
          break;
        case "designate_mine":
          if (world.mode === "fortress") designation.toggleMine();
          break;
        case "open_build_menu":
          if (world.mode === "fortress") designation.toggleBuildMenu();
          break;
        case "open_priorities":
          if (world.mode === "fortress") designation.togglePriorities();
          break;
        case "cancel_designation":
          designation.cancelDesignation();
          break;
      }
    },
    [viewport.pan, world.civId, world.mode, designation],
  );

  useKeyboard(handleKeyAction);

  const handleViewportSize = useCallback((cols: number, rows: number) => {
    if (cols !== vpSizeRef.current.cols || rows !== vpSizeRef.current.rows) {
      vpSizeRef.current = { cols, rows };
      setVpCols(cols);
      setVpRows(rows);
    }
  }, []);

  const handleEmbark = useCallback(async () => {
    if (!selectedWorldTile || !selectedTileData || selectedTileData.terrain === "ocean") return;
    await world.handleEmbark(selectedWorldTile.x, selectedWorldTile.y);
    designation.cancelDesignation();
  }, [selectedWorldTile, selectedTileData, world, designation]);

  const handleGoToDwarf = useCallback((dwarf: LiveDwarf) => {
    setZLevel(dwarf.position_z);
    viewport.setOffset(
      dwarf.position_x - Math.floor(vpCols / 2),
      dwarf.position_y - Math.floor(vpRows / 2),
    );
  }, [viewport.setOffset, vpCols, vpRows]);

  // Dwarf info modal
  const [modalDwarfId, setModalDwarfId] = useState<string | null>(null);
  const modalDwarf = modalDwarfId ? liveDwarves.find(d => d.id === modalDwarfId) ?? null : null;

  const handleDwarfClick = useCallback((x: number, y: number) => {
    const key = `${x},${y}`;
    const dwarf = liveDwarves.find(d => d.position_x === x && d.position_y === y && d.position_z === zLevel);
    if (dwarf) setModalDwarfId(dwarf.id);
  }, [liveDwarves, zLevel]);

  // Keyboard shortcuts for build menu items when the menu is open
  useEffect(() => {
    if (!designation.buildMenuOpen) return;
    function handleBuildKey(e: KeyboardEvent) {
      const opt = BUILD_OPTIONS.find((o) => o.key === e.key);
      if (opt) {
        e.preventDefault();
        e.stopPropagation();
        designation.setBuildMenuOpen(false);
        designation.setDesignationMode(opt.taskType as DesignationMode);
      }
    }
    window.addEventListener("keydown", handleBuildKey, true);
    return () => window.removeEventListener("keydown", handleBuildKey, true);
  }, [designation.buildMenuOpen]);

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
  if (user && !world.playerEnsured) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-panel)] gap-4">
        <h1 className="text-[var(--amber)] text-2xl font-bold tracking-wider">pWarf</h1>
        <p className="text-[var(--text)] text-sm">Restoring session...</p>
      </div>
    );
  }

  // Pre-world screen: generate button
  if (!world.worldId && !world.creating) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-panel)] gap-4">
        <h1 className="text-[var(--amber)] text-2xl font-bold tracking-wider">pWarf</h1>
        <p className="text-[var(--text)] text-sm">A dwarf fortress adventure awaits.</p>
        {world.createError && (
          <p className="text-red-400 text-xs max-w-md text-center">{world.createError}</p>
        )}
        <button
          onClick={world.handleGenerateWorld}
          className="px-6 py-2 border border-[var(--green)] text-[var(--green)] font-bold text-sm hover:bg-[var(--green)] hover:text-[var(--bg-panel)] cursor-pointer"
        >
          Generate World
        </button>
      </div>
    );
  }

  // Creating world
  if (world.creating) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-panel)] gap-4">
        <h1 className="text-[var(--amber)] text-2xl font-bold tracking-wider">pWarf</h1>
        <p className="text-[var(--text)] text-sm">Creating world...</p>
      </div>
    );
  }

  const terrainForBar = world.mode === "world" ? (cursorTile?.terrain ?? null) : null;
  const cursorKey = `${viewport.cursorX},${viewport.cursorY}`;
  const cursorDesignation = world.mode === "fortress" ? designatedTiles.get(cursorKey) : undefined;
  const fortressTileLabel = world.mode === "fortress" && cursorFortressTile
    ? formatFortressTileLabel(cursorFortressTile.tileType, cursorFortressTile.material, cursorDesignation)
    : null;

  return (
    <div className="flex flex-col h-full w-full">
      <Toolbar
        mode={world.mode}
        onSignOut={signOut}
        onRestart={world.handleRestart}
        population={liveDwarves.length}
        year={1}
        civName={world.mode === "fortress" ? "Stonegear" : undefined}
      />

      <div className="flex flex-1 min-h-0 relative">
        {designation.buildMenuOpen && (
          <BuildMenu
            onSelect={designation.handleBuildSelect}
            onClose={() => designation.setBuildMenuOpen(false)}
          />
        )}
        {designation.prioritiesOpen && (
          <TaskPriorities
            priorities={designation.taskPriorities}
            onChangePriority={designation.handlePriorityChange}
            onClose={() => designation.setBuildMenuOpen(false)}
          />
        )}
        <LeftPanel
          mode={world.mode}
          collapsed={!leftOpen}
          onToggle={() => setLeftOpen((o) => !o)}
          cursorTile={world.mode === "world" ? (selectedTileData ?? cursorTile) : cursorTile}
          onEmbark={world.mode === "world" && selectedWorldTile ? handleEmbark : undefined}
          dwarves={liveDwarves}
          onGoToDwarf={world.mode === "fortress" ? handleGoToDwarf : undefined}
        />

        <MainViewport
          mode={world.mode}
          offsetX={viewport.offsetX}
          offsetY={viewport.offsetY}
          cursorX={viewport.cursorX}
          cursorY={viewport.cursorY}
          onCursorMove={viewport.setCursor}
          onDragStart={viewport.onDragStart}
          onDragMove={viewport.onDragMove}
          onDragEnd={viewport.onDragEnd}
          getWorldTileData={world.mode === "world" ? getTile : undefined}
          getFortressTileData={world.mode === "fortress" ? getFortressTile : undefined}
          onViewportSize={handleViewportSize}
          dwarfPositions={world.mode === "fortress" ? dwarfPositions : undefined}
          designatedTiles={world.mode === "fortress" ? designatedTiles : undefined}
          designationMode={world.mode === "fortress" ? designation.designationMode : undefined}
          onDesignateArea={world.mode === "fortress" ? designation.handleDesignateArea : undefined}
          onCancelArea={world.mode === "fortress" ? designation.handleCancelArea : undefined}
          onTileClick={world.mode === "world" ? (x: number, y: number) => setSelectedWorldTile({ x, y }) : undefined}
          selectedTile={world.mode === "world" ? selectedWorldTile : undefined}
          onDwarfClick={world.mode === "fortress" ? handleDwarfClick : undefined}
        />

        {modalDwarf && (
          <DwarfModal
            dwarf={modalDwarf}
            onClose={() => setModalDwarfId(null)}
            onGoTo={handleGoToDwarf}
          />
        )}

        <RightPanel
          collapsed={!rightOpen}
          onToggle={() => setRightOpen((o) => !o)}
          events={events}
        />
      </div>

      <div className="flex items-center justify-center gap-2 py-0.5 bg-[var(--bg-panel)] border-t border-[var(--border)] text-xs select-none">
        <button
          onClick={() => world.civId && world.setMode("fortress")}
          className={`px-2 py-0.5 cursor-pointer ${world.mode === "fortress" ? "text-[var(--green)]" : "text-[var(--text)] hover:text-[var(--amber)]"} ${!world.civId ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={!world.civId}
        >
          Fortress
        </button>
        <span className="text-[var(--border)]">|</span>
        <button
          onClick={() => world.setMode("world")}
          className={`px-2 py-0.5 cursor-pointer ${world.mode === "world" ? "text-[var(--green)]" : "text-[var(--text)] hover:text-[var(--amber)]"}`}
        >
          World
        </button>
      </div>

      <BottomBar
        mode={world.mode}
        cursorX={viewport.cursorX}
        cursorY={viewport.cursorY}
        terrain={terrainForBar}
        zLevel={world.mode === "fortress" ? zLevel : undefined}
        fortressTileLabel={fortressTileLabel}
        designationMode={world.mode === "fortress" ? designation.designationMode : undefined}
      />
    </div>
  );
}

function formatFortressTileLabel(tileType: string, material: string | null, designation?: string): string {
  const label = tileType.replace(/_/g, " ");
  const base = material ? `${label} (${material})` : label;
  if (designation) {
    const desLabel = designation.replace(/_/g, " ");
    return `${base} [designated: ${desLabel}]`;
  }
  return base;
}
