import { useRef, useEffect, useCallback, useState } from "react";
import type { WorldTile } from "@pwarf/shared";
import type { FortressViewTile } from "../hooks/useFortressTiles";
import { TERRAIN_GLYPHS, FORTRESS_GLYPHS, DESIGNATION_PREVIEW, STOCKPILE_GLYPH, GROUND_ITEM_GLYPH } from "./tile-glyphs";

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
  getWorldTileData?: (x: number, y: number) => WorldTile | null;
  getFortressTileData?: (x: number, y: number) => FortressViewTile | null;
  onViewportSize?: (cols: number, rows: number) => void;
  /** Live dwarf positions keyed by "x,y" */
  dwarfPositions?: Map<string, { name: string }>;
  /** Tiles with active designations keyed by "x,y" → task_type */
  designatedTiles?: Map<string, string>;
  /** Current designation mode */
  designationMode?: string;
  /** Area designation handler — called with rectangle bounds */
  onDesignateArea?: (x1: number, y1: number, x2: number, y2: number) => void;
  /** Cancel designation handler — shift+drag to cancel pending tasks in area */
  onCancelArea?: (x1: number, y1: number, x2: number, y2: number) => void;
  /** Click handler for world map tile selection */
  onTileClick?: (x: number, y: number) => void;
  /** Click handler for clicking a dwarf on the map */
  onDwarfClick?: (x: number, y: number) => void;
  /** Selected world tile position */
  selectedTile?: { x: number; y: number } | null;
  /** Stockpile tile positions keyed by "x,y,z" */
  stockpileTiles?: Set<string>;
  /** Ground item positions keyed by "x,y" → count */
  groundItems?: Map<string, number>;
  /** Current z-level for stockpile rendering */
  zLevel?: number;
}

