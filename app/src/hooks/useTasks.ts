import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { POLL_TASKS_MS } from '@pwarf/shared';

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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFingerprint = useRef<string>('');

  useEffect(() => {
    if (!civId) {
      setTasks([]);
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

  /** Task types that are autonomous (not player-designated) — don't show as designations. */
  const AUTONOMOUS_TASK_TYPES: ReadonlySet<string> = new Set(['eat', 'drink', 'sleep', 'wander']);

  /** Map of "x,y" → task_type for tiles with active designations */
  const designatedTiles = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      if (task.target_x !== null && task.target_y !== null && !AUTONOMOUS_TASK_TYPES.has(task.task_type)) {
        map.set(`${task.target_x},${task.target_y}`, task.task_type);
      }
    }
    return map;
  }, [tasks]);

  return { tasks, designatedTiles };
}
