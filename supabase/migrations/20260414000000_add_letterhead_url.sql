/*
  # Add letterhead_url to companies table

  1. Changes
    - Add `letterhead_url` column to companies table to store the path to the company's letterhead .docx template
    - Add `letterhead_name` column to store the original filename for display

  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'letterhead_url'
  ) THEN
    ALTER TABLE companies ADD COLUMN letterhead_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'letterhead_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN letterhead_name text;
  END IF;
END $$;
