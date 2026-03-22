import { useState, useEffect } from "react";

const STORAGE_KEY = "pwarf_settings";

export interface Settings {
  soundEnabled: boolean;
  soundVolume: number;      // 0–100
  animationsEnabled: boolean;
}

const DEFAULTS: Settings = {
  soundEnabled: true,
  soundVolume: 70,
  animationsEnabled: true,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore storage errors
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    save(settings);
  }, [settings]);

  function toggleSound() {
    setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }));
  }

  function setSoundVolume(volume: number) {
    setSettings((s) => ({ ...s, soundVolume: Math.max(0, Math.min(100, volume)) }));
  }

  function toggleAnimations() {
    setSettings((s) => ({ ...s, animationsEnabled: !s.animationsEnabled }));
  }

  return { settings, toggleSound, setSoundVolume, toggleAnimations };
}
