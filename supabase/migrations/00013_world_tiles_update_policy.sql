-- Allow authenticated users to update world tiles (needed for upsert during embark)
create policy "authenticated users update world_tiles"
  on world_tiles for update using (auth.role() = 'authenticated');
