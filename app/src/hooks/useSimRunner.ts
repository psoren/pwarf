import { useEffect, useRef, useState, useCallback } from 'react';
import { SimRunner, SupabaseStateAdapter } from '@pwarf/sim';
import type { SimSnapshot } from '@pwarf/sim';
import { supabase } from '../lib/supabase';

export type { SimSnapshot };

export function useSimRunner(civId: string | null, worldId: string | null) {
  const runnerRef = useRef<SimRunner | null>(null);
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);

  // Throttle UI updates — emit at most every 100ms (10 fps) to avoid
  // re-rendering on every single sim tick (which runs at 10/s anyway).
  const lastEmit = useRef(0);
  const pendingFrame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const handleTick = useCallback((snap: SimSnapshot) => {
    const now = performance.now();
    if (now - lastEmit.current >= 100) {
      lastEmit.current = now;
      setSnapshot(snap);
    } else if (!pendingFrame.current) {
      pendingFrame.current = requestAnimationFrame(() => {
        pendingFrame.current = null;
        lastEmit.current = performance.now();
        setSnapshot(snap);
      });
    }
  }, []);

  useEffect(() => {
    if (!civId || !worldId) {
      setSnapshot(null);
      return;
    }

    const adapter = new SupabaseStateAdapter(supabase);
    const runner = new SimRunner(adapter);
    runner.onTick = handleTick;
    runnerRef.current = runner;
    runner.start(civId, worldId).catch((err: unknown) => {
      console.error('[sim] failed to start:', err);
    });

    return () => {
      runner.onTick = null;
      if (pendingFrame.current) {
        cancelAnimationFrame(pendingFrame.current);
        pendingFrame.current = null;
      }
      runner.stop().catch((err: unknown) => {
        console.error('[sim] failed to stop:', err);
      });
      runnerRef.current = null;
    };
  }, [civId, worldId, handleTick]);

  return { runnerRef, snapshot };
}
