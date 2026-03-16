# DWARF FORTRESS CLONE — CLAUDE CODE START BRIEF
> Hand this entire file to Claude Code as its first prompt. Do not start writing code until you have read and understood all of it.

---

## 1. WHAT WE'RE BUILDING

A browser-based Dwarf Fortress clone. Each player has their own private world — real-time simulation, direct control, no waiting. Players found fortresses, manage dwarves, and eventually die permanently. When a fortress falls, the player can **publish their ruin** to a shared global graveyard that all players can browse, explore, and loot.

The core game is single-player. The social layer is the graveyard — ruins built and lost by real people, with real histories, that become other players' dungeons.

This is a **fresh start**. There is no existing codebase to preserve or migrate. Scaffold everything correctly from the ground up.

---

## 2. TECH STACK

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Backend/DB | Supabase (Postgres + Auth + Realtime) |
| Hosting | TBD (assume Vercel for now) |
| Sim runner | Node.js server process (separate from frontend) — runs the sim loop per active session |

**Critical architecture rule:** The simulation logic must be completely headless — no DOM, no browser APIs, no React anywhere in the sim code. The sim runs on the server. The frontend is a pure viewer/input layer that reads from Supabase and sends player actions. This separation must be enforced from day one.

**State saving rules:**
- **Player actions save instantly** — every designation, labor assignment, work order, or squad command writes to Supabase immediately. Player intent is never lost.
- **Sim state writes to Supabase continuously** — dwarf positions, needs, job progress, and world state persist after every sim step. If the server restarts, everything is recoverable.
- **Frontend uses Supabase Realtime** — the UI subscribes to table changes and updates live. No polling.

---

## 3. DATABASE SCHEMA

Apply this schema to Supabase exactly as written. Do not modify table or column names — all other code will reference these.

```sql
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
```

---

## 4. WORLD DESIGN

- Each player has their **own private world** — 512×512 tiles, generated fresh when they first start. No shared world between players.
- The world is **fixed and finite** — no infinite generation.
- The sim runs **in real time** while the player is online — like actual Dwarf Fortress. Dwarves walk around, jobs complete over seconds/minutes, sieges play out while you watch. The sim loop runs on the server, pauses when the player's session ends.
- **Two zoom levels:**
  - **World map** — the 512×512 grid. Terrain glyphs, the player's fortress, ruins within their world, monster lairs.
  - **Local/fortress map** — inside a single world tile. Z-levels, individual floor tiles, dwarves, stockpiles. This is where the player spends most of their time.

### The Graveyard (shared between all players)
When a fortress falls, the player is shown their epitaph and given the option to **publish their ruin**. Published ruins go into a global shared pool. Any player can browse the graveyard, read the history of a ruin, and launch an expedition into it. This is the only point where players interact with each other's games — through the ruins left behind.

**A player cannot loot their own published ruins.** You can read your own ruin's history and view it on your world map, but you cannot send expeditions into it. The graveyard is for other players to explore — your own ruins are gravestones, not dungeons. This prevents farming your own deaths for easy loot and keeps the graveyard meaningful.

The `ruins` table needs one additional column for this:
```sql
alter table ruins add column is_published boolean not null default false;
create index ruins_published_idx on ruins(is_published) where is_published = true;
```

Enforce this at the RLS level:
```sql
create policy "players cannot expedition own ruins"
  on expeditions for insert with check (
    ruin_id not in (
      select r.id from ruins r
      join civilizations c on c.id = r.civilization_id
      where c.player_id = auth.uid()
    )
  );
```

---

## 5. SIM LOOP (real-time)

The sim runs as a continuous loop on the server while a player's session is active. It does **not** run on a cron job — it runs in real time, like actual Dwarf Fortress. When the player closes their session, the sim pauses and state is fully persisted to Supabase.

### Sim tick rate
Target **~10 sim steps per second** (100ms per step). One in-game year = **30 real minutes** = 18,000 sim steps.

```
STEPS_PER_SECOND = 10
STEPS_PER_YEAR   = 18_000   // 30 real minutes per in-game year
```

