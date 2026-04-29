/*
  # Create email_scan_log table

  Stores a row per Gmail message that the auto-sync inspected. Useful for
  understanding why an email did or didn't produce an invoice.

  Columns:
    - id (uuid, pk)
    - user_id (uuid, fk auth.users)
    - scanned_at (timestamptz)
    - email_subject (text)
    - email_from (text)
    - email_date (timestamptz)
    - body_chars (int)
    - attachments (jsonb) — array of {name, type, chars}
    - extracted_invoices (jsonb) — raw AI output for this email
    - sync_results (jsonb) — [{invoice_number, contract_numbers, action, reason}]
    - status (text) — 'no_invoices' | 'success' | 'partial' | 'error'
    - error_message (text nullable)

  Security:
    - RLS on, owners only.
*/

CREATE TABLE IF NOT EXISTS email_scan_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  email_subject text,
  email_from text,
  email_date timestamptz,
  body_chars integer DEFAULT 0,
  attachments jsonb DEFAULT '[]'::jsonb,
  extracted_invoices jsonb DEFAULT '[]'::jsonb,
  sync_results jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'no_invoices',
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_email_scan_log_user_id_scanned_at
  ON email_scan_log(user_id, scanned_at DESC);

ALTER TABLE email_scan_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email scan log" ON email_scan_log;
CREATE POLICY "Users can view own email scan log"
  ON email_scan_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own email scan log" ON email_scan_log;
CREATE POLICY "Users can create own email scan log"
  ON email_scan_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own email scan log" ON email_scan_log;
CREATE POLICY "Users can delete own email scan log"
  ON email_scan_log FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
