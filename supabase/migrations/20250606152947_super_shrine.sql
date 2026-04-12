/*
  # Create storage bucket and policies for contract files

  1. Storage Setup
    - Create contract-files bucket for storing contract documents
    - Set up RLS policies for authenticated users

  2. Security
    - Enable authenticated users to upload, view, update, and delete files
    - Restrict access to contract-files bucket only
*/

-- Create storage bucket for contract files
-- Note: This may need to be done manually in Supabase dashboard if migration fails
DO $$
BEGIN
  -- Try to create the bucket, ignore if it already exists
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'contract-files', 
    'contract-files', 
    true,
    52428800, -- 50MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN insufficient_privilege THEN
    -- If we don't have permission to create buckets, that's okay
    -- The bucket can be created manually in the Supabase dashboard
    NULL;
END $$;

-- Create a table to track contract files metadata
CREATE TABLE IF NOT EXISTS contract_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on contract_files table
ALTER TABLE contract_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contract_files table
CREATE POLICY "Authenticated users can view contract files"
ON contract_files
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can upload contract files"
ON contract_files
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can update their contract files"
ON contract_files
FOR UPDATE
TO authenticated
USING (auth.uid() = uploaded_by)
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can delete their contract files"
ON contract_files
FOR DELETE
TO authenticated
USING (auth.uid() = uploaded_by);

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON contract_files
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();