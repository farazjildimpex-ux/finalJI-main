-- Enable RLS on invoices table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors
DROP POLICY IF EXISTS "Users can manage their own invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all access to invoices for now" ON invoices;

-- Create a broad policy to match the app's current open state
CREATE POLICY "Allow all access to invoices for now"
ON invoices FOR ALL
USING (true)
WITH CHECK (true);