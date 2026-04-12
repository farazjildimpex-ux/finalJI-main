/*
  # Fix Row Level Security for samples table

  1. Changes
    - Drop existing RLS policy for samples table
    - Create new RLS policies for samples table with proper authentication checks
    
  2. Security
    - Enable RLS on samples table (already enabled)
    - Add policies for authenticated users to:
      - Read all samples
      - Insert new samples
      - Update existing samples
      - Delete samples
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON "public"."samples";

-- Create new policies
CREATE POLICY "Allow authenticated users to read samples"
ON "public"."samples"
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert samples"
ON "public"."samples"
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update samples"
ON "public"."samples"
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete samples"
ON "public"."samples"
FOR DELETE
TO authenticated
USING (true);