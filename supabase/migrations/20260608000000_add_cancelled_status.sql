/*
  # Add 'Cancelled' to order status check constraints

  Forms and UI already allow Cancelled; this migration aligns the DB constraints.
*/

-- contracts
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'contracts'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  ) LOOP
    EXECUTE format('ALTER TABLE contracts DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE contracts
  ADD CONSTRAINT contracts_status_check
  CHECK (status IN ('Issued', 'Inspected', 'Completed', 'Cancelled'));

-- samples
ALTER TABLE samples DROP CONSTRAINT IF EXISTS samples_status_check;

ALTER TABLE samples
  ADD CONSTRAINT samples_status_check
  CHECK (status IN ('Issued', 'Completed', 'Cancelled'));

-- debit_notes
ALTER TABLE debit_notes DROP CONSTRAINT IF EXISTS debit_notes_status_check;

ALTER TABLE debit_notes
  ADD CONSTRAINT debit_notes_status_check
  CHECK (status IN ('Issued', 'Completed', 'Cancelled'));
