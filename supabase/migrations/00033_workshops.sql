-- Add workshop task types
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'build_still';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'build_kitchen';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'build_forge';

-- Add workshop tile types
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'still';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'kitchen';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'forge';
