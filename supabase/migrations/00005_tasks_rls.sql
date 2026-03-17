-- ============================================================
-- RLS POLICIES FOR TASKS TABLE
-- Allows players to read/create/update tasks for their civilizations
-- ============================================================

alter table tasks enable row level security;

-- Anyone can read tasks (needed for sim + app)
create policy "tasks_select"
  on tasks for select
  using (true);

-- Players can insert tasks for their own civilizations
create policy "tasks_insert"
  on tasks for insert
  with check (
    civilization_id in (
      select id from civilizations where player_id = auth.uid()
    )
  );

-- Players can update tasks for their own civilizations
create policy "tasks_update"
  on tasks for update
  using (
    civilization_id in (
      select id from civilizations where player_id = auth.uid()
    )
  );
