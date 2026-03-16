import { useRef, useEffect, useCallback } from "react";
import type { WorldTile, TerrainType, FortressTileType } from "@pwarf/shared";
import type { FortressViewTile } from "../hooks/useFortressTiles";
import { DWARF_POSITION_MAP } from "./fortressDwarves";

interface MainViewportProps {
  mode: "fortress" | "world";
  offsetX: number;
  offsetY: number;
  cursorX: number;
  cursorY: number;
  zLevel?: number;
  onCursorMove: (x: number, y: number) => void;
  onDragStart: (clientX: number, clientY: number, charW: number, charH: number) => void;
  onDragMove: (clientX: number, clientY: number, charW: number, charH: number) => void;
  onDragEnd: () => void;
  worldTiles?: Map<string, WorldTile>;
  fortressTiles?: Map<string, FortressViewTile>;
  onViewportSize?: (cols: number, rows: number) => void;
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
  zLevel,
  onCursorMove,
  onDragStart,
  onDragMove,
  onDragEnd,
  worldTiles,
  fortressTiles,
  onViewportSize,
}: MainViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const getWorldTile = useCallback(
    (wx: number, wy: number): { ch: string; fg: string } => {
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
    (wx: number, wy: number): { ch: string; fg: string } => {
      // Check for dwarf at this position (only on surface level)
      if (zLevel === 0) {
        const dwarf = DWARF_POSITION_MAP.get(`${wx},${wy}`);
        if (dwarf) return { ch: "\u263A", fg: "#00cccc" };
      }

      if (fortressTiles) {
        const tile = fortressTiles.get(`${wx},${wy}`);
        if (tile) {
          return FORTRESS_GLYPHS[tile.tileType] ?? { ch: "?", fg: "#f00" };
        }
      }
      return { ch: " ", fg: "#000" };
    },
    [fortressTiles, zLevel],
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
        const { ch, fg } = getTile(wx, wy);

        const px = col * CHAR_W;
        const py = row * CHAR_H;

        // Highlight cursor tile
        if (wx === cursorX && wy === cursorY) {
          ctx.fillStyle = "#333";
          ctx.fillRect(px, py, CHAR_W, CHAR_H);
        }

        ctx.fillStyle = fg;
        ctx.fillText(ch, px + 1, py + 2);
      }
    }

    // Draw cursor outline
    const cx = (cursorX - offsetX) * CHAR_W;
    const cy = (cursorY - offsetY) * CHAR_H;
    if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
      ctx.strokeStyle = "#4af626";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + 0.5, cy + 0.5, CHAR_W - 1, CHAR_H - 1);
    }
  }, [offsetX, offsetY, cursorX, cursorY, getTile, onViewportSize]);

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
      onCursorMove(offsetX + col, offsetY + row);

      if (dragging.current) {
        onDragMove(e.clientX, e.clientY, CHAR_W, CHAR_H);
      }
    },
    [offsetX, offsetY, onCursorMove, onDragMove],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        dragging.current = true;
        onDragStart(e.clientX, e.clientY, CHAR_W, CHAR_H);
      }
    },
    [onDragStart],
  );

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    onDragEnd();
  }, [onDragEnd]);

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
