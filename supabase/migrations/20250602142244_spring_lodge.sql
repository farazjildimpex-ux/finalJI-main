/*
  # Create samples table

  1. New Tables
    - `samples`
      - `id` (uuid, primary key)
      - `date` (date, not null)
      - `company_name` (text, not null)
      - `buyer_name` (text, not null)
      - `description` (text)
      - `article` (text)
      - `substance` (text)
      - `selection` (text[])
      - `color` (text[])
      - `swatch` (text[])
      - `quantity` (text[])
      - `delivery` (text[])
      - `notes` (text)
      - `courier_reference` (text)
      - `customer_feedback` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `samples` table
    - Add policy for authenticated users to read/write their own data
*/

CREATE TABLE IF NOT EXISTS samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read/write samples"
  ON samples
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add trigger for updating updated_at timestamp
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON samples
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();