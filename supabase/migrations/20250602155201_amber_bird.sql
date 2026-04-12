/*
  # Set up RLS policies for samples table

  1. Security Changes
    - Enable RLS on samples table
    - Create separate policies for each operation (SELECT, INSERT, UPDATE, DELETE)
    - Restrict access to authenticated users only
    - Ensure proper access control for all operations

  2. Changes
    - Drop any existing policies to avoid conflicts
    - Create new granular policies for each operation
    - Maintain data integrity and security
*/

-- Enable RLS on samples table
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.samples;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.samples;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.samples;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.samples;

-- Create separate policies for each operation
CREATE POLICY "Allow authenticated select"
ON public.samples
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert"
ON public.samples
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update"
ON public.samples
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete"
ON public.samples
FOR DELETE
TO authenticated
USING (true);