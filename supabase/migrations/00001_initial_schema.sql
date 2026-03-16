-- ============================================================
-- DWARF FORTRESS CLONE — SUPABASE SCHEMA
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

create type civilization_status as enum (
  'active', 'fallen', 'abandoned', 'mythic'
);

create type cause_of_death as enum (
  'siege', 'flood', 'magma', 'starvation', 'tantrum_spiral',
  'plague', 'undead', 'cave_in', 'forgotten_beast', 'abandonment', 'unknown',
  'titan'
);

create type dwarf_status as enum (
  'alive', 'dead', 'missing', 'ghost', 'feral'
);

create type item_quality as enum (
  'garbage', 'poor', 'standard', 'fine', 'superior', 'exceptional', 'masterwork', 'artifact'
);

create type item_category as enum (
  'weapon', 'armor', 'tool', 'food', 'drink', 'gem', 'cloth',
  'furniture', 'mechanism', 'book', 'crafted', 'raw_material', 'container'
);

create type relationship_type as enum (
  'friend', 'rival', 'lover', 'spouse', 'parent', 'child', 'sibling',
  'mentor', 'student', 'nemesis', 'acquaintance'
);

create type faction_type as enum (
  'guild', 'noble_house', 'religious_sect', 'military_order',
  'criminal', 'merchant_consortium', 'outsider_civ'
);

create type expedition_status as enum (
  'traveling', 'active', 'looting', 'retreating', 'complete', 'lost'
);

create type event_category as enum (
  'battle', 'death', 'birth', 'marriage', 'artifact_created', 'artifact_lost',
  'fortress_founded', 'fortress_fallen', 'migration', 'discovery', 'myth',
  'monster_sighting', 'monster_slain', 'monster_siege'
);

create type terrain_type as enum (
  'mountain', 'forest', 'plains', 'desert', 'tundra', 'swamp',
  'ocean', 'volcano', 'underground', 'haunted', 'savage', 'evil'
);

create type monster_type as enum (
  'forgotten_beast', 'titan', 'megabeast', 'dragon',
  'demon', 'undead_lord', 'night_creature', 'giant',
  'siege_beast', 'nature_spirit', 'construct', 'vermin_lord'
);

create type monster_status as enum (
  'active', 'dormant', 'slain', 'fled', 'imprisoned', 'legendary'
);

create type monster_behavior as enum (
  'neutral', 'territorial', 'aggressive', 'sieging',
  'corrupting', 'fleeing', 'hibernating', 'hunting'
);

create type encounter_outcome as enum (
  'repelled', 'overrun', 'fled', 'captured',
  'negotiated', 'pyrrhic_victory', 'catastrophic_loss', 'unknown'
);

-- ============================================================
-- WORLD
-- ============================================================

create table worlds (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  seed            bigint not null unique,
  width           int not null default 512,
  height          int not null default 512,
  age_years       int not null default 0,
  created_at      timestamptz not null default now(),
  is_public       boolean not null default true,
  history_summary jsonb default '{}'
);

create table world_tiles (
  id              uuid primary key default uuid_generate_v4(),
  world_id        uuid not null references worlds(id) on delete cascade,
  coord           geometry(Point, 4326) not null,
  x               int not null,
  y               int not null,
  terrain         terrain_type not null,
  elevation       int not null default 0,
  biome_tags      text[] default '{}',
  explored        boolean not null default false,
  unique (world_id, x, y)
);

create index world_tiles_coord_idx on world_tiles using gist(coord);
create index world_tiles_world_idx on world_tiles(world_id);

-- ============================================================
-- PLAYERS
-- ============================================================

create table players (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text not null unique,
  display_name    text,
  world_id        uuid references worlds(id),
  created_at      timestamptz not null default now(),
  last_active_at  timestamptz,
  total_years_survived int not null default 0,
  legendary_deeds jsonb default '[]'
);

-- ============================================================
-- CIVILIZATIONS
-- ============================================================

