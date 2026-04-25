/*
  # Create invoices table

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, not null)
      - `invoice_number` (text, not null)
      - `invoice_date` (date)
      - `contract_numbers` (text[]) - one invoice can be linked to many contracts
      - `line_items` (jsonb) - array of {color, selection, quantity}
      - `price_adjustment` (text)
      - `invoice_value` (text)
      - `notes` (text)
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Authenticated users can manage their own invoices

  3. Indexes
    - Index on user_id
    - GIN index on contract_numbers for fast contract lookup
*/

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  invoice_date date,
  contract_numbers text[] DEFAULT ARRAY[]::text[],
  line_items jsonb DEFAULT '[]'::jsonb,
  price_adjustment text,
  invoice_value text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract_numbers ON invoices USING GIN(contract_numbers);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
CREATE POLICY "Users can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own invoices" ON invoices;
CREATE POLICY "Users can create their own invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;
CREATE POLICY "Users can update their own invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own invoices" ON invoices;
CREATE POLICY "Users can delete their own invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS handle_invoices_updated_at ON invoices;
CREATE TRIGGER handle_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
