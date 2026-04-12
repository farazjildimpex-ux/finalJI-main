/*
  # Add currency and company fields

  1. Changes to contracts table
    - Add `currency` column with dropdown options (Euro, USD, INR)

  2. Changes to debit_notes table  
    - Add `currency` column (to be filled from contract selection)
    - Add `company` column (to be filled from contract selection)

  3. Security
    - No changes to RLS policies needed
*/

-- Add currency to contracts table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contracts' AND column_name = 'currency'
  ) THEN
    ALTER TABLE contracts ADD COLUMN currency text DEFAULT 'USD';
    ALTER TABLE contracts ADD CONSTRAINT contracts_currency_check 
      CHECK (currency IN ('Euro', 'USD', 'INR'));
  END IF;
END $$;

-- Add currency and company to debit_notes table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'debit_notes' AND column_name = 'currency'
  ) THEN
    ALTER TABLE debit_notes ADD COLUMN currency text DEFAULT 'USD';
    ALTER TABLE debit_notes ADD CONSTRAINT debit_notes_currency_check 
      CHECK (currency IN ('Euro', 'USD', 'INR'));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'debit_notes' AND column_name = 'company'
  ) THEN
    ALTER TABLE debit_notes ADD COLUMN company text DEFAULT '';
  END IF;
END $$;