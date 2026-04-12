/*
  # Fix RLS policies for samples table

  1. Changes
    - Drop existing RLS policies for samples table
    - Create new comprehensive RLS policies for all operations
    
  2. Security
    - Enable RLS on samples table (already enabled)
    - Add policies for:
      - INSERT: Allow authenticated users to insert new samples
      - SELECT: Allow authenticated users to read all samples
      - UPDATE: Allow authenticated users to update any sample
      - DELETE: Allow authenticated users to delete any sample
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON samples;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON samples;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON samples;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON samples;

-- Create new comprehensive policies
CREATE POLICY "Enable full access for authenticated users"
ON samples
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create policy for public read access
CREATE POLICY "Enable read access for public"
ON samples
FOR SELECT
TO public
USING (true);