At this rate:
- One in-game day = ~49 steps = ~5 real seconds
- A dwarf lifespan (~80 years) = ~40 real hours of play
- An average fortress run (falls at year 20-40) = 10-20 real hours across sessions
- A skilled player surviving 100+ years has genuinely earned it

These are tunable — expose them as named constants, never hardcode. Adjust during playtesting.

### Each sim step processes:

1. **Dwarf needs decay** — small decrement per step based on need type (hunger slower than thirst)
2. **Dwarf task execution** — each dwarf advances their current job by one step (mining progress, crafting progress, hauling, etc.)
3. **Need satisfaction** — dwarves with low needs who are near a food/drink source consume it
4. **Stress recalculation** — stress updates based on current needs state and recent memories
5. **Tantrum check** — if stress over threshold, possibly trigger tantrum
6. **Monster pathfinding** — monsters advance one step toward their target (fortress, wandering, etc.)
7. **Combat resolution** — if a monster and dwarf are on the same tile, resolve combat
8. **Construction progress** — active build jobs advance
9. **Job claiming** — idle dwarves with appropriate labor enabled claim available work orders/designations
10. **Event firing** — anything notable this step writes to `world_events`

### Yearly rollup (every ~365 steps)
Some things only need to update once per in-game year:
- Dwarf aging and natural death check
- Skill level-ups from accumulated XP
- Immigration wave check (based on fortress wealth/fame)
- Faction standing drifts
- Disease spread between tiles
- Ruins decay (remaining_wealth, ghost_count)
- Snapshot serialization

### Persistence
Every sim step writes changed state to Supabase. Do not batch writes aggressively at the cost of data loss — if the server dies, the player should lose at most one step of progress.

---

## 6. UI DESIGN

### Visual Style
ASCII / classic Dwarf Fortress. Color carries meaning — stress, threat level, danger — not decoration.

### Panning & Rendering Rules
Both map modes are larger than the viewport and require panning. These rules must be followed from day one — they are very hard to retrofit:

- **Keyboard panning:** Arrow keys or numpad move the viewport across the tile grid.
- **Click-drag panning:** Click and drag the map to pan. Mouse does double duty — hover to inspect a tile, click-drag to pan, single click to select/interact.
- **Snap to character grid:** Panning and zooming must always snap to character grid boundaries. Rendering a tile at a fractional character offset breaks the ASCII grid visually. The renderer must only ever translate by whole character widths/heights.
- **World map minimap:** A small minimap in a corner of the world map shows the player's current viewport position within the full 512×512. Without this the world map is disorienting.
- **World map zoom:** At least two zoom levels on the world map. Zoomed out — small glyphs, wide view. Zoomed in — larger glyphs, more detail rendered per tile (danger level on ruins, monster icons, faction colors). Zoom snaps to grid.
- **Local map zoom:** Optional but useful. Zooming in on the local fortress map makes individual tiles easier to click and inspect.
- **Cursor always visible:** The hover cursor (highlighted tile) must remain visible and accurate at all zoom/pan states.

### Layout
Three-panel, full viewport, no page scroll:

```
┌─────────────────────────────────────────────────────────────┐
│  TOOLBAR: world year | civ name | pop | wealth | alerts     │
├───────────────┬─────────────────────────┬───────────────────┤
│               │                         │                   │
│  LEFT PANEL   │      MAIN VIEWPORT      │   RIGHT PANEL     │
│  (context)    │    (ASCII map/world)    │   (detail/log)    │
│               │                         │                   │
├───────────────┴─────────────────────────┴───────────────────┤
│  BOTTOM BAR: hovered tile info | keybind hints              │
└─────────────────────────────────────────────────────────────┘
```

Main viewport = ~60% width. Panels are collapsible for near-fullscreen map.

