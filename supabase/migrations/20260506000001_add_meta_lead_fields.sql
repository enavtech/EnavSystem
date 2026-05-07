-- Meta Lead Ads integration fields on contacts
-- meta_lead_id: unique ID from Meta for deduplication via webhook
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS meta_lead_id    text,
  ADD COLUMN IF NOT EXISTS form_name       text,
  ADD COLUMN IF NOT EXISTS ad_name         text,
  ADD COLUMN IF NOT EXISTS campaign_name   text;

-- Unique partial index: one row per Meta lead ID (nulls excluded)
CREATE UNIQUE INDEX IF NOT EXISTS contacts_meta_lead_id_unique
  ON contacts (meta_lead_id)
  WHERE meta_lead_id IS NOT NULL;
