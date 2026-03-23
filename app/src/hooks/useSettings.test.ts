import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSettings } from "./useSettings.js";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal("localStorage", localStorageMock);
});

describe("useSettings", () => {
  it("returns default settings on first load", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.soundEnabled).toBe(true);
    expect(result.current.settings.soundVolume).toBe(70);
    expect(result.current.settings.animationsEnabled).toBe(true);
  });

  it("toggleSound flips soundEnabled", () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.toggleSound());
    expect(result.current.settings.soundEnabled).toBe(false);
    act(() => result.current.toggleSound());
    expect(result.current.settings.soundEnabled).toBe(true);
  });

  it("setSoundVolume clamps to 0–100", () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setSoundVolume(150));
    expect(result.current.settings.soundVolume).toBe(100);
    act(() => result.current.setSoundVolume(-10));
    expect(result.current.settings.soundVolume).toBe(0);
  });

  it("toggleAnimations flips animationsEnabled", () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.toggleAnimations());
    expect(result.current.settings.animationsEnabled).toBe(false);
  });

  it("persists settings to localStorage", () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.toggleSound());
    const stored = JSON.parse(localStorageMock.getItem("pwarf_settings")!);
    expect(stored.soundEnabled).toBe(false);
  });

  it("loads persisted settings on mount", () => {
    localStorageMock.setItem("pwarf_settings", JSON.stringify({ soundEnabled: false, soundVolume: 30, animationsEnabled: false }));
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.soundEnabled).toBe(false);
    expect(result.current.settings.soundVolume).toBe(30);
    expect(result.current.settings.animationsEnabled).toBe(false);
  });
});
