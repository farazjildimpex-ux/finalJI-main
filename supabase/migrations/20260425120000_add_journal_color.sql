-- Add optional color field to journal entries for grid card backgrounds
ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS color text;

COMMENT ON COLUMN journal_entries.color IS 'Optional background color (hex or palette key) chosen by user for the journal card.';
