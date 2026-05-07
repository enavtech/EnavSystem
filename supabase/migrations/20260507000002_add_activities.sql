-- Activity log: every touchpoint with a contact (lead or client)
CREATE TABLE IF NOT EXISTS activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type        text NOT NULL, -- 'call' | 'whatsapp' | 'email' | 'note' | 'stage_change' | 'meeting' | 'conversion'
  content     text,
  created_by  text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities_all" ON activities FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX activities_contact_idx ON activities(contact_id);
CREATE INDEX activities_created_at_idx ON activities(created_at DESC);
