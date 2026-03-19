-- ============================================================
-- BUILD TASK TYPES
-- Adds build_wall, build_floor, and stair task types
-- ============================================================

alter type task_type add value 'build_wall';
alter type task_type add value 'build_floor';
alter type task_type add value 'build_stairs_up';
alter type task_type add value 'build_stairs_down';
alter type task_type add value 'build_stairs_both';
