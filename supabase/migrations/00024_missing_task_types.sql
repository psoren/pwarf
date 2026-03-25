-- Add task_type enum values that exist in TypeScript but were never migrated.
-- These types have been silently failing on insert because the enum didn't include them.

ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'build_well';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'build_mushroom_garden';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'build_door';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'deconstruct';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'forage';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'scout_cave';
