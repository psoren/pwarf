import { useEffect, useRef, useState, useCallback } from "react";
import * as Tone from "tone";
import {
  startSoundtrack,
  stopSoundtrack,
  pauseSoundtrack,
  resumeSoundtrack,
  setSoundtrackMuted,
  disposeSoundtrack,
} from "../sounds/soundtrack.js";

const MUTE_KEY = "pwarf-soundtrack-muted";

/**
 * Manages the ambient soundtrack lifecycle.
 *
 * - Unlocks AudioContext on first user interaction (browser autoplay policy)
 * - Starts the soundtrack when the game is running
 * - Pauses/resumes in sync with the game
 * - Persists mute preference in localStorage
 */
export function useSoundtrack(gameActive: boolean, isPaused: boolean) {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const audioUnlocked = useRef(false);
  const soundtrackStarted = useRef(false);

  // Unlock AudioContext on first user interaction
  useEffect(() => {
    const unlock = () => {
      if (!audioUnlocked.current) {
        Tone.start().then(() => {
          audioUnlocked.current = true;
        });
      }
    };
    window.addEventListener("click", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Start/stop soundtrack based on game active state
  useEffect(() => {
    if (gameActive && audioUnlocked.current && !muted) {
      startSoundtrack();
      soundtrackStarted.current = true;
    }
    return () => {
      if (soundtrackStarted.current) {
        stopSoundtrack();
        soundtrackStarted.current = false;
      }
    };
  }, [gameActive, muted]);

  // Pause/resume in sync with game
  useEffect(() => {
    if (!soundtrackStarted.current || muted) return;
    if (isPaused) {
      pauseSoundtrack();
    } else {
      resumeSoundtrack();
    }
  }, [isPaused, muted]);

  // Mute/unmute
  useEffect(() => {
    setSoundtrackMuted(muted);
    try {
      localStorage.setItem(MUTE_KEY, String(muted));
    } catch {
      // localStorage unavailable
    }
  }, [muted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disposeSoundtrack();
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { muted, toggleMute };
}
