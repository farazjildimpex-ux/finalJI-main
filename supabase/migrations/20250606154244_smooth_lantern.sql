/*
  # Fix contract_files RLS policies

  1. Security Changes
    - Drop existing RLS policies that use incorrect `uid()` function
    - Create new RLS policies using correct `auth.uid()` function
    - Ensure authenticated users can insert, select, update, and delete their own files

  2. Policy Details
    - INSERT: Allow authenticated users to insert files where uploaded_by matches their user ID
    - SELECT: Allow authenticated users to read files they uploaded
    - UPDATE: Allow authenticated users to update files they uploaded  
    - DELETE: Allow authenticated users to delete files they uploaded
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON contract_files;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON contract_files;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON contract_files;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON contract_files;

-- Create new policies with correct auth.uid() function
CREATE POLICY "Enable insert for authenticated users"
  ON contract_files
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Enable select for authenticated users"
  ON contract_files
  FOR SELECT
  TO authenticated
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Enable update for authenticated users"
  ON contract_files
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Enable delete for authenticated users"
  ON contract_files
  FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);