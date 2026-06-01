ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS follow_up_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS follow_up_completed_at timestamptz;

COMMENT ON COLUMN journal_entries.follow_up_required IS 'Keeps a journal entry visible in the follow-up area until completed.';
COMMENT ON COLUMN journal_entries.follow_up_completed_at IS 'Timestamp when the follow-up was completed.';
