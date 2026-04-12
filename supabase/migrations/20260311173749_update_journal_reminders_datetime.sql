/*
  # Update Journal Entries for DateTime Reminders

  1. Changes
    - Rename reminder_type to reminder_date (to store actual date)
    - Add reminder_time column (to store time of reminder)
    - Store reminder as specific date+time instead of 'on_day' or 'day_before'

  2. New Columns
    - `reminder_date` (date, nullable) - The date when reminder should trigger
    - `reminder_time` (time, nullable) - The time when reminder should trigger

  3. Migration Plan
    - Drop the old reminder_type column if it exists
    - Add new reminder_date and reminder_time columns
*/

DO $$
BEGIN
  -- Check if reminder_type column exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'reminder_type'
  ) THEN
    ALTER TABLE journal_entries DROP COLUMN reminder_type;
  END IF;
  
  -- Add reminder_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'reminder_date'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN reminder_date date;
  END IF;
  
  -- Add reminder_time column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'reminder_time'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN reminder_time time;
  END IF;
END $$;
