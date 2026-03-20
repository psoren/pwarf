-- ============================================================
-- STOCKPILE TILES (issue #308)
-- Missing migration from PR #279 — table was created directly
-- in production but never committed to migrations.
-- ============================================================

create table stockpile_tiles (
  id              uuid primary key default uuid_generate_v4(),
  civilization_id uuid not null references civilizations(id) on delete cascade,
  x               int not null,
  y               int not null,
  z               int not null,
  created_at      timestamptz not null default now(),
  unique (civilization_id, x, y, z)
);

create index stockpile_tiles_civ_idx
  on stockpile_tiles (civilization_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table stockpile_tiles enable row level security;

-- Anyone can read stockpile tiles
create policy "public stockpile_tiles readable"
  on stockpile_tiles for select using (true);

-- Players can manage stockpile tiles belonging to their own civilizations
create policy "players manage own stockpile_tiles"
  on stockpile_tiles for all using (
    civilization_id in (select id from civilizations where player_id = auth.uid())
  );