### Fortress Mode (local map)
- ASCII tile grid with z-level navigation (`<` `>` or scroll)
- Tile glyphs: `.` floor, `#` wall, `≈` water, `▲` stair up, `▼` stair down
- Dwarves = `@`, monsters = letter (D dragon, B beast, etc.)
- **Left panel:** Dwarf roster, color-coded by stress. Click → needs/skills/relationships/task. Filter by job/status/faction.
- **Right panel:** Activity log (dense, specific, auto-scrolling). Tabs: stockpile view, structure list, labor assignments.
- **Bottom bar:** Tile under cursor info + current mode + keybind hint.

### World Map Mode (512×512)
- Terrain glyphs: `^` mountain, `♣` forest, `~` ocean, `░` plains, `≡` desert, `*` tundra
- Player fortress = `Ω`. Player's own past ruins = `†`. Monsters = letter with threat color (green→yellow→red).
- **Left panel:** Hovered tile info (terrain, biome, elevation). Nearby ruins list with danger + cause of death. Active monster sightings.
- **Right panel:** Legends log (world events, filterable). Tab: Graveyard (browse published ruins from all players).

### UI Rules
- No modals. Everything opens in panels — map always visible.
- Hover/click anything → right panel populates with detail immediately.
- The activity log should feel like DF's combat log: dense, specific, slightly literary.
- Color is semantic: white → yellow → red for stress/danger. Sickly green for contaminated ruins.

---

## 7. PLAYER ACTIONS

### Fortress Mode
- Designate tiles (dig, build, stockpile zones)
- Assign labors per dwarf
- Set work orders (craft queue, material/quality spec)
- Manage stockpile categories
- View dwarf sheet (needs, skills, memories, relationships, injuries)
- Set burrow / raise alert level
- Assign military squads, set patrol routes
- Interact with arriving trade caravan

### World Map Mode
- Scout a tile (send dwarves to reveal terrain/ruin info)
- Launch expedition into a ruin (your own past ruins or published ruins from the graveyard)
- View legends (history of any tile, civ, dwarf, or monster in your world)
- Browse the graveyard (other players' published ruins — read their history, launch expeditions)

### Meta / Persistent
- Read epitaph after fortress falls
- Choose to publish your ruin to the global graveyard
- Start a new fortress in the same world (old ruin visible on your map)
- Browse your own graveyard of past fortresses

---

## 8. SCAFFOLDING INSTRUCTIONS

Before writing any feature code, do the following in order:

1. **Scaffold the repo** — monorepo with `/app` (React frontend) and `/sim` (headless Node.js simulation engine). Shared types in `/shared`.
2. **Apply the schema** to Supabase, including the `is_published` column on `ruins`. Verify all tables, enums, indexes, RLS policies, and stored procedures are present.
3. **Stub the sim engine** — a sim loop runner with each phase as an empty function with a comment describing what it will do. Expose tick rate as a named constant. No logic yet, just the skeleton.
4. **Stub the frontend** — shell with the three-panel layout, two modes (fortress/world map), toolbar, and bottom bar. No real data yet, just the chrome. Panning and grid-snapped rendering must be wired up at this stage — do not defer.
5. **Wire Supabase auth** — login/signup, player profile creation on first login, world generation on first login.
6. **Wire Supabase Realtime** — frontend subscribes to relevant table changes from the start. Do not use polling.
7. **Confirm the architecture is clean** before proceeding — sim code must have zero browser/React dependencies. Frontend must have zero direct simulation logic.

Only after all seven steps are confirmed working should you begin implementing actual features, starting with world generation and the local fortress map.

---

## 9. WHAT NOT TO DO

- Do not put simulation logic in React components or hooks.
- Do not put rendering or DOM logic in the sim engine.
- Do not use localStorage for game state — everything persists in Supabase.
- Do not skip the RLS policies — the schema includes them for a reason.
- Do not build features out of order. World gen and local fortress map first. Graveyard/expedition features come after the core loop works.
- Do not use polling to update the UI — use Supabase Realtime subscriptions.
- Do not render tiles at fractional character offsets — always snap to the character grid.
- Do not hardcode sim speed — use named constants so it can be tuned easily.
