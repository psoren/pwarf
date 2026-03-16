import { useRef, useEffect, useCallback } from "react";

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
}

// Character cell dimensions (monospace)
const CHAR_W = 10;
const CHAR_H = 18;

// --- Fortress tile palette ---
function fortressTile(wx: number, wy: number): { ch: string; fg: string } {
  // Simple deterministic pattern: walls on borders, floor inside
  const inRoom =
    wx >= 2 && wx <= 12 && wy >= 2 && wy <= 8 &&
    !(wx === 7 && wy === 2); // door gap
  const isWall =
    (wx >= 1 && wx <= 13 && wy === 1) ||
    (wx >= 1 && wx <= 13 && wy === 9) ||
    (wy >= 1 && wy <= 9 && wx === 1) ||
    (wy >= 1 && wy <= 9 && wx === 13);

  if (isWall) return { ch: "#", fg: "#888" };
  if (inRoom) return { ch: ".", fg: "#555" };

  // Ore vein
  if ((wx * 7 + wy * 13) % 47 === 0) return { ch: "$", fg: "#ffbf00" };
  // Stairs
  if (wx === 7 && wy === 5) return { ch: ">", fg: "#4af626" };

  // Rock floor
  return { ch: ".", fg: "#444" };
}

// --- World tile palette ---
function worldTile(wx: number, wy: number): { ch: string; fg: string } {
  const hash = ((wx * 374761393 + wy * 668265263) >>> 0) % 100;
  if (hash < 10) return { ch: "^", fg: "#aaa" };      // mountain
  if (hash < 30) return { ch: "\u2663", fg: "#228B22" }; // forest (club suit)
  if (hash < 40) return { ch: "~", fg: "#4488ff" };    // ocean
  if (hash < 55) return { ch: "\u2591", fg: "#8B7355" }; // plains (light shade)
  if (hash < 65) return { ch: "=", fg: "#cc9944" };    // desert
  if (hash < 75) return { ch: "T", fg: "#2d8b2d" };    // jungle
  if (hash < 85) return { ch: ",", fg: "#6b8e23" };    // grassland
  return { ch: ".", fg: "#556" };                        // barren
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
}: MainViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const getTile = mode === "fortress" ? fortressTile : worldTile;

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
  }, [offsetX, offsetY, cursorX, cursorY, getTile]);

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
