-- Add idle behavior task types (socialize, rest)
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'socialize';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'rest';
