-- Add status column to contracts table
ALTER TABLE contracts 
ADD COLUMN status text NOT NULL DEFAULT 'Issued' 
CHECK (status IN ('Issued', 'Inspected', 'Completed'));