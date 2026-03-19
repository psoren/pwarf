import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export interface ActiveTask {
  id: string;
  task_type: string;
  status: string;
  target_x: number | null;
  target_y: number | null;
  target_z: number | null;
  work_progress: number;
  work_required: number;
}

export function useTasks(civId: string | null) {
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!civId) {
      setTasks([]);
      return;
    }

    async function fetchTasks() {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, task_type, status, target_x, target_y, target_z, work_progress, work_required')
        .eq('civilization_id', civId!)
        .in('status', ['pending', 'claimed', 'in_progress']);

      if (!error && data) {
        setTasks(data);
      }
    }

    void fetchTasks();
    pollRef.current = setInterval(() => void fetchTasks(), 1000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [civId]);

  /** Map of "x,y" → task_type for tiles with active designations */
  const designatedTiles = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      if (task.target_x !== null && task.target_y !== null) {
        map.set(`${task.target_x},${task.target_y}`, task.task_type);
      }
    }
    return map;
  }, [tasks]);

  return { tasks, designatedTiles };
}
