-- ============================================================
-- Stockpile category filtering and priority (issue #219)
-- ============================================================

-- Add accepts_categories: which item categories this stockpile accepts.
-- NULL means it accepts all categories (the default behaviour).
alter table stockpile_tiles
  add column if not exists accepts_categories text[] default null;

-- Add priority: higher value = preferred over lower-priority stockpiles
-- when multiple tiles have available capacity.
alter table stockpile_tiles
  add column if not exists priority smallint not null default 0;
