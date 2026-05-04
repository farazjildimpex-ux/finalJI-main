-- =====================================================================
-- JILD IMPEX — Leads / Sales CRM system
-- leads, call_logs, lead_email_logs tables
-- Safe to re-run (IF NOT EXISTS everywhere)
-- =====================================================================

-- ---------- 1. leads -------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name      text        NOT NULL,
  contact_person    text        NOT NULL,
  email             text        NOT NULL,
  phone             text,
  website           text,
  address           text[]      NOT NULL DEFAULT '{}',
  country           text        NOT NULL DEFAULT '',
  source            text        NOT NULL DEFAULT 'manual',
  status            text        NOT NULL DEFAULT 'new',
  industry_focus    text,
  company_size      text,
  notes             text,
  last_contact_date date,
  next_follow_up    date,
  tags              text[]      NOT NULL DEFAULT '{}',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select"  ON leads;
DROP POLICY IF EXISTS "leads_insert"  ON leads;
DROP POLICY IF EXISTS "leads_update"  ON leads;
DROP POLICY IF EXISTS "leads_delete"  ON leads;

CREATE POLICY "leads_select" ON leads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "leads_insert" ON leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leads_update" ON leads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leads_delete" ON leads FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_leads_user_id         ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status          ON leads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up  ON leads(user_id, next_follow_up);

-- ---------- 2. call_logs ---------------------------------------------
CREATE TABLE IF NOT EXISTS call_logs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id             uuid        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  call_date           date        NOT NULL,
  duration_minutes    integer,
  call_type           text        NOT NULL DEFAULT 'outbound',
  outcome             text        NOT NULL DEFAULT 'connected',
  notes               text        NOT NULL DEFAULT '',
  follow_up_required  boolean     NOT NULL DEFAULT false,
  follow_up_date      date,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_logs_select" ON call_logs;
DROP POLICY IF EXISTS "call_logs_insert" ON call_logs;
DROP POLICY IF EXISTS "call_logs_update" ON call_logs;
DROP POLICY IF EXISTS "call_logs_delete" ON call_logs;

CREATE POLICY "call_logs_select" ON call_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "call_logs_insert" ON call_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "call_logs_update" ON call_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "call_logs_delete" ON call_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON call_logs(lead_id);

-- ---------- 3. lead_email_logs ---------------------------------------
CREATE TABLE IF NOT EXISTS lead_email_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id      uuid        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  template_id  uuid,
  to_email     text        NOT NULL,
  subject      text        NOT NULL DEFAULT '',
  body         text        NOT NULL DEFAULT '',
  status       text        NOT NULL DEFAULT 'sent',
  sent_at      timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE lead_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_email_logs_select" ON lead_email_logs;
DROP POLICY IF EXISTS "lead_email_logs_insert" ON lead_email_logs;

CREATE POLICY "lead_email_logs_select" ON lead_email_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lead_email_logs_insert" ON lead_email_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lead_email_logs_lead_id ON lead_email_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_email_logs_user_id ON lead_email_logs(user_id);

-- ---------- 4. patch email_templates for Sales module ----------------
-- Add category and is_active if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_templates' AND column_name = 'category'
  ) THEN
    ALTER TABLE email_templates ADD COLUMN category text NOT NULL DEFAULT 'other';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_templates' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE email_templates ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;
