/*
  # Create debit notes table

  1. New Tables
    - `debit_notes`
      - `id` (uuid, primary key)
      - `debit_note_no` (text, not null)
      - `debit_note_date` (text, not null)
      - `status` (text, not null, default 'Issued')
      - `supplier_name` (text, not null)
      - `supplier_address` (text[], not null)
      - `contract_no` (text, not null)
      - `buyer_name` (text, not null)
      - `invoice_no` (text, not null)
      - `quantity` (text, not null)
      - `pieces` (text, not null)
      - `destination` (text, not null)
      - `local_commission` (text, not null)
      - `invoice_value` (text, not null)
      - `commissioning` (numeric, not null)
      - `exchange_rate` (numeric, not null)
      - `commission_in_rupees` (numeric, not null)
      - `commission_in_words` (text, not null)
      - `user_id` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `debit_notes` table
    - Add policies for authenticated users to access their own data
*/

CREATE TABLE IF NOT EXISTS debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debit_note_no text NOT NULL,
  debit_note_date text NOT NULL,
  status text NOT NULL DEFAULT 'Issued',
  supplier_name text NOT NULL,
  supplier_address text[] NOT NULL DEFAULT ARRAY[]::text[],
  contract_no text NOT NULL,
  buyer_name text NOT NULL,
  invoice_no text NOT NULL,
  quantity text NOT NULL,
  pieces text NOT NULL,
  destination text NOT NULL,
  local_commission text NOT NULL,
  invoice_value text NOT NULL,
  commissioning numeric NOT NULL DEFAULT 0,
  exchange_rate numeric NOT NULL DEFAULT 0,
  commission_in_rupees numeric NOT NULL DEFAULT 0,
  commission_in_words text NOT NULL DEFAULT '',
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT debit_notes_status_check CHECK (status IN ('Issued', 'Completed'))
);

ALTER TABLE debit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users"
  ON debit_notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable insert access for authenticated users"
  ON debit_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update access for authenticated users"
  ON debit_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete access for authenticated users"
  ON debit_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON debit_notes
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();