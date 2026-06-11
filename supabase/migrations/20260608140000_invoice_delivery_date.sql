ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS delivery_date date;

COMMENT ON COLUMN invoices.delivery_date IS 'Expected delivery date for invoice shipment — used for reminders and calendar.';
