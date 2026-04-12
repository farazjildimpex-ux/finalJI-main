/*
  # Add timestamps for todo completion tracking

  1. New Columns
    - `completed_at` (timestamptz) - when the todo was completed
    - `hidden_at` (timestamptz) - when the todo should be hidden (24hrs after completion)

  2. Changes
    - Add columns to track when completed items should be auto-hidden after 24 hours
    - Completed items remain searchable and visible as completed until hidden
    - After 24 hours, completed items are no longer visible in the todo list
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'todos' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE todos ADD COLUMN completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'todos' AND column_name = 'hidden_at'
  ) THEN
    ALTER TABLE todos ADD COLUMN hidden_at timestamptz;
  END IF;
END $$;