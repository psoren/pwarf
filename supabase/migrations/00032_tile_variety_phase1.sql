-- Add Phase 1 tile variety types
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'flower';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'spring';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'crystal';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'glowing_moss';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'fungal_growth';
