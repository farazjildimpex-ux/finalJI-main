/*
  # Fix samples table RLS policies

  1. Changes
    - Drop existing RLS policies for samples table
    - Create new RLS policies that properly handle all operations
    
  2. Security
    - Enable RLS on samples table
    - Add policies for all CRUD operations
    - Ensure authenticated users can perform all operations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to delete samples" ON samples;
DROP POLICY IF EXISTS "Allow authenticated users to insert samples" ON samples;
DROP POLICY IF EXISTS "Allow authenticated users to read samples" ON samples;
DROP POLICY IF EXISTS "Allow authenticated users to update samples" ON samples;

-- Create new comprehensive policy
CREATE POLICY "Enable all operations for authenticated users only"
ON public.samples
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);