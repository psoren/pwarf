-- Add new idle task types to the task_type enum
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'socialize';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'rest';
