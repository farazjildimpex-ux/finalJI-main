/*
  # Update RLS policies for samples table

  1. Changes
    - Drop existing RLS policies for samples table
    - Add new comprehensive RLS policies for all operations
    
  2. Security
    - Enable RLS on samples table
    - Add policies for:
      - Insert: Allow authenticated users to insert new samples
      - Select: Allow authenticated users to read all samples
      - Update: Allow authenticated users to update any sample
      - Delete: Allow authenticated users to delete any sample
    
  3. Notes
    - All operations require authentication
    - No row-level restrictions based on user ID
    - Policies are permissive by default
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated delete" ON samples;
DROP POLICY IF EXISTS "Allow authenticated insert" ON samples;
DROP POLICY IF EXISTS "Allow authenticated select" ON samples;
DROP POLICY IF EXISTS "Allow authenticated update" ON samples;

-- Create new comprehensive policies
CREATE POLICY "Enable read access for authenticated users" ON samples
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON samples
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON samples
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON samples
  FOR DELETE TO authenticated
  USING (true);