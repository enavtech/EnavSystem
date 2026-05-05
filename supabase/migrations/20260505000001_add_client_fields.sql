ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS initial_revenue text,
  ADD COLUMN IF NOT EXISTS industry        text,
  ADD COLUMN IF NOT EXISTS business_goals  text,
  ADD COLUMN IF NOT EXISTS client_status   text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS client_since    date;
