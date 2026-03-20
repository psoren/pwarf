import { useEffect } from "react";

export type KeyAction =
  | { type: "pan"; dx: number; dy: number }
  | { type: "toggle_mode" }
  | { type: "toggle_left_panel" }
  | { type: "toggle_right_panel" }
  | { type: "z_up" }
  | { type: "z_down" }
  | { type: "designate_mine" }
  | { type: "open_build_menu" }
  | { type: "open_priorities" }
  | { type: "cancel_designation" }
  | { type: "designate_stockpile" }
  | { type: "designate_deconstruct" }
  | { type: "designate_smooth" }
  | { type: "designate_engrave" }
  | { type: "designate_farm" }
  | { type: "toggle_pause" }
  | { type: "set_speed"; multiplier: 1 | 2 | 5 };

export function useKeyboard(onAction: (action: KeyAction) => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowUp":
        case "w":
          e.preventDefault();
          onAction({ type: "pan", dx: 0, dy: -1 });
          break;
        case "ArrowDown":
        case "s":
          e.preventDefault();
          onAction({ type: "pan", dx: 0, dy: 1 });
          break;
        case "ArrowLeft":
        case "a":
          e.preventDefault();
          onAction({ type: "pan", dx: -1, dy: 0 });
          break;
        case "ArrowRight":
        case "d":
          e.preventDefault();
          onAction({ type: "pan", dx: 1, dy: 0 });
          break;
        case "Tab":
          e.preventDefault();
          onAction({ type: "toggle_mode" });
          break;
        case "[":
          onAction({ type: "toggle_left_panel" });
          break;
        case "]":
          onAction({ type: "toggle_right_panel" });
          break;
        case "<":
          onAction({ type: "z_up" });
          break;
        case ">":
          onAction({ type: "z_down" });
          break;
        case "m":
          onAction({ type: "designate_mine" });
          break;
        case "b":
          onAction({ type: "open_build_menu" });
          break;
        case "p":
          onAction({ type: "open_priorities" });
          break;
        case "S":
          onAction({ type: "designate_stockpile" });
          break;
        case "D":
          onAction({ type: "designate_deconstruct" });
          break;
        case "O":
          onAction({ type: "designate_smooth" });
          break;
        case "E":
          onAction({ type: "designate_engrave" });
          break;
        case "f":
          onAction({ type: "designate_farm" });
          break;
        case "Escape":
          onAction({ type: "cancel_designation" });
          break;
        case " ":
          e.preventDefault();
          onAction({ type: "toggle_pause" });
          break;
        case "1":
          onAction({ type: "set_speed", multiplier: 1 });
          break;
        case "2":
          onAction({ type: "set_speed", multiplier: 2 });
          break;
        case "5":
          onAction({ type: "set_speed", multiplier: 5 });
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAction]);
}
