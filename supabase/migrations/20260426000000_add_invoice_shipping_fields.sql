-- Add shipping fields to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_type text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_number text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS shipping_date date;

-- Add check constraint for bill_type to ensure data integrity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invoices_bill_type_check'
    ) THEN
        ALTER TABLE invoices ADD CONSTRAINT invoices_bill_type_check 
        CHECK (bill_type IN ('Airway Bill', 'Bill of Lading') OR bill_type IS NULL OR bill_type = '');
    END IF;
END $$;