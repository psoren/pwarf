import { useState, useCallback, useRef } from "react";

export interface ViewportState {
  /** Top-left tile X coordinate */
  offsetX: number;
  /** Top-left tile Y coordinate */
  offsetY: number;
  /** Cursor tile position (relative to world) */
  cursorX: number;
  cursorY: number;
}

export function useViewport() {
  const [state, setState] = useState<ViewportState>({
    offsetX: 0,
    offsetY: 0,
    cursorX: 0,
    cursorY: 0,
  });

  const dragRef = useRef<{ startX: number; startY: number; origOffsetX: number; origOffsetY: number } | null>(null);

  /** Move viewport by delta tiles (integers only — grid-snapped) */
  const pan = useCallback((dx: number, dy: number) => {
    setState((prev) => ({
      ...prev,
      offsetX: prev.offsetX + dx,
      offsetY: prev.offsetY + dy,
    }));
  }, []);

  /** Set cursor position in world tile coords */
  const setCursor = useCallback((x: number, y: number) => {
    setState((prev) => ({ ...prev, cursorX: x, cursorY: y }));
  }, []);

  /** Mouse drag handlers — snapped to whole tile offsets */
  const onDragStart = useCallback(
    (clientX: number, clientY: number, charW: number, charH: number) => {
      dragRef.current = {
        startX: clientX,
        startY: clientY,
        origOffsetX: state.offsetX,
        origOffsetY: state.offsetY,
      };
      // We read state at drag-start so the drag is relative to the
      // position when the user first pressed the mouse button.
      // The caller should store charW/charH and forward onDragMove.
    },
    [state.offsetX, state.offsetY],
  );

  const onDragMove = useCallback(
    (clientX: number, clientY: number, charW: number, charH: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = Math.round((drag.startX - clientX) / charW);
      const dy = Math.round((drag.startY - clientY) / charH);
      setState((prev) => ({
        ...prev,
        offsetX: drag.origOffsetX + dx,
        offsetY: drag.origOffsetY + dy,
      }));
    },
    [],
  );

  const onDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  return { ...state, pan, setCursor, onDragStart, onDragMove, onDragEnd };
}
