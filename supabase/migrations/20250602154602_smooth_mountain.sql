/*
  # Update RLS policies for samples table

  1. Security Changes
    - Enable RLS on samples table (if not already enabled)
    - Add policy for authenticated users to insert new samples
    - Add policy for authenticated users to update existing samples
    - Add policy for authenticated users to read samples
    - Add policy for authenticated users to delete samples

  Note: This migration provides complete CRUD access to authenticated users while maintaining security by preventing unauthorized access.
*/

-- Enable RLS on samples table (idempotent operation)
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Enable all operations for authenticated users only" ON public.samples;
    DROP POLICY IF EXISTS "Allow authenticated insert" ON public.samples;
    DROP POLICY IF EXISTS "Allow authenticated update" ON public.samples;
    DROP POLICY IF EXISTS "Allow authenticated select" ON public.samples;
    DROP POLICY IF EXISTS "Allow authenticated delete" ON public.samples;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Create comprehensive policies for authenticated users
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

CREATE POLICY "Allow authenticated select"
ON public.samples
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated delete"
ON public.samples
FOR DELETE
TO authenticated
USING (true);