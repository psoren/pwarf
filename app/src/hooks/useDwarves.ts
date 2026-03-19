import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { POLL_DWARVES_MS } from '@pwarf/shared';

export interface LiveDwarf {
  id: string;
  name: string;
  surname: string | null;
  status: string;
  position_x: number;
  position_y: number;
  position_z: number;
  current_task_id: string | null;
  need_food: number;
  need_drink: number;
  need_sleep: number;
  stress_level: number;
  health: number;
}

/** Build a compact fingerprint string for diffing without deep comparison. */
function fingerprint(dwarves: LiveDwarf[]): string {
  let s = '';
  for (const d of dwarves) {
    s += `${d.id}:${d.position_x},${d.position_y},${d.position_z}:${d.current_task_id}:${d.need_food}:${d.need_drink}:${d.need_sleep}:${d.stress_level}:${d.health};`;
  }
  return s;
}

export function useDwarves(civId: string | null) {
  const [dwarves, setDwarves] = useState<LiveDwarf[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFingerprint = useRef<string>('');

  useEffect(() => {
    if (!civId) {
      setDwarves([]);
      lastFingerprint.current = '';
      return;
    }

    async function fetchDwarves() {
      const { data, error } = await supabase
        .from('dwarves')
        .select('id, name, surname, status, position_x, position_y, position_z, current_task_id, need_food, need_drink, need_sleep, stress_level, health')
        .eq('civilization_id', civId!)
        .eq('status', 'alive');

      if (!error && data) {
        const fp = fingerprint(data);
        if (fp !== lastFingerprint.current) {
          lastFingerprint.current = fp;
          setDwarves(data);
        }
      }
    }

    void fetchDwarves();

    pollRef.current = setInterval(() => {
      void fetchDwarves();
    }, POLL_DWARVES_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [civId]);

  return dwarves;
}
