-- Add review tracking columns to bug reports
ALTER TABLE bug_reports
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN classification TEXT;
