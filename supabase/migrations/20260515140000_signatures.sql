-- Signatures table for PDF signing
CREATE TABLE IF NOT EXISTS signatures (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  image_url   text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signatures_own" ON signatures
  FOR ALL USING (auth.uid() = user_id);
