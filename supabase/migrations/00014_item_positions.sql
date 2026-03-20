-- Add world position columns to items (for ground-dropped items and stockpile positions)
alter table items
  add column if not exists position_x int,
  add column if not exists position_y int,
  add column if not exists position_z int;
