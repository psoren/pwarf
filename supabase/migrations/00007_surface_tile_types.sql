-- Add surface feature tile types to fortress_tile_type enum (issue #226)
alter type fortress_tile_type add value if not exists 'grass';
alter type fortress_tile_type add value if not exists 'tree';
alter type fortress_tile_type add value if not exists 'rock';
alter type fortress_tile_type add value if not exists 'bush';
alter type fortress_tile_type add value if not exists 'pond';
