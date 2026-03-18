import { useEffect, useRef } from 'react';
import { SimRunner } from '@pwarf/sim';
import { supabase } from '../lib/supabase';

export function useSimRunner(civId: string | null, worldId: string | null) {
  const runnerRef = useRef<SimRunner | null>(null);

  useEffect(() => {
    if (!civId || !worldId) return;

    // Cast to satisfy cross-package SupabaseClient type mismatch
    // (both app and sim depend on the same @supabase/supabase-js version)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runner = new SimRunner(supabase as any);
    runnerRef.current = runner;
    runner.start(civId, worldId).catch((err: unknown) => {
      console.error('[sim] failed to start:', err);
    });

    return () => {
      runner.stop().catch((err: unknown) => {
        console.error('[sim] failed to stop:', err);
      });
      runnerRef.current = null;
    };
  }, [civId, worldId]);

  return runnerRef;
}
