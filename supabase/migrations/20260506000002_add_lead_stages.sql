-- Configurable lead pipeline stage names
-- Stored as ordered JSON array, excluding the fixed "לקוח פעיל" conversion stage
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS lead_stages jsonb
  DEFAULT '["ליד חדש","שיחת סינון","פגישת אסטרטגיה","Upsell","נסגר"]'::jsonb;
