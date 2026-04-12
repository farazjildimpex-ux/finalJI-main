/*
  # Update RLS policies for samples table

  1. Changes
    - Add INSERT policy for authenticated users
    - Ensure consistent policy naming
    - Maintain existing policies

  2. Security
    - Enable RLS on samples table (if not already enabled)
    - Add policy for authenticated users to insert new samples
    - Maintain existing policies for other operations
*/

-- First ensure RLS is enabled
ALTER TABLE samples ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Allow authenticated insert" ON samples;

-- Create new INSERT policy
CREATE POLICY "Allow authenticated insert"
ON samples
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Note: Existing policies for SELECT, UPDATE, and DELETE are already in place
-- and working correctly, so we don't need to modify them