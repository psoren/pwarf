import { useRef, useEffect, useCallback, useState } from "react";
import type { WorldTile, TerrainType, FortressTileType } from "@pwarf/shared";
import type { FortressViewTile } from "../hooks/useFortressTiles";

interface MainViewportProps {
  mode: "fortress" | "world";
  offsetX: number;
  offsetY: number;
  cursorX: number;
  cursorY: number;
  onCursorMove: (x: number, y: number) => void;
  onDragStart: (clientX: number, clientY: number, charW: number, charH: number) => void;
  onDragMove: (clientX: number, clientY: number, charW: number, charH: number) => void;
  onDragEnd: () => void;
  worldTiles?: Map<string, WorldTile>;
  fortressTiles?: Map<string, FortressViewTile>;
  onViewportSize?: (cols: number, rows: number) => void;
  /** Live dwarf positions keyed by "x,y" */
  dwarfPositions?: Map<string, { name: string }>;
  /** Tiles with active designations keyed by "x,y" → task_type */
  designatedTiles?: Map<string, string>;
  /** Current designation mode */
  designationMode?: string;
  /** Area designation handler — called with rectangle bounds */
  onDesignateArea?: (x1: number, y1: number, x2: number, y2: number) => void;
  /** Click handler for world map tile selection */
  onTileClick?: (x: number, y: number) => void;
  /** Selected world tile position */
  selectedTile?: { x: number; y: number } | null;
}

// Character cell dimensions (monospace)
const CHAR_W = 10;
const CHAR_H = 18;

// --- Fortress tile glyph map ---
const FORTRESS_GLYPHS: Record<FortressTileType, { ch: string; fg: string }> = {
  open_air:           { ch: ".",  fg: "#446" },
  soil:               { ch: "\u2592", fg: "#8B6914" },
  stone:              { ch: "\u2593", fg: "#888" },
  ore:                { ch: "$",  fg: "#ffbf00" },
  gem:                { ch: "\u2666", fg: "#ff44ff" },
  water:              { ch: "~",  fg: "#4488ff" },
  magma:              { ch: "~",  fg: "#ff4400" },
  lava_stone:         { ch: "\u2593", fg: "#993300" },
  cavern_floor:       { ch: ".",  fg: "#556655" },
  cavern_wall:        { ch: "\u2593", fg: "#666" },
  constructed_wall:   { ch: "#",  fg: "#aaa" },
  constructed_floor:  { ch: "+",  fg: "#888" },
  stair_up:           { ch: "<",  fg: "#4af626" },
  stair_down:         { ch: ">",  fg: "#4af626" },
  stair_both:         { ch: "X",  fg: "#4af626" },
  empty:              { ch: " ",  fg: "#000" },
};

// --- Designation preview glyphs (shown on designated tiles before construction) ---
const DESIGNATION_PREVIEW: Record<string, { ch: string; fg: string }> = {
  mine:              { ch: "X", fg: "#cc6600" },
  build_wall:        { ch: "#", fg: "#cc8844" },
  build_floor:       { ch: "+", fg: "#cc8844" },
  build_stairs_up:   { ch: "<", fg: "#cc8844" },
  build_stairs_down: { ch: ">", fg: "#cc8844" },
  build_stairs_both: { ch: "X", fg: "#cc8844" },
};

// --- World tile palette (terrain -> glyph + color) ---
const TERRAIN_GLYPHS: Record<TerrainType, { ch: string; fg: string }> = {
  mountain:    { ch: "^",  fg: "#aaa" },
  forest:      { ch: "\u2663", fg: "#228B22" },
  plains:      { ch: "\u2591", fg: "#8B7355" },
  desert:      { ch: "\u2261", fg: "#cc9944" },
  tundra:      { ch: "*",  fg: "#ddeeff" },
  swamp:       { ch: "\u2248", fg: "#668866" },
  ocean:       { ch: "~",  fg: "#4488ff" },
  volcano:     { ch: "\u25B2", fg: "#ff4400" },
  underground: { ch: ".",  fg: "#886688" },
  haunted:     { ch: "!",  fg: "#9944cc" },
  savage:      { ch: "!",  fg: "#ff4444" },
  evil:        { ch: "!",  fg: "#990066" },
};

