-- Add a label for uploaded contract attachments so users can tag files like
-- Purchase Order, Letter of Credit, Packing List, or any custom document type.

ALTER TABLE contract_files
  ADD COLUMN IF NOT EXISTS document_type text;

UPDATE contract_files
SET document_type = COALESCE(document_type, 'Other')
WHERE document_type IS NULL;

ALTER TABLE contract_files
  ALTER COLUMN document_type SET DEFAULT 'Other';
