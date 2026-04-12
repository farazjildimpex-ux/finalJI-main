/*
  # Add linked_contracts column to contract_files table

  1. Changes
    - Add `linked_contracts` column to store array of contract IDs that share this file
    - This allows multiple contracts to reference the same file without duplicating storage

  2. Security
    - No changes to RLS policies needed
    - Existing policies will continue to work
*/

-- Add linked_contracts column to track which contracts share this file
ALTER TABLE contract_files 
ADD COLUMN IF NOT EXISTS linked_contracts text[] DEFAULT ARRAY[]::text[];

-- Create index for better performance when querying linked contracts
CREATE INDEX IF NOT EXISTS idx_contract_files_linked_contracts 
ON contract_files USING GIN (linked_contracts);