// --- Fallback hash-based world tile ---
function worldTileFallback(wx: number, wy: number): { ch: string; fg: string } {
  const hash = ((wx * 374761393 + wy * 668265263) >>> 0) % 100;
  if (hash < 10) return { ch: "^", fg: "#aaa" };
  if (hash < 30) return { ch: "\u2663", fg: "#228B22" };
  if (hash < 40) return { ch: "~", fg: "#4488ff" };
  if (hash < 55) return { ch: "\u2591", fg: "#8B7355" };
  if (hash < 65) return { ch: "=", fg: "#cc9944" };
  if (hash < 75) return { ch: "T", fg: "#2d8b2d" };
  if (hash < 85) return { ch: ",", fg: "#6b8e23" };
  return { ch: ".", fg: "#556" };
}

export default function MainViewport({
  mode,
  offsetX,
  offsetY,
  cursorX,
  cursorY,
  onCursorMove,
  onDragStart,
  onDragMove,
  onDragEnd,
  worldTiles,
  fortressTiles,
  onViewportSize,
  dwarfPositions,
  designatedTiles,
  designationMode,
  onDesignateArea,
  onTileClick,
  selectedTile,
}: MainViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragMoved = useRef(false);

  // Designation drag-select state
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
  const [selEnd, setSelEnd] = useState<{ x: number; y: number } | null>(null);
  const isDesignating = designationMode && designationMode !== 'none';

  const getWorldTile = useCallback(
    (wx: number, wy: number): { ch: string; fg: string; bg?: string } => {
      if (worldTiles) {
        const tile = worldTiles.get(`${wx},${wy}`);
        if (tile) {
          return TERRAIN_GLYPHS[tile.terrain] ?? worldTileFallback(wx, wy);
        }
      }
      return worldTileFallback(wx, wy);
    },
    [worldTiles],
  );

  const getFortressTile = useCallback(
    (wx: number, wy: number): { ch: string; fg: string; bg?: string } => {
      const key = `${wx},${wy}`;

      // Check for dwarf at this position
      if (dwarfPositions?.has(key)) {
        return { ch: "\u263A", fg: "#00cccc" };
      }

      // Check for designation overlay
      const taskType = designatedTiles?.get(key);

      if (fortressTiles) {
        const tile = fortressTiles.get(key);
        if (tile) {
          const glyph = FORTRESS_GLYPHS[tile.tileType] ?? { ch: "?", fg: "#f00" };
          if (taskType) {
            // Show a preview glyph of what will be built
            const preview = DESIGNATION_PREVIEW[taskType];
            if (preview) {
              return { ch: preview.ch, fg: preview.fg, bg: "#442200" };
            }
            return { ...glyph, bg: "#442200" };
          }
          return glyph;
        }
      }
      return { ch: " ", fg: "#000" };
    },
    [fortressTiles, dwarfPositions, designatedTiles],
  );

  const getTile = mode === "fortress" ? getFortressTile : getWorldTile;

  // Render the grid
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    const cols = Math.ceil(w / CHAR_W);
    const rows = Math.ceil(h / CHAR_H);

    // Report viewport size for tile fetching
    onViewportSize?.(cols, rows);

    ctx.font = `${CHAR_H - 2}px "IBM Plex Mono", "Fira Code", monospace`;
    ctx.textBaseline = "top";

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const wx = offsetX + col;
        const wy = offsetY + row;
        const tileData = getTile(wx, wy);

        const px = col * CHAR_W;
        const py = row * CHAR_H;

        // Background for designation overlay
        if (tileData.bg) {
          ctx.fillStyle = tileData.bg;
          ctx.fillRect(px, py, CHAR_W, CHAR_H);
        }

        // Highlight selected world tile
        if (selectedTile && wx === selectedTile.x && wy === selectedTile.y) {
          ctx.fillStyle = "rgba(74, 246, 38, 0.25)";
          ctx.fillRect(px, py, CHAR_W, CHAR_H);
        }

        // Highlight cursor tile
        if (wx === cursorX && wy === cursorY) {
          ctx.fillStyle = designationMode && designationMode !== 'none' ? "#442244" : "#333";
          ctx.fillRect(px, py, CHAR_W, CHAR_H);
        }

        ctx.fillStyle = tileData.fg;
        ctx.fillText(tileData.ch, px + 1, py + 2);
      }
    }

    // Draw selection rectangle overlay
    if (selStart && selEnd) {
      const sx1 = Math.min(selStart.x, selEnd.x);
      const sy1 = Math.min(selStart.y, selEnd.y);
      const sx2 = Math.max(selStart.x, selEnd.x);
      const sy2 = Math.max(selStart.y, selEnd.y);

      ctx.fillStyle = "rgba(255, 102, 0, 0.25)";
      for (let sy = sy1; sy <= sy2; sy++) {
        for (let sx = sx1; sx <= sx2; sx++) {
          const px = (sx - offsetX) * CHAR_W;
          const py = (sy - offsetY) * CHAR_H;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            ctx.fillRect(px, py, CHAR_W, CHAR_H);
          }
        }
      }

      // Draw rectangle border
      const rx = (sx1 - offsetX) * CHAR_W;
      const ry = (sy1 - offsetY) * CHAR_H;
      const rw = (sx2 - sx1 + 1) * CHAR_W;
      const rh = (sy2 - sy1 + 1) * CHAR_H;
      ctx.strokeStyle = "#ff6600";
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
    }

    // Draw cursor outline
    const cx = (cursorX - offsetX) * CHAR_W;
    const cy = (cursorY - offsetY) * CHAR_H;
    if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
      ctx.strokeStyle = isDesignating ? "#ff6600" : "#4af626";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + 0.5, cy + 0.5, CHAR_W - 1, CHAR_H - 1);
    }
  }, [offsetX, offsetY, cursorX, cursorY, getTile, onViewportSize, isDesignating, selStart, selEnd, selectedTile]);

  // Re-render on state change
  useEffect(() => {
    render();
  }, [render]);

  // Re-render on resize
  useEffect(() => {
    const obs = new ResizeObserver(() => render());
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [render]);

  // Mouse handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const col = Math.floor((e.clientX - rect.left) / CHAR_W);
      const row = Math.floor((e.clientY - rect.top) / CHAR_H);
      const wx = offsetX + col;
      const wy = offsetY + row;
      onCursorMove(wx, wy);

      if (dragging.current) {
        dragMoved.current = true;
        if (isDesignating) {
          // Update selection end point
          setSelEnd({ x: wx, y: wy });
        } else {
          onDragMove(e.clientX, e.clientY, CHAR_W, CHAR_H);
        }
      }
    },
    [offsetX, offsetY, onCursorMove, onDragMove, isDesignating],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        dragging.current = true;
        dragMoved.current = false;

        if (isDesignating) {
          // Start designation selection
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const col = Math.floor((e.clientX - rect.left) / CHAR_W);
          const row = Math.floor((e.clientY - rect.top) / CHAR_H);
          const wx = offsetX + col;
          const wy = offsetY + row;
          setSelStart({ x: wx, y: wy });
          setSelEnd({ x: wx, y: wy });
        } else {
          onDragStart(e.clientX, e.clientY, CHAR_W, CHAR_H);
        }
      }
    },
    [onDragStart, isDesignating, offsetX, offsetY],
  );

  const handleMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      if (dragging.current && isDesignating && selStart && selEnd && onDesignateArea) {
        const x1 = Math.min(selStart.x, selEnd.x);
        const y1 = Math.min(selStart.y, selEnd.y);
        const x2 = Math.max(selStart.x, selEnd.x);
        const y2 = Math.max(selStart.y, selEnd.y);
        onDesignateArea(x1, y1, x2, y2);
      }
      // Fire tile click if user clicked without dragging (world map selection)
      if (dragging.current && !dragMoved.current && !isDesignating && onTileClick) {
        onTileClick(cursorX, cursorY);
      }
      dragging.current = false;
      dragMoved.current = false;
      setSelStart(null);
      setSelEnd(null);
      if (!isDesignating) {
        onDragEnd();
      }
    },
    [onDragEnd, onDesignateArea, onTileClick, isDesignating, selStart, selEnd, cursorX, cursorY],
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 min-w-0 min-h-0 cursor-crosshair select-none"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
