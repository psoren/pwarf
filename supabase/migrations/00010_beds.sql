-- Add position and occupancy columns to structures
alter table structures
  add column position_x int,
  add column position_y int,
  add column position_z int,
  add column occupied_by_dwarf_id uuid references dwarves(id) on delete set null;

-- Add 'build_bed' to task_type enum
alter type task_type add value if not exists 'build_bed';

-- Add 'bed' to fortress_tile_type enum
alter type fortress_tile_type add value if not exists 'bed';
