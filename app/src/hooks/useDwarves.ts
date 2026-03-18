import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Dwarf } from '@pwarf/shared';

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

export function useDwarves(civId: string | null) {
  const [dwarves, setDwarves] = useState<LiveDwarf[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!civId) {
      setDwarves([]);
      return;
    }

    async function fetchDwarves() {
      const { data, error } = await supabase
        .from('dwarves')
        .select('id, name, surname, status, position_x, position_y, position_z, current_task_id, need_food, need_drink, need_sleep, stress_level, health')
        .eq('civilization_id', civId!)
        .eq('status', 'alive');

      if (!error && data) {
        setDwarves(data);
      }
    }

    // Initial fetch
    void fetchDwarves();

    // Poll every 1 second for position updates
    pollRef.current = setInterval(() => {
      void fetchDwarves();
    }, 1000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [civId]);

  return dwarves;
}
