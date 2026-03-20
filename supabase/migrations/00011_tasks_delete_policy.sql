-- ============================================================
-- DELETE POLICY FOR TASKS TABLE
-- Allows players to cancel (delete) pending tasks for their civilizations
-- ============================================================

create policy "tasks_delete"
  on tasks for delete
  using (
    civilization_id in (
      select id from civilizations where player_id = auth.uid()
    )
  );