create table civilizations (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid not null references players(id) on delete cascade,
  world_id        uuid not null references worlds(id) on delete cascade,
  name            text not null,
  epithet         text,
  status          civilization_status not null default 'active',
  founded_year    int not null default 0,
  fallen_year     int,
  cause_of_death  cause_of_death,
  tile_x          int not null,
  tile_y          int not null,
  population      int not null default 0,
  wealth          bigint not null default 0,
  snapshot        jsonb,
  snapshot_url    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (world_id, tile_x, tile_y)
    references world_tiles(world_id, x, y)
);

create index civs_player_idx on civilizations(player_id);
create index civs_world_tile_idx on civilizations(world_id, tile_x, tile_y);
create index civs_status_idx on civilizations(status);

-- ============================================================
-- RUINS
-- ============================================================

create table ruins (
  id                  uuid primary key default uuid_generate_v4(),
  civilization_id     uuid not null references civilizations(id),
  world_id            uuid not null references worlds(id),
  name                text not null,
  tile_x              int not null,
  tile_y              int not null,
  fallen_year         int not null,
  cause_of_death      cause_of_death not null,
  original_wealth     bigint not null default 0,
  remaining_wealth    bigint not null default 0,
  peak_population     int not null default 0,
  danger_level        int not null default 0 check (danger_level between 0 and 100),
  is_contaminated     boolean not null default false,
  contamination_type  text,
  ghost_count         int not null default 0,
  is_trapped          boolean not null default false,
  is_published        boolean not null default false,
  resident_monster_id uuid,
  snapshot            jsonb,
  snapshot_url        text,
  created_at          timestamptz not null default now(),
  foreign key (world_id, tile_x, tile_y)
    references world_tiles(world_id, x, y)
);

create index ruins_world_tile_idx on ruins(world_id, tile_x, tile_y);
create index ruins_danger_idx on ruins(danger_level);
create index ruins_cause_idx on ruins(cause_of_death);
create index ruins_published_idx on ruins(is_published) where is_published = true;

-- ============================================================
-- EXPEDITIONS
-- ============================================================

create table expeditions (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid not null references players(id),
  ruin_id         uuid not null references ruins(id),
  status          expedition_status not null default 'traveling',
  dwarf_ids       uuid[] default '{}',
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  items_looted    uuid[] default '{}',
  dwarves_lost    int not null default 0,
  expedition_log  text,
  unique (player_id, ruin_id)
);

create index expeditions_ruin_idx on expeditions(ruin_id);
create index expeditions_player_idx on expeditions(player_id);

-- ============================================================
-- DWARVES
-- ============================================================

create table dwarves (
  id                uuid primary key default uuid_generate_v4(),
  civilization_id   uuid not null references civilizations(id) on delete cascade,
  name              text not null,
  surname           text,
  status            dwarf_status not null default 'alive',
  age               int not null default 0,
  gender            text,
  need_food         int not null default 80 check (need_food between 0 and 100),
  need_drink        int not null default 80 check (need_drink between 0 and 100),
  need_sleep        int not null default 80 check (need_sleep between 0 and 100),
  need_social       int not null default 50 check (need_social between 0 and 100),
  need_purpose      int not null default 50 check (need_purpose between 0 and 100),
  need_beauty       int not null default 50 check (need_beauty between 0 and 100),
  stress_level      int not null default 0 check (stress_level between 0 and 100),
  is_in_tantrum     boolean not null default false,
  health            int not null default 100 check (health between 0 and 100),
  injuries          jsonb default '[]',
  memories          jsonb default '[]',
  trait_openness          smallint default 0,
  trait_conscientiousness smallint default 0,
  trait_extraversion      smallint default 0,
  trait_agreeableness     smallint default 0,
  trait_neuroticism       smallint default 0,
  religious_devotion  int not null default 0 check (religious_devotion between 0 and 100),
  faction_id          uuid,
  born_year           int,
  died_year           int,
  cause_of_death      text,
  created_at          timestamptz not null default now()
);

create index dwarves_civ_idx on dwarves(civilization_id);
create index dwarves_status_idx on dwarves(status);

create table dwarf_skills (
  id              uuid primary key default uuid_generate_v4(),
  dwarf_id        uuid not null references dwarves(id) on delete cascade,
  skill_name      text not null,
  level           int not null default 0 check (level between 0 and 20),
  xp              int not null default 0,
  last_used_year  int,
  unique (dwarf_id, skill_name)
);

