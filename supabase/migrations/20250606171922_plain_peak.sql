/*
  # Create companies table

  1. New Tables
    - `companies`
      - `id` (uuid, primary key)
      - `name` (text, not null, unique)
      - `address` (text[], not null)
      - `phone` (text)
      - `email` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `companies` table
    - Add policies for authenticated users to read/write companies
*/

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  address text[] NOT NULL DEFAULT ARRAY[]::text[],
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users"
  ON companies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for authenticated users"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users"
  ON companies
  FOR DELETE
  TO authenticated
  USING (true);

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Insert default companies
INSERT INTO companies (name, address, phone, email) VALUES
('JILD IMPEX', ARRAY['New No:11, Old No:698, First Street', 'Anna Nagar West Extension', 'Chennai - 600101, Tamil Nadu, India'], '+91 98410 91189', 'office@jildimpex.com'),
('Company A', ARRAY['123 Business Street', 'Business District', 'City - 123456'], '+91 98765 43210', 'contact@companya.com'),
('Company B', ARRAY['456 Trade Avenue', 'Commercial Zone', 'Metro City - 654321'], '+91 87654 32109', 'info@companyb.com')
ON CONFLICT (name) DO NOTHING;