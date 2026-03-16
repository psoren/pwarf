import { useState, useCallback } from "react";
import Toolbar from "./components/Toolbar";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import MainViewport from "./components/MainViewport";
import BottomBar from "./components/BottomBar";
import { useKeyboard, type KeyAction } from "./hooks/useKeyboard";
import { useViewport } from "./hooks/useViewport";

type Mode = "fortress" | "world";

export default function App() {
  const [mode, setMode] = useState<Mode>("fortress");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const viewport = useViewport();

  const handleKeyAction = useCallback(
    (action: KeyAction) => {
      switch (action.type) {
        case "pan":
          viewport.pan(action.dx, action.dy);
          break;
        case "toggle_mode":
          setMode((m) => (m === "fortress" ? "world" : "fortress"));
          break;
        case "toggle_left_panel":
          setLeftOpen((o) => !o);
          break;
        case "toggle_right_panel":
          setRightOpen((o) => !o);
          break;
      }
    },
    [viewport.pan],
  );

  useKeyboard(handleKeyAction);

  return (
    <div className="flex flex-col h-full w-full">
      <Toolbar mode={mode} />

      <div className="flex flex-1 min-h-0">
        <LeftPanel
          mode={mode}
          collapsed={!leftOpen}
          onToggle={() => setLeftOpen((o) => !o)}
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
        />

        <RightPanel
          collapsed={!rightOpen}
          onToggle={() => setRightOpen((o) => !o)}
        />
      </div>

      <div className="flex items-center justify-center gap-2 py-0.5 bg-[var(--bg-panel)] border-t border-[var(--border)] text-xs select-none">
        <button
          onClick={() => setMode("fortress")}
          className={`px-2 py-0.5 cursor-pointer ${mode === "fortress" ? "text-[var(--green)]" : "text-[var(--text)] hover:text-[var(--amber)]"}`}
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

      <BottomBar mode={mode} cursorX={viewport.cursorX} cursorY={viewport.cursorY} />
    </div>
  );
}
