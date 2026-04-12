/*
  # Fix contract_files RLS policies

  1. Security Changes
    - Drop existing RLS policies on contract_files table
    - Create new RLS policies using correct auth.uid() function
    - Ensure authenticated users can manage their own uploaded files

  2. Policy Details
    - SELECT: Users can read files they uploaded
    - INSERT: Users can insert files with their user_id
    - UPDATE: Users can update files they uploaded  
    - DELETE: Users can delete files they uploaded
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable select for authenticated users" ON contract_files;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON contract_files;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON contract_files;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON contract_files;

-- Create new policies with correct auth.uid() function
CREATE POLICY "Users can read their uploaded files"
  ON contract_files
  FOR SELECT
  TO authenticated
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can insert files"
  ON contract_files
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their uploaded files"
  ON contract_files
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their uploaded files"
  ON contract_files
  FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);