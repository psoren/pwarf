-- Add create_artifact to task_type enum for strange mood artifact creation
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'create_artifact';
