/*
  # Add user_id column to samples table

  1. Changes
    - Add user_id column to samples table
    - Update RLS policies to use user_id for access control

  2. Security
    - Enable RLS on samples table
    - Add policies for authenticated users to access their own data
*/

-- Add user_id column
ALTER TABLE samples ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON samples;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON samples;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON samples;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON samples;

-- Create new policies based on user_id
CREATE POLICY "Enable read access for authenticated users"
ON samples FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Enable insert access for authenticated users"
ON samples FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update access for authenticated users"
ON samples FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete access for authenticated users"
ON samples FOR DELETE
TO authenticated
USING (auth.uid() = user_id);