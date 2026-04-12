/*
  # Fix contract files RLS policies

  1. Security Updates
    - Update RLS policies for contract_files table to properly handle file uploads
    - Ensure policies work with Supabase auth.uid() function
    - Fix INSERT policy to allow authenticated users to upload files

  2. Changes
    - Drop existing policies that may be causing conflicts
    - Create new policies with correct auth.uid() references
    - Ensure all CRUD operations work properly for authenticated users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload contract files" ON contract_files;
DROP POLICY IF EXISTS "Authenticated users can view contract files" ON contract_files;
DROP POLICY IF EXISTS "Authenticated users can update their contract files" ON contract_files;
DROP POLICY IF EXISTS "Authenticated users can delete their contract files" ON contract_files;

-- Create new policies with proper auth.uid() usage
CREATE POLICY "Enable insert for authenticated users" ON contract_files
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Enable select for authenticated users" ON contract_files
  FOR SELECT TO authenticated
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Enable update for authenticated users" ON contract_files
  FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Enable delete for authenticated users" ON contract_files
  FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by);