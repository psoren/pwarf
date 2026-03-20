const STORAGE_KEY = "pwarf_tutorial_seen";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  // Spotlight hole — fixed viewport-relative CSS values. Omit for welcome/done steps.
  spotlight?: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
  // Where to place the tooltip card
  tooltipAnchor: "center" | "below-top" | "right-of-left" | "above-bottom" | "left-of-right";
}

// Layout constants matching the actual component widths
export const LEFT_PANEL_W = 200;
export const RIGHT_PANEL_W = 220;
// Toolbar + mode-toggle + bottom-bar combined bottom offset used for spotlight height
const TOOLBAR_H = "34px";
const BOTTOM_H = "60px"; // mode toggle (~28px) + bottom bar (~32px)

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to pWarf!",
    body: "A dwarf fortress sim where you guide a band of dwarves to (hopefully) glory. Let's take a quick tour of the interface.",
    tooltipAnchor: "center",
  },
  {
    id: "toolbar",
    title: "Toolbar",
    body: "Shows your fortress name, the current year, population, and total wealth. Use Pause and the speed buttons (1×/2×/5×) to control the simulation. Space also pauses.",
    spotlight: {
      top: "0",
      left: "0",
      width: "100%",
      height: TOOLBAR_H,
    },
    tooltipAnchor: "below-top",
  },
  {
    id: "left_panel",
    title: "Dwarf Roster",
    body: "Lists all your dwarves. Name colors indicate stress level — amber is stressed, red is in crisis. Click a name to inspect their needs, skills, personality traits, and recent memories.",
    spotlight: {
      top: TOOLBAR_H,
      left: "0",
      width: `${LEFT_PANEL_W}px`,
      height: `calc(100% - ${TOOLBAR_H} - ${BOTTOM_H})`,
    },
    tooltipAnchor: "right-of-left",
  },
  {
    id: "map",
    title: "Fortress Map",
    body: "Your fortress rendered in ASCII. Dwarves appear as ☺, monsters as M, ground items as *. Click and drag to pan the camera. Click a ☺ to select that dwarf.",
    spotlight: {
      top: TOOLBAR_H,
      left: `${LEFT_PANEL_W}px`,
      width: `calc(100% - ${LEFT_PANEL_W}px - ${RIGHT_PANEL_W}px)`,
      height: `calc(100% - ${TOOLBAR_H} - ${BOTTOM_H})`,
    },
    tooltipAnchor: "center",
  },
  {
    id: "right_panel",
    title: "Activity Log",
    body: "Tracks everything that happens in your fortress. Switch to Legends to read world history grouped by year, or Graveyard to browse published ruins from other runs.",
    spotlight: {
      top: TOOLBAR_H,
      left: `calc(100% - ${RIGHT_PANEL_W}px)`,
      width: `${RIGHT_PANEL_W}px`,
      height: `calc(100% - ${TOOLBAR_H} - ${BOTTOM_H})`,
    },
    tooltipAnchor: "left-of-right",
  },
  {
    id: "designations",
    title: "Designations & Building",
    body: "The bottom bar shows your active designation mode. Press M to mine, S for stockpile, B for the build menu (walls, floors, beds, etc.). Drag across the map to mark an area. Press Esc to cancel.",
    spotlight: {
      top: `calc(100% - ${BOTTOM_H})`,
      left: "0",
      width: "100%",
      height: BOTTOM_H,
    },
    tooltipAnchor: "above-bottom",
  },
  {
    id: "done",
    title: "You're ready!",
    body: "Good luck, and may your dwarves never starve. You can replay this tutorial at any time with the ? button in the toolbar.",
    tooltipAnchor: "center",
  },
];

import { useState, useCallback } from "react";

export function useTutorial() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const dismiss = useCallback(() => {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, "1");
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => {
      const next = i + 1;
      if (next >= TUTORIAL_STEPS.length) {
        setActive(false);
        localStorage.setItem(STORAGE_KEY, "1");
        return 0;
      }
      return next;
    });
  }, []);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  return {
    active,
    stepIndex,
    currentStep: TUTORIAL_STEPS[stepIndex],
    isFirst: stepIndex === 0,
    isLast: stepIndex === TUTORIAL_STEPS.length - 1,
    start,
    dismiss,
    next,
    prev,
  };
}
