/*
  # Recreate Samples Table with Updated Fields and RLS

  1. Changes
    - Drop existing samples table
    - Recreate samples table with all required fields
    - Add sample_number and status fields
    - Set up proper RLS policies

  2. New Fields
    - sample_number (text, required)
    - status (text, default 'Issued')

  3. Security
    - Enable RLS on samples table
    - Add policies for all CRUD operations for authenticated users
*/

-- Drop existing table
DROP TABLE IF EXISTS samples;

-- Create new samples table with updated fields
CREATE TABLE samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  sample_number text NOT NULL,
  company_name text NOT NULL,
  buyer_name text NOT NULL,
  description text,
  article text,
  substance text,
  selection text[] DEFAULT ARRAY[]::text[],
  color text[] DEFAULT ARRAY[]::text[],
  swatch text[] DEFAULT ARRAY[]::text[],
  quantity text[] DEFAULT ARRAY[]::text[],
  delivery text[] DEFAULT ARRAY[]::text[],
  notes text,
  courier_reference text,
  customer_feedback text,
  status text NOT NULL DEFAULT 'Issued',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT samples_status_check CHECK (status IN ('Issued', 'Completed'))
);

-- Enable RLS
ALTER TABLE samples ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable all operations for authenticated users" ON samples
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON samples
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();