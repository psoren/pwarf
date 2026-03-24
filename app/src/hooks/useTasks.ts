import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { POLL_TASKS_MS, AUTONOMOUS_TASK_TYPES } from '@pwarf/shared';
import type { TaskType } from '@pwarf/shared';

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

export interface OptimisticDesignation {
  x: number;
  y: number;
  taskType: string;
}

/** Build a compact fingerprint for diffing. */
function fingerprint(tasks: ActiveTask[]): string {
  let s = '';
  for (const t of tasks) {
    s += `${t.id}:${t.status}:${t.work_progress};`;
  }
  return s;
}

export function useTasks(civId: string | null) {
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [optimistic, setOptimistic] = useState<OptimisticDesignation[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFingerprint = useRef<string>('');

  useEffect(() => {
    if (!civId) {
      setTasks([]);
      setOptimistic([]);
      lastFingerprint.current = '';
      return;
    }

    async function fetchTasks() {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, task_type, status, target_x, target_y, target_z, work_progress, work_required')
        .eq('civilization_id', civId!)
        .in('status', ['pending', 'claimed', 'in_progress']);

      if (!error && data) {
        const fp = fingerprint(data);
        if (fp !== lastFingerprint.current) {
          lastFingerprint.current = fp;
          setTasks(data);
          // Clear optimistic entries once real data arrives
          setOptimistic([]);
        }
      }
    }

    void fetchTasks();
    pollRef.current = setInterval(() => void fetchTasks(), POLL_TASKS_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [civId]);


  /** Add optimistic designations that show immediately before the next poll. */
  const addOptimistic = useCallback((tiles: OptimisticDesignation[]) => {
    setOptimistic((prev) => [...prev, ...tiles]);
  }, []);

  /** Map of "x,y" → task_type for tiles with active designations */
  const designatedTiles = useMemo(() => {
    const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['pending', 'claimed', 'in_progress']);
    const map = new Map<string, string>();
    for (const task of tasks) {
      if (task.target_x !== null && task.target_y !== null
        && !AUTONOMOUS_TASK_TYPES.has(task.task_type as TaskType)
        && ACTIVE_STATUSES.has(task.status)) {
        map.set(`${task.target_x},${task.target_y}`, task.task_type);
      }
    }
    // Layer optimistic designations on top (only for keys not already in real data)
    for (const o of optimistic) {
      const key = `${o.x},${o.y}`;
      if (!map.has(key)) {
        map.set(key, o.taskType);
      }
    }
    return map;
  }, [tasks, optimistic]);

  return { tasks, designatedTiles, addOptimistic };
}
