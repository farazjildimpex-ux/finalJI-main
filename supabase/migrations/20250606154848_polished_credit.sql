/*
  # Fix contract_files RLS policies

  1. Security Updates
    - Drop existing RLS policies that use incorrect uid() function
    - Create new RLS policies using correct auth.uid() function
    - Ensure authenticated users can manage their own uploaded files

  2. Changes
    - Replace uid() with auth.uid() in all RLS policies
    - Maintain same security model where users can only access files they uploaded
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON contract_files;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON contract_files;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON contract_files;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON contract_files;

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