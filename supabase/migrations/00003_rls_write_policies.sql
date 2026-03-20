-- ============================================================
-- Missing RLS write policies (applied via MCP, now tracked)
-- ============================================================

-- Players can create their own profile on signup
create policy "players insert own profile"
  on players for insert with check (id = auth.uid());

-- Authenticated users can create worlds
create policy "authenticated users create worlds"
  on worlds for insert with check (auth.role() = 'authenticated');

-- Authenticated users can update their own worlds (for age_years etc)
create policy "players update own worlds"
  on worlds for update using (
    id in (select world_id from players where id = auth.uid())
  );

-- Authenticated users can insert world tiles (during world gen)
create policy "authenticated users create world_tiles"
  on world_tiles for insert with check (auth.role() = 'authenticated');

-- Players can manage items in their own civilizations
create policy "players manage own items"
  on items for all using (
    located_in_civ_id in (select id from civilizations where player_id = auth.uid())
  );

-- Players can manage structures in their own civilizations
create policy "players manage own structures"
  on structures for all using (
    civilization_id in (select id from civilizations where player_id = auth.uid())
  );

-- Players can insert world events for their own civilizations
create policy "players create own events"
  on world_events for insert with check (
    civilization_id in (select id from civilizations where player_id = auth.uid())
  );

-- Players can manage dwarf skills for their own dwarves
create policy "players manage own dwarf_skills"
  on dwarf_skills for all using (
    dwarf_id in (
      select d.id from dwarves d
      join civilizations c on c.id = d.civilization_id
      where c.player_id = auth.uid()
    )
  );

-- Players can manage dwarf relationships for their own dwarves
create policy "players manage own dwarf_relationships"
  on dwarf_relationships for all using (
    dwarf_a_id in (
      select d.id from dwarves d
      join civilizations c on c.id = d.civilization_id
      where c.player_id = auth.uid()
    )
  );
