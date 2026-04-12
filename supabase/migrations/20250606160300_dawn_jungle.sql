/*
  # Fix Storage RLS Policies for File Upload

  This migration creates proper RLS policies for:
  1. contract_files table - to allow authenticated users to manage file metadata
  2. storage.objects table - to allow authenticated users to upload/download files in contract-files bucket

  ## Changes Made
  1. Create RLS policies for contract_files table operations
  2. Create RLS policies for storage.objects table for contract-files bucket
  3. Ensure the contract-files storage bucket exists

  ## Security Notes
  - These policies allow all authenticated users to perform operations
  - In production, consider more restrictive policies based on user ownership
*/

-- Ensure RLS is enabled on contract_files table
ALTER TABLE public.contract_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow all reads for authenticated users" ON public.contract_files;
DROP POLICY IF EXISTS "Allow all inserts for authenticated users" ON public.contract_files;
DROP POLICY IF EXISTS "Allow all updates for authenticated users" ON public.contract_files;
DROP POLICY IF EXISTS "Allow all deletes for authenticated users" ON public.contract_files;

-- Create RLS policies for contract_files table
CREATE POLICY "Allow all reads for authenticated users" 
  ON public.contract_files 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow all inserts for authenticated users" 
  ON public.contract_files 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Allow all updates for authenticated users" 
  ON public.contract_files 
  FOR UPDATE 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow all deletes for authenticated users" 
  ON public.contract_files 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Ensure the contract-files bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-files', 'contract-files', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow all reads in contract-files bucket for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads in contract-files bucket for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Allow all updates in contract-files bucket for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Allow all deletes in contract-files bucket for authenticated users" ON storage.objects;

-- Create RLS policies for storage.objects table (contract-files bucket)
CREATE POLICY "Allow all reads in contract-files bucket for authenticated users" 
  ON storage.objects 
  FOR SELECT 
  TO authenticated 
  USING (bucket_id = 'contract-files');

CREATE POLICY "Allow all uploads in contract-files bucket for authenticated users" 
  ON storage.objects 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (bucket_id = 'contract-files');

CREATE POLICY "Allow all updates in contract-files bucket for authenticated users" 
  ON storage.objects 
  FOR UPDATE 
  TO authenticated 
  USING (bucket_id = 'contract-files');

CREATE POLICY "Allow all deletes in contract-files bucket for authenticated users" 
  ON storage.objects 
  FOR DELETE 
  TO authenticated 
  USING (bucket_id = 'contract-files');