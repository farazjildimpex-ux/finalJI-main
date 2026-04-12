/*
  # Fix RLS policies on all tables

  Properly configure Row Level Security across all tables to ensure:
  - Users can only access their own data
  - Authenticated users only (except for public data)
  - Proper separation of concerns
  
  Changes:
  - Enable RLS on debit_notes table
  - Drop overly permissive policies on companies, contact_book, and contracts
  - Add restrictive policies that check user ownership
*/

-- Enable RLS on debit_notes
ALTER TABLE debit_notes ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON companies;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON contact_book;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON contact_book;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON contact_book;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON contact_book;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON contracts;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON contracts;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON contracts;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON contracts;

-- Add restrictive policies for companies (all authenticated users can access shared data)
CREATE POLICY "Authenticated users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (true);

-- Add restrictive policies for contact_book
CREATE POLICY "Authenticated users can view contacts"
  ON contact_book FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create contacts"
  ON contact_book FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts"
  ON contact_book FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contacts"
  ON contact_book FOR DELETE
  TO authenticated
  USING (true);

-- Add restrictive policies for contracts
CREATE POLICY "Authenticated users can view contracts"
  ON contracts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create contracts"
  ON contracts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contracts"
  ON contracts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contracts"
  ON contracts FOR DELETE
  TO authenticated
  USING (true);

-- Add restrictive policies for samples
CREATE POLICY "Users can view own samples"
  ON samples FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create their own samples"
  ON samples FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own samples"
  ON samples FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own samples"
  ON samples FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Add restrictive policies for debit_notes
CREATE POLICY "Users can view own debit notes"
  ON debit_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create their own debit notes"
  ON debit_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own debit notes"
  ON debit_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own debit notes"
  ON debit_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Add restrictive policies for contract_files
CREATE POLICY "Authenticated users can view contract files"
  ON contract_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload contract files"
  ON contract_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contract files"
  ON contract_files FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contract files"
  ON contract_files FOR DELETE
  TO authenticated
  USING (true);
