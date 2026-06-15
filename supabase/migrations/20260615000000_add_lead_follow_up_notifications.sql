-- Add notification tracking for lead follow-ups so reminders only fire once per due date.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS follow_up_notified_at timestamptz;
