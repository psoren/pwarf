import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabase";
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
import { useStockpileTiles } from "./hooks/useStockpileTiles";
import { usePublishedRuins } from "./hooks/usePublishedRuins";
import BuildMenu, { BUILD_OPTIONS } from "./components/BuildMenu";
import TaskPriorities from "./components/TaskPriorities";
import { DwarfModal } from "./components/DwarfModal";
import { InventoryModal } from "./components/InventoryModal";
import { CaveScoutModal } from "./components/CaveScoutModal";
import { EpitaphScreen } from "./components/EpitaphScreen";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { useTutorial } from "./hooks/useTutorial";
import { useSoundtrack } from "./hooks/useSoundtrack";
import { SURFACE_Z, CAVE_OFFSET, CAVE_SIZE, BUILDING_COSTS, WORK_SCOUT_CAVE } from "@pwarf/shared";
import type { Item } from "@pwarf/shared";
import type { LiveDwarf } from "./hooks/useDwarves";

export default function App() {
  const { session, user, loading, signIn, signUp, signInAsGuest, signOut } = useAuth();

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

  // Sim runner — provides live in-memory state
  const { snapshot, isPaused, togglePause, speed, setSpeed } = useSimRunner(world.civId, world.worldId);

  const getFortressTileResult = useFortressTiles({
    civId: world.civId,
    worldSeed: world.worldSeed,
    terrain: world.embarkTerrain,
    offsetX: viewport.offsetX,
    offsetY: viewport.offsetY,
    zLevel,
    viewportCols: vpCols,
    viewportRows: vpRows,
    snapshotTileOverrides: snapshot?.fortressTileOverrides,
  });
  const getFortressTile = getFortressTileResult.getTile;

  const cursorTile = world.worldId ? getTile(viewport.cursorX, viewport.cursorY) : null;
  const selectedTileData = world.worldId && selectedWorldTile
    ? getTile(selectedWorldTile.x, selectedWorldTile.y)
    : null;
  const cursorFortressTile = world.civId ? getFortressTile(viewport.cursorX, viewport.cursorY) : null;

  // Active tasks — prefer live snapshot, fall back to DB polling
  const polledTasks = useTasks(world.civId);
  const { addOptimistic } = polledTasks;
  const liveTasks = snapshot?.tasks ?? polledTasks.tasks;
  const designatedTiles = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of liveTasks) {
      const tx = 'target_x' in t ? t.target_x : null;
      const ty = 'target_y' in t ? t.target_y : null;
      const tz = 'target_z' in t ? t.target_z : null;
      if (tx !== null && ty !== null && tz === zLevel && !AUTONOMOUS_TASK_TYPES.has(t.task_type) && ['pending', 'claimed', 'in_progress'].includes(t.status)) {
        map.set(`${tx},${ty}`, t.task_type);
      }
    }
    return map;
  }, [liveTasks, zLevel]);

  // Build progress for in_progress tasks keyed by "x,y"
  const buildProgressTiles = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of liveTasks) {
      if (t.status !== 'in_progress' || AUTONOMOUS_TASK_TYPES.has(t.task_type)) continue;
      const tx = 'target_x' in t ? t.target_x : null;
      const ty = 'target_y' in t ? t.target_y : null;
      const tz = 'target_z' in t ? t.target_z : null;
      if (tx !== null && ty !== null && tz === zLevel && t.work_required > 0) {
        map.set(`${tx},${ty}`, Math.round((t.work_progress / t.work_required) * 100));
      }
    }
    return map;
  }, [liveTasks, zLevel]);

  // Count available raw materials in the civilization's stockpiles
  const materialCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!world.civId) return counts;
    for (const item of (snapshot?.items ?? [])) {
      if (item.category === 'raw_material' && item.material && item.located_in_civ_id === world.civId && item.held_by_dwarf_id === null) {
        counts.set(item.material, (counts.get(item.material) ?? 0) + 1);
      }
    }
    return counts;
  }, [snapshot?.items, world.civId]);

  // Compute which build tasks are blocked due to missing resources
  const blockedBuildTiles = useMemo(() => {
    const set = new Set<string>();
    if (!world.civId) return set;

    // Count how many resources are already reserved by earlier (non-blocked) build tasks
    const reservedCounts = new Map<string, number>();

    for (const t of liveTasks) {
      const tx = 'target_x' in t ? t.target_x : null;
      const ty = 'target_y' in t ? t.target_y : null;
      const tz = 'target_z' in t ? t.target_z : null;
      if (tx === null || ty === null || tz !== zLevel) continue;
      if (!['pending', 'claimed', 'in_progress'].includes(t.status)) continue;

      const costs = BUILDING_COSTS[t.task_type];
      if (!costs) continue;

      let blocked = false;
      for (const cost of costs) {
        const available = (materialCounts.get(cost.material) ?? 0) - (reservedCounts.get(cost.material) ?? 0);
        if (available < cost.count) {
          blocked = true;
          break;
        }
      }

      if (blocked) {
        set.add(`${tx},${ty}`);
      } else {
        // Reserve resources for this task
        for (const cost of costs) {
          reservedCounts.set(cost.material, (reservedCounts.get(cost.material) ?? 0) + cost.count);
        }
      }
    }

    return set;
  }, [liveTasks, materialCounts, world.civId, zLevel]);

  const designation = useDesignation({
    civId: world.civId,
    zLevel,
    getFortressTile,
    designatedTiles,
    addOptimistic,
  });

  // Merge optimistic designations into the map for immediate feedback
  const mergedDesignatedTiles = useMemo(() => {
    if (designation.optimisticTiles.size === 0) return designatedTiles;
    const merged = new Map(designatedTiles);
    for (const [key, val] of designation.optimisticTiles) {
      merged.set(key, val);
    }
    return merged;
  }, [designatedTiles, designation.optimisticTiles]);

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
          age: d.age ?? null,
          gender: d.gender ?? null,
          is_in_tantrum: d.is_in_tantrum,
          position_x: d.position_x,
          position_y: d.position_y,
          position_z: d.position_z,
          current_task_id: d.current_task_id,
          need_food: d.need_food,
          need_drink: d.need_drink,
          need_sleep: d.need_sleep,
          need_social: d.need_social,
          need_purpose: d.need_purpose,
          need_beauty: d.need_beauty,
          stress_level: d.stress_level,
          health: d.health,
          memories: d.memories as LiveDwarf['memories'],
          trait_openness: d.trait_openness ?? null,
          trait_conscientiousness: d.trait_conscientiousness ?? null,
          trait_extraversion: d.trait_extraversion ?? null,
          trait_agreeableness: d.trait_agreeableness ?? null,
          trait_neuroticism: d.trait_neuroticism ?? null,
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

  // Monster positions for rendering
  const monsterPositions = useMemo(() => {
    const monsters = snapshot?.monsters ?? [];
    const map = new Map<string, { name: string; health: number }>();
    for (const m of monsters) {
      if (m.status === 'active' && m.current_tile_x !== null && m.current_tile_y !== null) {
        map.set(`${m.current_tile_x},${m.current_tile_y}`, { name: m.name, health: m.health });
      }
    }
    return map;
  }, [snapshot]);

  // Stockpile tiles
  const stockpileTiles = useStockpileTiles(world.civId);

  // Live items from snapshot
  const liveItems: Item[] = useMemo(() => snapshot?.items ?? [], [snapshot]);

  // Civilization wealth — sum of value for items located in this civ
  const civWealth = useMemo(() =>
    liveItems
      .filter(i => i.located_in_civ_id === world.civId)
      .reduce((sum, i) => sum + i.value, 0),
    [liveItems, world.civId],
  );

  // Ground items map for rendering (items not held by a dwarf at current z-level)
  const groundItems = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of liveItems) {
      if (item.held_by_dwarf_id === null && item.position_x !== null && item.position_y !== null && item.position_z === zLevel) {
        const key = `${item.position_x},${item.position_y}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [liveItems, zLevel]);

  // Selected fortress tile (for stockpile inspection)
  const [selectedFortressTile, setSelectedFortressTile] = useState<{ x: number; y: number } | null>(null);

  // Live activity log — prefer snapshot, fall back to DB polling
  const polledEvents = useEvents(world.civId);
  const publishedRuins = usePublishedRuins();
  const events = useMemo(() => {
    if (snapshot && snapshot.events.length > 0) {
      return snapshot.events
        .slice(-50)
        .reverse()
        .map((e) => ({
          id: e.id,
          description: e.description,
          category: e.category,
          year: e.year,
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
            setFollowedDwarfId(null);
          }
          break;
        case "toggle_left_panel":
          setLeftOpen((o) => !o);
          break;
        case "toggle_right_panel":
          setRightOpen((o) => !o);
          break;
        case "z_up":
          // Return to surface from a cave
          if (zLevel < 0) {
            const deriver = getFortressTileResult.deriver;
            const entrance = deriver?.getEntranceForZ(zLevel);
            setZLevel(SURFACE_Z);
            if (entrance) {
              viewport.setOffset(
                entrance.x - Math.floor(vpCols / 2),
                entrance.y - Math.floor(vpRows / 2),
              );
            }
          }
          break;
        case "z_down":
          // Disabled — use cave entrances instead
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
        case "designate_stockpile":
          if (world.mode === "fortress") designation.toggleStockpile();
          break;
        case "designate_deconstruct":
          if (world.mode === "fortress") designation.toggleDeconstruct();
          break;
        case "designate_farm":
          if (world.mode === "fortress") designation.toggleFarm();
          break;
        case "cancel_designation":
          designation.cancelDesignation();
          setFollowedDwarfId(null);
          break;
        case "toggle_pause":
          if (world.mode === "fortress" && world.civId) togglePause();
          break;
        case "set_speed":
          if (world.mode === "fortress" && world.civId) setSpeed(action.multiplier);
          break;
      }
    },
    [viewport.pan, world.civId, world.mode, designation, togglePause, setSpeed],
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

  const tutorial = useTutorial();

  // Ambient soundtrack — starts when fortress is active, pauses with game
  const gameActive = world.mode === "fortress" && !!world.civId;
  const { muted: soundMuted, toggleMute } = useSoundtrack(gameActive, isPaused);

  // Follow mode — camera tracks a selected dwarf every tick
  const [followedDwarfId, setFollowedDwarfId] = useState<string | null>(null);

  // Center viewport on followed dwarf whenever positions update
  useEffect(() => {
    if (!followedDwarfId) return;
    const dwarf = liveDwarves.find(d => d.id === followedDwarfId);
    if (!dwarf) {
      setFollowedDwarfId(null);
      return;
    }
    setZLevel(dwarf.position_z);
    viewport.setOffset(
      dwarf.position_x - Math.floor(vpCols / 2),
      dwarf.position_y - Math.floor(vpRows / 2),
    );
  }, [followedDwarfId, liveDwarves, vpCols, vpRows, viewport.setOffset]);

  const handleGoToDwarf = useCallback((dwarf: LiveDwarf) => {
    setFollowedDwarfId(dwarf.id);
  }, []);

  // Cave scout modal state
  const [caveScoutModal, setCaveScoutModal] = useState<{
    caveName: string;
    alreadyScouting: boolean;
    entranceX: number;
    entranceY: number;
  } | null>(null);

  const handleConfirmScout = useCallback(async () => {
    if (!caveScoutModal || caveScoutModal.alreadyScouting || !world.civId) return;
    const { error } = await supabase.from('tasks').insert({
      civilization_id: world.civId,
      task_type: 'scout_cave',
      status: 'pending',
      priority: 5,
      target_x: caveScoutModal.entranceX,
      target_y: caveScoutModal.entranceY,
      target_z: 0,
      work_required: WORK_SCOUT_CAVE,
    });
    if (error) console.error('[scout] failed to create task:', error.message);
    setCaveScoutModal(null);
  }, [caveScoutModal, world.civId]);

  // Handle clicking a cave entrance tile — scout or enter
  const handleFortressTileClick = useCallback((x: number, y: number) => {
    setSelectedFortressTile({ x, y });
    setFollowedDwarfId(null);

    // Only check cave entrances on the surface
    if (zLevel !== SURFACE_Z) return;

    const tile = getFortressTile(x, y);
    if (tile?.tileType !== 'cave_entrance') return;

    const deriver = getFortressTileResult.deriver;
    if (!deriver) return;

    const caveZ = deriver.getZForEntrance(x, y);
    if (caveZ === null) return;

    // Check if the cave is discovered — any fortress tile override at that z-level
    const snapshotOverrides = snapshot?.fortressTileOverrides ?? [];
    const discovered = snapshotOverrides.some(t => t.z === caveZ);

    if (discovered) {
      // Enter the cave — switch z-level and center viewport on the cave
      setZLevel(caveZ);
      const center = CAVE_OFFSET + Math.floor(CAVE_SIZE / 2);
      viewport.setOffset(
        center - Math.floor(vpCols / 2),
        center - Math.floor(vpRows / 2),
      );
    } else {
      // Show confirmation modal instead of directly creating the task
      const caveName = deriver.getCaveName(caveZ) ?? "Unknown Cave";
      const alreadyScouting = liveTasks.some(
        t => t.task_type === 'scout_cave'
          && t.target_x === x
          && t.target_y === y
          && ['pending', 'claimed', 'in_progress'].includes(t.status),
      );
      setCaveScoutModal({ caveName, alreadyScouting, entranceX: x, entranceY: y });
    }
  }, [zLevel, getFortressTile, getFortressTileResult.deriver, snapshot?.fortressTileOverrides, liveTasks, viewport, vpCols, vpRows]);

  // Dwarf info modal
  const [modalDwarfId, setModalDwarfId] = useState<string | null>(null);
  const modalDwarf = modalDwarfId ? liveDwarves.find(d => d.id === modalDwarfId) ?? null : null;

  // Inventory modal
  const [inventoryOpen, setInventoryOpen] = useState(false);

  const handleDwarfClick = useCallback((x: number, y: number) => {
    const dwarf = liveDwarves.find(d => d.position_x === x && d.position_y === y && d.position_z === zLevel);
    if (dwarf) {
      setModalDwarfId(dwarf.id);
      setFollowedDwarfId(dwarf.id);
    }
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
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} onPlayAsGuest={signInAsGuest} />;
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
  const cursorDesignation = world.mode === "fortress" ? mergedDesignatedTiles.get(cursorKey) : undefined;
  const cursorBuildProgress = world.mode === "fortress" ? buildProgressTiles.get(cursorKey) : undefined;
  const fortressTileLabel = world.mode === "fortress" && cursorFortressTile
    ? formatFortressTileLabel(cursorFortressTile.tileType, cursorFortressTile.material, cursorDesignation, cursorBuildProgress)
    : null;

  return (
    <div className="flex flex-col h-full w-full">
      <Toolbar
        mode={world.mode}
        onSignOut={signOut}
        onRestart={world.handleRestart}
        onTogglePause={world.civId ? togglePause : undefined}
        isPaused={isPaused}
        speed={speed}
        onSetSpeed={world.civId ? setSpeed : undefined}
        population={liveDwarves.length}
        year={snapshot?.year ?? 1}
        civName={world.mode === "fortress" ? (world.civName ?? undefined) : undefined}
        items={liveItems}
        wealth={civWealth}
        dwarves={liveDwarves}
        onTutorial={tutorial.start}
        onInventory={world.civId ? () => setInventoryOpen(true) : undefined}
        soundMuted={soundMuted}
        onToggleMute={toggleMute}
      />

      {tutorial.active && (
        <TutorialOverlay
          stepIndex={tutorial.stepIndex}
          isFirst={tutorial.isFirst}
          isLast={tutorial.isLast}
          onNext={tutorial.next}
          onPrev={tutorial.prev}
          onDismiss={tutorial.dismiss}
        />
      )}

      <div className="flex flex-1 min-h-0 relative">
        {snapshot?.civFallen && world.mode === "fortress" && (
          <EpitaphScreen
            year={snapshot.year}
            events={events.map(e => ({ text: e.description, category: e.category }))}
            civId={world.civId}
            onRestart={world.handleRestart}
          />
        )}
        {designation.buildMenuOpen && (
          <BuildMenu
            onSelect={designation.handleBuildSelect}
            onClose={() => designation.setBuildMenuOpen(false)}
            inventory={materialCounts}
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
          onDwarfClick={world.mode === "fortress" ? (id: string) => { setModalDwarfId(id); setFollowedDwarfId(id); } : undefined}
          items={liveItems}
          tasks={world.mode === "fortress" ? liveTasks : undefined}
          selectedFortressTile={world.mode === "fortress" ? selectedFortressTile : undefined}
          stockpileTiles={world.mode === "fortress" ? stockpileTiles : undefined}
          zLevel={zLevel}
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
          designatedTiles={world.mode === "fortress" ? mergedDesignatedTiles : undefined}
          designationMode={world.mode === "fortress" ? designation.designationMode : undefined}
          onDesignateArea={world.mode === "fortress" ? designation.handleDesignateArea : undefined}
          onCancelArea={world.mode === "fortress" ? designation.handleCancelArea : undefined}
          onTileClick={world.mode === "world"
            ? (x: number, y: number) => setSelectedWorldTile({ x, y })
            : world.mode === "fortress"
              ? handleFortressTileClick
              : undefined}
          onDwarfClick={world.mode === "fortress" ? handleDwarfClick : undefined}
          selectedTile={world.mode === "world" ? selectedWorldTile : undefined}
          stockpileTiles={world.mode === "fortress" ? stockpileTiles : undefined}
          groundItems={world.mode === "fortress" ? groundItems : undefined}
          zLevel={zLevel}
          buildProgressTiles={world.mode === "fortress" ? buildProgressTiles : undefined}
          monsterPositions={world.mode === "fortress" ? monsterPositions : undefined}
          blockedBuildTiles={world.mode === "fortress" ? blockedBuildTiles : undefined}
        />

        {modalDwarf && (
          <DwarfModal
            dwarf={modalDwarf}
            onClose={() => setModalDwarfId(null)}
            onGoTo={handleGoToDwarf}
            items={liveItems}
            tasks={liveTasks}
          />
        )}

        {caveScoutModal && (
          <CaveScoutModal
            caveName={caveScoutModal.caveName}
            alreadyScouting={caveScoutModal.alreadyScouting}
            onScout={handleConfirmScout}
            onClose={() => setCaveScoutModal(null)}
          />
        )}

        {inventoryOpen && (
          <InventoryModal
            items={liveItems}
            dwarves={liveDwarves}
            onClose={() => setInventoryOpen(false)}
          />
        )}

        <RightPanel
          collapsed={!rightOpen}
          onToggle={() => setRightOpen((o) => !o)}
          events={events}
          mode={world.mode}
          publishedRuins={publishedRuins}
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
          onClick={() => { world.setMode("world"); setFollowedDwarfId(null); }}
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
        caveName={zLevel < 0 ? getFortressTileResult.deriver?.getCaveName(zLevel) ?? undefined : undefined}
      />
    </div>
  );
}

const AUTONOMOUS_TASK_TYPES: ReadonlySet<string> = new Set(['eat', 'drink', 'sleep', 'wander']);

function formatFortressTileLabel(tileType: string, material: string | null, designation?: string, buildProgress?: number): string {
  const label = tileType.replace(/_/g, " ");
  const base = material ? `${label} (${material})` : label;
  // Don't show designation suffix if tile is already in a built state —
  // task list may lag behind tile update (race condition between polls).
  const tileIsBuilt = tileType === 'constructed_wall' || tileType === 'constructed_floor';
  if (designation && !tileIsBuilt) {
    const desLabel = designation.replace(/_/g, " ");
    if (buildProgress !== undefined) {
      return `${base} [building: ${desLabel} ${buildProgress}%]`;
    }
    return `${base} [designated: ${desLabel}]`;
  }
  return base;
}
