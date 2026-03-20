-- Allow players to insert ruin records for their own fallen civilizations
-- (used by the sim when a fortress falls — fossilization).
create policy "players manage own ruins"
  on ruins for all
  using (
    civilization_id in (
      select id from civilizations where player_id = auth.uid()
    )
  );
