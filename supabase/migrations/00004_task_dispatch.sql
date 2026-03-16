-- ============================================================
-- TASK DISPATCH SYSTEM
-- Adds tasks table and dwarf position/task tracking columns
-- ============================================================

-- New enums for task system
create type task_type as enum (
  'mine', 'haul', 'farm_till', 'farm_plant', 'farm_harvest',
  'eat', 'drink', 'sleep'
);

create type task_status as enum (
  'pending', 'claimed', 'in_progress', 'completed', 'failed', 'cancelled'
);

-- Tasks table
create table tasks (
  id                uuid primary key default uuid_generate_v4(),
  civilization_id   uuid not null references civilizations(id) on delete cascade,
  task_type         task_type not null,
  status            task_status not null default 'pending',
  priority          int not null default 5 check (priority between 1 and 10),
  assigned_dwarf_id uuid references dwarves(id) on delete set null,
  target_x          int,
  target_y          int,
  target_z          int,
  target_item_id    uuid references items(id) on delete set null,
  work_progress     real not null default 0,
  work_required     real not null default 100,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index tasks_civ_status_idx on tasks(civilization_id, status);
create index tasks_assigned_idx on tasks(assigned_dwarf_id) where assigned_dwarf_id is not null;

-- Add position and current task tracking to dwarves
alter table dwarves add column current_task_id uuid references tasks(id) on delete set null;
alter table dwarves add column position_x int not null default 0;
alter table dwarves add column position_y int not null default 0;
alter table dwarves add column position_z int not null default 0;
