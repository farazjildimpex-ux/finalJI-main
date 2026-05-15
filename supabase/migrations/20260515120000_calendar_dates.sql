-- Add delivery_date to contracts for calendar display
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS delivery_date date;

-- Add due_date to samples for calendar display
ALTER TABLE samples ADD COLUMN IF NOT EXISTS due_date date;
