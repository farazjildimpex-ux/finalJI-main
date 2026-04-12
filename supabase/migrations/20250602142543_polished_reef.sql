/*
  # Add sample number to contracts table

  1. Changes
    - Add `sample_number` column to `contracts` table
    - Create new `contract_samples` table for tracking samples

  2. New Tables
    - `contract_samples`
      - `id` (uuid, primary key)
      - `contract_id` (uuid, foreign key to contracts)
      - `sample_number` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  3. Security
    - Enable RLS on `contract_samples` table
    - Add policy for authenticated users to perform all operations
*/

-- Add sample_number to contracts table
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS sample_number text;

-- Create contract_samples table
CREATE TABLE IF NOT EXISTS contract_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  sample_number text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE contract_samples ENABLE ROW LEVEL SECURITY;

-- Add RLS policy
CREATE POLICY "Enable all operations for authenticated users" ON contract_samples
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON contract_samples
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();