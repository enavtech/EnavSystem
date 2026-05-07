-- Editable lead date (separate from auto-generated created_at)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_date date;
