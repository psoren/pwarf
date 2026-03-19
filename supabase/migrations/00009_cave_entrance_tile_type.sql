-- Add cave_entrance tile type to fortress_tile_type enum (issue #255)
alter type fortress_tile_type add value if not exists 'cave_entrance';
