/*
  # Update RLS policies for samples table

  1. Changes
    - Drop existing RLS policy that's not working correctly
    - Add separate policies for each operation (SELECT, INSERT, UPDATE, DELETE)
    - Ensure authenticated users can perform all operations on samples
  
  2. Security
    - Maintain RLS enabled on samples table
    - Grant full access to authenticated users only
    - Prevent unauthorized access to sample data
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can read/write samples" ON samples;

-- Create new specific policies for each operation
CREATE POLICY "Enable read access for authenticated users" ON samples
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON samples
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON samples
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON samples
  FOR DELETE
  TO authenticated
  USING (true);