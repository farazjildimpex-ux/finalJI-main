/*
  # Create samples table with proper RLS

  1. New Tables
    - `samples`
      - `id` (uuid, primary key)
      - `sample_number` (text, not null)
      - `date` (date, not null)
      - `status` (text, not null)
      - `company_name` (text, not null)
      - `supplier_name` (text, not null)
      - `supplier_address` (text[], not null)
      - `description` (text)
      - `article` (text)
      - `size` (text)
      - `substance` (text)
      - `selection` (text[])
      - `color` (text[])
      - `swatch` (text[])
      - `quantity` (text[])
      - `delivery` (text[])
      - `notes` (text)
      - `shipment_reference` (text[])
      - `customer_comments` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create samples table
CREATE TABLE samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_number text NOT NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'Issued',
  company_name text NOT NULL,
  supplier_name text NOT NULL,
  supplier_address text[] NOT NULL DEFAULT ARRAY[]::text[],
  description text,
  article text,
  size text,
  substance text,
  selection text[] DEFAULT ARRAY[]::text[],
  color text[] DEFAULT ARRAY[]::text[],
  swatch text[] DEFAULT ARRAY[]::text[],
  quantity text[] DEFAULT ARRAY[]::text[],
  delivery text[] DEFAULT ARRAY[]::text[],
  notes text,
  shipment_reference text[] DEFAULT ARRAY[]::text[],
  customer_comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT samples_status_check CHECK (status IN ('Issued', 'Completed'))
);

-- Enable RLS
ALTER TABLE samples ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow authenticated select"
ON samples
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert"
ON samples
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update"
ON samples
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete"
ON samples
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON samples
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();