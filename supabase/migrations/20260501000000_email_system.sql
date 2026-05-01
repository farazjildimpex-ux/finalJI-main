-- =====================================================================
-- JILD IMPEX — Email system
-- email_templates, email_logs, contact_book additions
-- Safe to re-run (IF NOT EXISTS everywhere)
-- =====================================================================

-- ---------- 1. email_templates ---------------------------------------
CREATE TABLE IF NOT EXISTS email_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  subject     text NOT NULL DEFAULT '',
  body        text NOT NULL DEFAULT '',
  context     text NOT NULL DEFAULT 'general',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_templates_select" ON email_templates;
DROP POLICY IF EXISTS "email_templates_insert" ON email_templates;
DROP POLICY IF EXISTS "email_templates_update" ON email_templates;
DROP POLICY IF EXISTS "email_templates_delete" ON email_templates;

CREATE POLICY "email_templates_select" ON email_templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "email_templates_insert" ON email_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "email_templates_update" ON email_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "email_templates_delete" ON email_templates FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);

-- ---------- 2. email_logs --------------------------------------------
CREATE TABLE IF NOT EXISTS email_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id     uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  context_type    text,
  context_id      text,
  to_email        text[] NOT NULL DEFAULT '{}',
  cc_email        text[] DEFAULT '{}',
  subject         text NOT NULL DEFAULT '',
  body            text NOT NULL DEFAULT '',
  attachment_name text,
  status          text NOT NULL DEFAULT 'sent',
  error_message   text,
  sent_at         timestamptz DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs_select" ON email_logs;
DROP POLICY IF EXISTS "email_logs_insert" ON email_logs;

CREATE POLICY "email_logs_select" ON email_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "email_logs_insert" ON email_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id_sent_at ON email_logs(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_context ON email_logs(user_id, context_type, context_id);

-- ---------- 3. contact_book additions --------------------------------
ALTER TABLE contact_book
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS email_cc       text[] DEFAULT '{}';

-- ---------- 4. gmail_push_state (tracks historyId for push) ----------
CREATE TABLE IF NOT EXISTS gmail_push_state (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  history_id  text,
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE gmail_push_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gmail_push_state_all" ON gmail_push_state;
CREATE POLICY "gmail_push_state_all" ON gmail_push_state FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_push_state_user ON gmail_push_state(user_id);