// Character cell dimensions (monospace)
const CHAR_W = 10;
const CHAR_H = 18;

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
  getWorldTileData,
  getFortressTileData,
  onViewportSize,
  dwarfPositions,
  designatedTiles,
  designationMode,
  onDesignateArea,
  onCancelArea,
  onTileClick,
  onDwarfClick,
  selectedTile,
  stockpileTiles,
  groundItems,
  zLevel = 0,
}: MainViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const shiftHeld = useRef(false);

  // Track canvas dimensions to avoid unnecessary resets
  const canvasSizeRef = useRef({ w: 0, h: 0 });

  // Designation drag-select state
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
  const [selEnd, setSelEnd] = useState<{ x: number; y: number } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const isDesignating = designationMode && designationMode !== 'none';

  // Store onViewportSize in a ref so render doesn't depend on it
  const onViewportSizeRef = useRef(onViewportSize);
  onViewportSizeRef.current = onViewportSize;

  // Store tile data getters in refs so render doesn't depend on their identity
  const getWorldTileDataRef = useRef(getWorldTileData);
  getWorldTileDataRef.current = getWorldTileData;
  const getFortressTileDataRef = useRef(getFortressTileData);
  getFortressTileDataRef.current = getFortressTileData;
  const dwarfPositionsRef = useRef(dwarfPositions);
  dwarfPositionsRef.current = dwarfPositions;
  const designatedTilesRef = useRef(designatedTiles);
  designatedTilesRef.current = designatedTiles;
  const stockpileTilesRef = useRef(stockpileTiles);
  stockpileTilesRef.current = stockpileTiles;
  const groundItemsRef = useRef(groundItems);
  groundItemsRef.current = groundItems;
  const zLevelRef = useRef(zLevel);
  zLevelRef.current = zLevel;

  // Increment to force re-render when data (not offset) changes
  const [dataVersion, setDataVersion] = useState(0);
  const prevGetWorldTileData = useRef(getWorldTileData);
  const prevGetFortressTileData = useRef(getFortressTileData);
  const prevDwarfPositions = useRef(dwarfPositions);
  const prevDesignatedTiles = useRef(designatedTiles);
  const prevStockpileTiles = useRef(stockpileTiles);
  const prevGroundItems = useRef(groundItems);

  if (
    getWorldTileData !== prevGetWorldTileData.current ||
    getFortressTileData !== prevGetFortressTileData.current ||
    dwarfPositions !== prevDwarfPositions.current ||
    designatedTiles !== prevDesignatedTiles.current ||
    stockpileTiles !== prevStockpileTiles.current ||
    groundItems !== prevGroundItems.current
  ) {
    prevGetWorldTileData.current = getWorldTileData;
    prevGetFortressTileData.current = getFortressTileData;
    prevDwarfPositions.current = dwarfPositions;
    prevDesignatedTiles.current = designatedTiles;
    prevStockpileTiles.current = stockpileTiles;
    prevGroundItems.current = groundItems;
    setDataVersion((v) => v + 1);
  }

  const getWorldTileGlyph = useCallback(
    (wx: number, wy: number): { ch: string; fg: string; bg?: string } => {
      const fn = getWorldTileDataRef.current;
      if (fn) {
        const tile = fn(wx, wy);
        if (tile) {
          return TERRAIN_GLYPHS[tile.terrain] ?? worldTileFallback(wx, wy);
        }
      }
      return worldTileFallback(wx, wy);
    },
    [],
  );

  const getFortressTileGlyph = useCallback(
    (wx: number, wy: number): { ch: string; fg: string; bg?: string } => {
      const key = `${wx},${wy}`;

      // Check for dwarf at this position
      if (dwarfPositionsRef.current?.has(key)) {
        return { ch: "\u263A", fg: "#00cccc" };
      }

      // Check for ground items at this position
      if (groundItemsRef.current?.has(key) && (groundItemsRef.current.get(key) ?? 0) > 0) {
        return { ch: GROUND_ITEM_GLYPH.ch, fg: GROUND_ITEM_GLYPH.fg };
      }

      // Check for designation overlay
      const taskType = designatedTilesRef.current?.get(key);

      const fn = getFortressTileDataRef.current;
      if (fn) {
        const tile = fn(wx, wy);
        if (tile) {
          const glyph = FORTRESS_GLYPHS[tile.tileType] ?? { ch: "?", fg: "#f00" };
          const isStockpile = stockpileTilesRef.current?.has(`${wx},${wy},${zLevelRef.current}`);
          if (taskType) {
            const preview = DESIGNATION_PREVIEW[taskType];
            if (preview) {
              return { ch: preview.ch, fg: preview.fg, bg: "#442200" };
            }
            return { ...glyph, bg: "#442200" };
          }
          if (isStockpile) {
            return { ...glyph, bg: STOCKPILE_GLYPH.bg };
          }
          return glyph;
        }
      }
      return { ch: " ", fg: "#000" };
    },
    [],
  );

  const getTileGlyph = mode === "fortress" ? getFortressTileGlyph : getWorldTileGlyph;

  // Render the grid
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;

    // Only resize canvas when container dimensions actually change
    const targetW = w * dpr;
    const targetH = h * dpr;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    const cols = Math.ceil(w / CHAR_W);
    const rows = Math.ceil(h / CHAR_H);

    // Report viewport size only on actual change
    if (canvasSizeRef.current.w !== cols || canvasSizeRef.current.h !== rows) {
      canvasSizeRef.current = { w: cols, h: rows };
      onViewportSizeRef.current?.(cols, rows);
    }

    ctx.font = `${CHAR_H - 2}px "IBM Plex Mono", "Fira Code", monospace`;
    ctx.textBaseline = "top";

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const wx = offsetX + col;
        const wy = offsetY + row;
        const tileData = getTileGlyph(wx, wy);

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

    // Draw selection rectangle overlay with blueprint preview
    if (selStart && selEnd) {
      const sx1 = Math.min(selStart.x, selEnd.x);
      const sy1 = Math.min(selStart.y, selEnd.y);
      const sx2 = Math.max(selStart.x, selEnd.x);
      const sy2 = Math.max(selStart.y, selEnd.y);

      const preview = designationMode && !isCancelling ? DESIGNATION_PREVIEW[designationMode] : null;

      for (let sy = sy1; sy <= sy2; sy++) {
        for (let sx = sx1; sx <= sx2; sx++) {
          const px = (sx - offsetX) * CHAR_W;
          const py = (sy - offsetY) * CHAR_H;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            // Background tint
            ctx.fillStyle = isCancelling ? "rgba(255, 0, 0, 0.25)" : "rgba(68, 34, 0, 0.6)";
            ctx.fillRect(px, py, CHAR_W, CHAR_H);

            // Blueprint glyph preview
            if (preview) {
              ctx.fillStyle = preview.fg;
              ctx.fillText(preview.ch, px + 1, py + 2);
            }
          }
        }
      }

      // Draw rectangle border
      const rx = (sx1 - offsetX) * CHAR_W;
      const ry = (sy1 - offsetY) * CHAR_H;
      const rw = (sx2 - sx1 + 1) * CHAR_W;
      const rh = (sy2 - sy1 + 1) * CHAR_H;
      ctx.strokeStyle = isCancelling ? "#ff0000" : "#ff6600";
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
  }, [offsetX, offsetY, cursorX, cursorY, getTileGlyph, isDesignating, selStart, selEnd, selectedTile, dataVersion, isCancelling]);

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

      // Track shift state for cancel mode visual feedback
      if (dragging.current && isDesignating) {
        shiftHeld.current = e.shiftKey;
        setIsCancelling(e.shiftKey);
      }

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
        shiftHeld.current = e.shiftKey;

        if (isDesignating) {
          setIsCancelling(e.shiftKey);
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
      if (dragging.current && isDesignating && selStart && selEnd) {
        const x1 = Math.min(selStart.x, selEnd.x);
        const y1 = Math.min(selStart.y, selEnd.y);
        const x2 = Math.max(selStart.x, selEnd.x);
        const y2 = Math.max(selStart.y, selEnd.y);
        if (shiftHeld.current && onCancelArea) {
          onCancelArea(x1, y1, x2, y2);
        } else if (onDesignateArea) {
          onDesignateArea(x1, y1, x2, y2);
        }
      }
      // Fire tile click if user clicked without dragging
      if (dragging.current && !dragMoved.current && !isDesignating) {
        // Check for dwarf click in fortress mode
        const cursorKey = `${cursorX},${cursorY}`;
        if (onDwarfClick && dwarfPositions?.has(cursorKey)) {
          onDwarfClick(cursorX, cursorY);
        } else if (onTileClick) {
          onTileClick(cursorX, cursorY);
        }
      }
      dragging.current = false;
      dragMoved.current = false;
      shiftHeld.current = false;
      setSelStart(null);
      setSelEnd(null);
      setIsCancelling(false);
      if (!isDesignating) {
        onDragEnd();
      }
    },
    [onDragEnd, onDesignateArea, onCancelArea, onTileClick, onDwarfClick, dwarfPositions, isDesignating, selStart, selEnd, cursorX, cursorY],
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