create table dwarf_relationships (
  id              uuid primary key default uuid_generate_v4(),
  dwarf_a_id      uuid not null references dwarves(id) on delete cascade,
  dwarf_b_id      uuid not null references dwarves(id) on delete cascade,
  type            relationship_type not null,
  strength        int not null default 50 check (strength between 0 and 100),
  shared_events   jsonb default '[]',
  formed_year     int,
  check (dwarf_a_id < dwarf_b_id)
);

-- ============================================================
-- FACTIONS
-- ============================================================

create table factions (
  id              uuid primary key default uuid_generate_v4(),
  world_id        uuid not null references worlds(id) on delete cascade,
  name            text not null,
  type            faction_type not null,
  power_level     int not null default 50 check (power_level between 0 and 100),
  disposition     int not null default 50 check (disposition between 0 and 100),
  lore            text,
  founded_year    int,
  is_active       boolean not null default true,
  beliefs         jsonb default '{}'
);

alter table dwarves
  add constraint dwarves_faction_fk
  foreign key (faction_id) references factions(id) on delete set null;

create table civ_faction_relations (
  id              uuid primary key default uuid_generate_v4(),
  civilization_id uuid not null references civilizations(id) on delete cascade,
  faction_id      uuid not null references factions(id) on delete cascade,
  standing        int not null default 0 check (standing between -100 and 100),
  is_at_war       boolean not null default false,
  trade_active    boolean not null default false,
  unique (civilization_id, faction_id)
);

-- ============================================================
-- ITEMS & ARTIFACTS
-- ============================================================

create table items (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  category              item_category not null,
  quality               item_quality not null default 'standard',
  material              text,
  weight                int default 0,
  value                 bigint not null default 0,
  is_artifact           boolean not null default false,
  created_by_dwarf_id   uuid references dwarves(id) on delete set null,
  created_in_civ_id     uuid references civilizations(id) on delete set null,
  created_year          int,
  held_by_dwarf_id      uuid references dwarves(id) on delete set null,
  located_in_civ_id     uuid references civilizations(id) on delete set null,
  located_in_ruin_id    uuid references ruins(id) on delete set null,
  lore                  text,
  properties            jsonb default '{}',
  created_at            timestamptz not null default now()
);

create index items_ruin_idx on items(located_in_ruin_id);
create index items_civ_idx on items(located_in_civ_id);
create index items_artifact_idx on items(is_artifact) where is_artifact = true;

-- ============================================================
-- MONSTERS
-- ============================================================

create table monsters (
  id                    uuid primary key default uuid_generate_v4(),
  world_id              uuid not null references worlds(id) on delete cascade,
  name                  text not null,
  epithet               text,
  type                  monster_type not null,
  status                monster_status not null default 'active',
  behavior              monster_behavior not null default 'territorial',
  is_named              boolean not null default false,
  lair_tile_x           int,
  lair_tile_y           int,
  current_tile_x        int,
  current_tile_y        int,
  threat_level          int not null default 50 check (threat_level between 0 and 100),
  health                int not null default 100 check (health between 0 and 100),
  size_category         text not null default 'large',
  body_parts            jsonb default '[]',
  attacks               jsonb default '[]',
  abilities             jsonb default '[]',
  weaknesses            jsonb default '[]',
  lore                  text,
  origin_myth           text,
  properties            jsonb default '{}',
  first_seen_year       int,
  slain_year            int,
  slain_by_dwarf_id     uuid references dwarves(id) on delete set null,
  slain_in_civ_id       uuid references civilizations(id) on delete set null,
  slain_in_ruin_id      uuid references ruins(id) on delete set null,
  created_at            timestamptz not null default now(),
  foreign key (world_id, lair_tile_x, lair_tile_y)
    references world_tiles(world_id, x, y)
);

create index monsters_world_idx  on monsters(world_id);
create index monsters_status_idx on monsters(status);
create index monsters_threat_idx on monsters(threat_level);
create index monsters_lair_idx   on monsters(world_id, lair_tile_x, lair_tile_y);

alter table ruins
  add constraint ruins_monster_fk
  foreign key (resident_monster_id) references monsters(id) on delete set null;

