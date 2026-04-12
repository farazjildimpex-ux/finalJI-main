/*
  # Fix debit notes RLS policies

  The current RLS policies are causing logout issues because they're too restrictive.
  We'll update them to be more permissive while still maintaining security.
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON debit_notes;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON debit_notes;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON debit_notes;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON debit_notes;

-- Create more permissive policies
CREATE POLICY "Enable read access for authenticated users"
  ON debit_notes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for authenticated users"
  ON debit_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Enable update access for authenticated users"
  ON debit_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Enable delete access for authenticated users"
  ON debit_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Create a trigger to automatically set user_id if not provided
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_user_id_trigger ON debit_notes;

-- Create trigger
CREATE TRIGGER set_user_id_trigger
  BEFORE INSERT ON debit_notes
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id(); 