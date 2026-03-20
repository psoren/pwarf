-- ============================================================
-- CRAFTING TASK TYPES
-- Adds brew, cook, smith, smooth, and engrave task types
-- ============================================================

ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'smooth';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'engrave';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'brew';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'cook';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'smith';
