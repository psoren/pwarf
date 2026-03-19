-- Add well and mushroom_garden to fortress_tile_type enum
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'well';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'mushroom_garden';

-- Add wander to task_type enum
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'wander';