create table monster_encounters (
  id                    uuid primary key default uuid_generate_v4(),
  monster_id            uuid not null references monsters(id) on delete cascade,
  world_id              uuid not null references worlds(id) on delete cascade,
  civilization_id       uuid references civilizations(id) on delete set null,
  ruin_id               uuid references ruins(id) on delete set null,
  year                  int not null,
  outcome               encounter_outcome not null default 'unknown',
  dwarves_killed        int not null default 0,
  monster_health_after  int check (monster_health_after between 0 and 100),
  items_destroyed       uuid[] default '{}',
  items_stolen          uuid[] default '{}',
  structures_damaged    uuid[] default '{}',
  description           text,
  encounter_log         text,
  event_data            jsonb default '{}'
);

create table monster_bounties (
  id                    uuid primary key default uuid_generate_v4(),
  monster_id            uuid not null references monsters(id) on delete cascade,
  world_id              uuid not null references worlds(id),
  posted_by_civ_id      uuid references civilizations(id) on delete set null,
  reward_value          bigint not null default 0,
  reward_item_id        uuid references items(id) on delete set null,
  posted_year           int not null,
  expires_year          int,
  is_claimed            boolean not null default false,
  claimed_by_player_id  uuid references players(id) on delete set null,
  claimed_year          int
);

-- ============================================================
-- LEGENDS / WORLD HISTORY
-- ============================================================

create table world_events (
  id              uuid primary key default uuid_generate_v4(),
  world_id        uuid not null references worlds(id) on delete cascade,
  year            int not null,
  category        event_category not null,
  civilization_id uuid references civilizations(id) on delete set null,
  ruin_id         uuid references ruins(id) on delete set null,
  dwarf_id        uuid references dwarves(id) on delete set null,
  item_id         uuid references items(id) on delete set null,
  faction_id      uuid references factions(id) on delete set null,
  monster_id      uuid references monsters(id) on delete set null,
  description     text not null,
  event_data      jsonb default '{}',
  created_at      timestamptz not null default now()
);

create index events_world_year_idx on world_events(world_id, year);
create index events_category_idx   on world_events(category);
create index events_monster_idx    on world_events(monster_id) where monster_id is not null;
create index events_desc_trgm_idx  on world_events using gin(description gin_trgm_ops);

-- ============================================================
-- TRADE
-- ============================================================

create table trade_caravans (
  id                    uuid primary key default uuid_generate_v4(),
  world_id              uuid not null references worlds(id),
  faction_id            uuid references factions(id),
  origin_civ_id         uuid references civilizations(id),
  destination_civ_id    uuid references civilizations(id),
  arrived_year          int,
  departed_year         int,
  manifest              jsonb default '{}',
  outcome               text,
  reputation_delta      int default 0
);

-- ============================================================
-- DISEASES
-- ============================================================

create table diseases (
  id              uuid primary key default uuid_generate_v4(),
  world_id        uuid not null references worlds(id),
  name            text not null,
  lethality       int not null default 20 check (lethality between 0 and 100),
  contagion_rate  int not null default 30 check (contagion_rate between 0 and 100),
  incubation_days int not null default 3,
  active_in_civs  uuid[] default '{}',
  active_in_ruins uuid[] default '{}',
  first_seen_year int,
  is_eradicated   boolean not null default false
);

-- ============================================================
-- STRUCTURES
-- ============================================================

