// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTutorial, TUTORIAL_STEPS } from "./useTutorial";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
});

describe("useTutorial", () => {
  it("starts inactive", () => {
    const { result } = renderHook(() => useTutorial());
    expect(result.current.active).toBe(false);
  });

  it("becomes active after start()", () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.stepIndex).toBe(0);
  });

  it("advances through steps with next()", () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current.stepIndex).toBe(1);
  });

  it("goes back with prev()", () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.start());
    act(() => result.current.next());
    act(() => result.current.prev());
    expect(result.current.stepIndex).toBe(0);
  });

  it("prev() does not go below 0", () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.start());
    act(() => result.current.prev());
    expect(result.current.stepIndex).toBe(0);
  });

  it("isFirst is true on first step", () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.start());
    expect(result.current.isFirst).toBe(true);
    act(() => result.current.next());
    expect(result.current.isFirst).toBe(false);
  });

  it("isLast is true on last step", () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.start());
    // advance to last step
    for (let i = 0; i < TUTORIAL_STEPS.length - 1; i++) {
      act(() => result.current.next());
    }
    expect(result.current.isLast).toBe(true);
  });

  it("next() on last step closes tutorial and sets localStorage", () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.start());
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      act(() => result.current.next());
    }
    expect(result.current.active).toBe(false);
    expect(localStorageMock.getItem("pwarf_tutorial_seen")).toBe("1");
  });

  it("dismiss() closes tutorial and sets localStorage", () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.start());
    act(() => result.current.dismiss());
    expect(result.current.active).toBe(false);
    expect(localStorageMock.getItem("pwarf_tutorial_seen")).toBe("1");
  });

  it("currentStep matches TUTORIAL_STEPS[stepIndex]", () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.start());
    expect(result.current.currentStep).toBe(TUTORIAL_STEPS[0]);
    act(() => result.current.next());
    expect(result.current.currentStep).toBe(TUTORIAL_STEPS[1]);
  });
});

describe("TUTORIAL_STEPS", () => {
  it("has at least 5 steps", () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(5);
  });

  it("every step has an id, title, body, and tooltipAnchor", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(typeof step.id).toBe("string");
      expect(typeof step.title).toBe("string");
      expect(typeof step.body).toBe("string");
      expect(["center", "below-top", "right-of-left", "above-bottom", "left-of-right"]).toContain(step.tooltipAnchor);
    }
  });

  it("spotlight steps have top/left/width/height", () => {
    for (const step of TUTORIAL_STEPS) {
      if (step.spotlight) {
        expect(typeof step.spotlight.top).toBe("string");
        expect(typeof step.spotlight.left).toBe("string");
        expect(typeof step.spotlight.width).toBe("string");
        expect(typeof step.spotlight.height).toBe("string");
      }
    }
  });
});
