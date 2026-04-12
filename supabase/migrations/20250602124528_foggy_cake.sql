/*
  # Add status column to contracts table

  1. Changes
    - Add 'status' column to contracts table with type text
    - Set default value to 'Issued'
    - Add check constraint to ensure only valid statuses are used

  2. Security
    - No changes to RLS policies needed
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contracts' AND column_name = 'status'
  ) THEN
    ALTER TABLE contracts 
    ADD COLUMN status text NOT NULL DEFAULT 'Issued'
    CHECK (status IN ('Issued', 'Inspected', 'Completed'));
  END IF;
END $$;