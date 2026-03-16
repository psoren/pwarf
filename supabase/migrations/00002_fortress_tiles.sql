-- ============================================================
-- FORTRESS TILES — Two-tier map schema (issue #141)
-- ============================================================

-- Enum for fortress-level tile types
create type fortress_tile_type as enum (
  'open_air',
  'soil',
  'stone',
  'ore',
  'gem',
  'water',
  'magma',
  'lava_stone',
  'cavern_floor',
  'cavern_wall',
  'constructed_wall',
  'constructed_floor',
  'stair_up',
  'stair_down',
  'stair_both',
  'empty'
);

-- Fortress tiles: 512x512 x 20 z-levels per civilization
create table fortress_tiles (
  id              uuid primary key default uuid_generate_v4(),
  civilization_id uuid not null references civilizations(id) on delete cascade,
  x               int not null check (x between 0 and 511),
  y               int not null check (y between 0 and 511),
  z               int not null check (z between -19 and 0),
  tile_type       fortress_tile_type not null,
  material        text,
  is_revealed     boolean not null default false,
  is_mined        boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (civilization_id, x, y, z)
);

-- Index for per-level queries (e.g. render z-level -5 for a fortress)
create index fortress_tiles_civ_z_idx
  on fortress_tiles (civilization_id, z);

-- Index for finding specific tile types (e.g. all ores in a fortress)
create index fortress_tiles_civ_type_idx
  on fortress_tiles (civilization_id, tile_type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table fortress_tiles enable row level security;

-- Anyone can read fortress tiles (for spectating, ruins exploration, etc.)
create policy "public fortress_tiles readable"
  on fortress_tiles for select using (true);

-- Players can manage fortress tiles belonging to their own civilizations
create policy "players manage own fortress_tiles"
  on fortress_tiles for all using (
    civilization_id in (select id from civilizations where player_id = auth.uid())
  );
