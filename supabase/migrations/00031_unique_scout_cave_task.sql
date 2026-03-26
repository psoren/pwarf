-- Prevent duplicate scout_cave tasks for the same cave entrance.
-- Only one active (pending/claimed/in_progress) scout task per entrance per civilization.
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_scout_cave
  ON tasks (civilization_id, target_x, target_y)
  WHERE task_type = 'scout_cave'
    AND status IN ('pending', 'claimed', 'in_progress');
