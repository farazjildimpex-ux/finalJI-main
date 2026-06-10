ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS follow_up_sort_order integer;

COMMENT ON COLUMN journal_entries.follow_up_sort_order IS 'User-defined order for active follow-up entries (lower = higher priority).';
