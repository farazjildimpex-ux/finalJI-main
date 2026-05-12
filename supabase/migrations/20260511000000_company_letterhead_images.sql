-- =====================================================================
-- JILD IMPEX — Per-company PDF header & footer image support
-- Adds header_url, footer_url and related columns to the companies table
-- Safe to re-run (IF NOT EXISTS / IF NOT EXISTS via ADD COLUMN IF NOT EXISTS)
-- =====================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS header_url    text,
  ADD COLUMN IF NOT EXISTS footer_url    text,
  ADD COLUMN IF NOT EXISTS header_ext    text    NOT NULL DEFAULT 'png',
  ADD COLUMN IF NOT EXISTS footer_ext    text    NOT NULL DEFAULT 'png',
  ADD COLUMN IF NOT EXISTS header_height numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS footer_height numeric NOT NULL DEFAULT 20;

-- The images are stored in the existing 'contract-files' storage bucket
-- under the path: letterhead-images/<company_id>/header.<ext>
--                 letterhead-images/<company_id>/footer.<ext>
-- No new bucket needed.

-- Ensure authenticated users can upload to this path in contract-files
-- (The bucket already exists; just make sure the policy covers it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Authenticated users can manage letterhead images'
  ) THEN
    CREATE POLICY "Authenticated users can manage letterhead images"
      ON storage.objects FOR ALL TO authenticated
      USING  (bucket_id = 'contract-files' AND name LIKE 'letterhead-images/%')
      WITH CHECK (bucket_id = 'contract-files' AND name LIKE 'letterhead-images/%');
  END IF;
END $$;
