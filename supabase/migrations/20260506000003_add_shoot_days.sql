-- Shoot days: one row per client filming session
CREATE TABLE IF NOT EXISTS shoot_days (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id     uuid REFERENCES contacts(id) ON DELETE SET NULL,
  shoot_date     date,
  creative_brief text,
  status         text NOT NULL DEFAULT 'מתוכנן',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Shoot videos: videos produced from a single shoot day
CREATE TABLE IF NOT EXISTS shoot_videos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_day_id    uuid NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'סרטון',
  content_type    text NOT NULL DEFAULT 'רילס',
  edit_status     text NOT NULL DEFAULT 'לא התחיל',
  assigned_editor text,
  drive_link      text,
  notes           text,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shoot_days   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoot_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shoot_days_all"   ON shoot_days   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "shoot_videos_all" ON shoot_videos FOR ALL USING (true) WITH CHECK (true);
