/*
  # Invoice approval flow + sample courier tracking

  1. Invoices
    - Add is_approved (skip on re-sync once approved)
    - Add approved_at, approved_by
    - Add source ('email_sync' | 'manual')

  2. Samples
    - Add courier_provider, courier_reference (so user can record DHL, FedEx, etc)
    - Add courier_status, courier_status_updated_at, delivered_at
*/

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_invoices_is_approved ON invoices(is_approved);

ALTER TABLE samples
  ADD COLUMN IF NOT EXISTS courier_provider text,
  ADD COLUMN IF NOT EXISTS courier_reference text,
  ADD COLUMN IF NOT EXISTS courier_status text,
  ADD COLUMN IF NOT EXISTS courier_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_notified boolean DEFAULT false;