create table structures (
  id              uuid primary key default uuid_generate_v4(),
  civilization_id uuid not null references civilizations(id) on delete cascade,
  name            text,
  type            text not null,
  completion_pct  int not null default 100 check (completion_pct between 0 and 100),
  built_year      int,
  ruin_id         uuid references ruins(id) on delete set null,
  quality         item_quality default 'standard',
  notes           text
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table players               enable row level security;
alter table civilizations         enable row level security;
alter table ruins                 enable row level security;
alter table expeditions           enable row level security;
alter table dwarves               enable row level security;
alter table dwarf_skills          enable row level security;
alter table dwarf_relationships   enable row level security;
alter table items                 enable row level security;
alter table world_events          enable row level security;
alter table worlds                enable row level security;
alter table world_tiles           enable row level security;
alter table factions              enable row level security;
alter table civ_faction_relations enable row level security;
alter table structures            enable row level security;
alter table monsters              enable row level security;
alter table monster_encounters    enable row level security;
alter table monster_bounties      enable row level security;

create policy "public worlds readable"     on worlds for select using (is_public = true);
create policy "public ruins readable"      on ruins for select using (true);
create policy "public events readable"     on world_events for select using (true);
create policy "public factions readable"   on factions for select using (true);
create policy "public world_tiles readable" on world_tiles for select using (true);
create policy "public items readable"      on items for select using (true);
create policy "public monsters readable"   on monsters for select using (true);
create policy "public encounters readable" on monster_encounters for select using (true);
create policy "public bounties readable"   on monster_bounties for select using (true);
create policy "players manage own civs"    on civilizations for all using (player_id = auth.uid());
create policy "players manage own dwarves" on dwarves for all using (
  civilization_id in (select id from civilizations where player_id = auth.uid())
);
create policy "players manage own expeditions" on expeditions for all using (player_id = auth.uid());
create policy "players read own profile"   on players for select using (id = auth.uid());
create policy "players update own profile" on players for update using (id = auth.uid());

-- Prevent players from expeditioning into their own ruins
create policy "players cannot expedition own ruins"
  on expeditions for insert with check (
    ruin_id not in (
      select r.id from ruins r
      join civilizations c on c.id = r.civilization_id
      where c.player_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger civilizations_updated_at
  before update on civilizations
  for each row execute function update_updated_at();

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

create or replace function fossilize_civilization(civ_id uuid, cod cause_of_death)
returns uuid language plpgsql security definer as $$
declare
  v_ruin_id uuid;
  v_civ civilizations%rowtype;
  v_ghost_count int;
begin
  select * into v_civ from civilizations where id = civ_id;
  select count(*) into v_ghost_count from dwarves
    where civilization_id = civ_id and status = 'dead';
  insert into ruins (
    civilization_id, world_id, name, tile_x, tile_y,
    fallen_year, cause_of_death, original_wealth,
    remaining_wealth, peak_population, ghost_count,
    snapshot, snapshot_url
  ) values (
    civ_id, v_civ.world_id, v_civ.name, v_civ.tile_x, v_civ.tile_y,
    v_civ.fallen_year, cod, v_civ.wealth,
    v_civ.wealth, v_civ.population, v_ghost_count,
    v_civ.snapshot, v_civ.snapshot_url
  ) returning id into v_ruin_id;
  update civilizations set status = 'fallen', cause_of_death = cod where id = civ_id;
  insert into world_events (world_id, year, category, civilization_id, ruin_id, description, event_data)
  values (
    v_civ.world_id, v_civ.fallen_year, 'fortress_fallen', civ_id, v_ruin_id,
    v_civ.name || ' has fallen to ' || cod::text || '.',
    jsonb_build_object('cause', cod, 'population', v_civ.population, 'wealth', v_civ.wealth)
  );
  return v_ruin_id;
end;
$$;

create or replace function spawn_monster(
  p_world_id uuid, p_name text, p_type monster_type,
  p_threat int, p_tile_x int, p_tile_y int, p_year int, p_lore text default null
)
returns uuid language plpgsql security definer as $$
declare v_monster_id uuid;
begin
  insert into monsters (
    world_id, name, type, threat_level,
    lair_tile_x, lair_tile_y, current_tile_x, current_tile_y,
    first_seen_year, lore, is_named
  ) values (
    p_world_id, p_name, p_type, p_threat,
    p_tile_x, p_tile_y, p_tile_x, p_tile_y,
    p_year, p_lore, (p_name is not null)
  ) returning id into v_monster_id;
  insert into world_events (world_id, year, category, monster_id, description, event_data)
  values (
    p_world_id, p_year, 'monster_sighting', v_monster_id,
    p_name || ' (' || p_type::text || ') has been sighted.',
    jsonb_build_object('type', p_type, 'threat', p_threat, 'tile_x', p_tile_x, 'tile_y', p_tile_y)
  );
  return v_monster_id;
end;
$$;
