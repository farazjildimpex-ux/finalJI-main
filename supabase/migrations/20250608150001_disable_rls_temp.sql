/*
  # Temporarily disable RLS on debit_notes table
  
  This is a temporary fix to test if RLS is causing the logout issue.
  We'll disable it temporarily to see if the save/delete operations work without logout.
*/

-- Temporarily disable RLS
ALTER TABLE debit_notes DISABLE ROW LEVEL SECURITY; 