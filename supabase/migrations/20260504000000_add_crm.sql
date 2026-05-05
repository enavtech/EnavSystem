-- ─── CRM: contacts, meetings, content_items ───────────────────────────────

-- Contacts table (leads + active clients)
CREATE TABLE IF NOT EXISTS public.contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  phone         text,
  email         text,
  business_name text,
  source        text NOT NULL DEFAULT 'ידני',
  -- source options: ידני, אורגני, פרסום, הפניה, אחר
  stage         text NOT NULL DEFAULT 'ליד חדש',
  -- pipeline: ליד חדש → שיחת סינון → פגישת אסטרטגיה → לקוח פעיל → Upsell → נסגר
  assigned_to   text,
  plan_id       uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Meetings table (all meeting types)
CREATE TABLE IF NOT EXISTS public.meetings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  plan_id          uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  type             text NOT NULL DEFAULT 'ייעוץ',
  -- types: ייעוץ, שיווק, צילום, מכירה ראשונית, אסטרטגיה, תוכן, שבועית
  title            text NOT NULL,
  meeting_date     date NOT NULL,
  meeting_time     time,
  duration_minutes integer DEFAULT 60,
  status           text NOT NULL DEFAULT 'מתוכנן',
  -- statuses: מתוכנן, הושלם, בוטל
  attendees        text[] DEFAULT '{}',
  location         text,
  notes            text,
  action_items     jsonb DEFAULT '[]'::jsonb,
  created_by       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Content items (video production pipeline)
CREATE TABLE IF NOT EXISTS public.content_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  plan_id         uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  title           text NOT NULL,
  content_type    text NOT NULL DEFAULT 'רילס',
  -- types: רילס, טיקטוק, סטורי, יוטיוב, פוסט
  status          text NOT NULL DEFAULT 'רעיון',
  -- pipeline: רעיון → תסריט → צילום → עריכה → בקרה → הועלה
  shoot_date      date,
  due_date        date,
  delivery_date   date,
  assigned_editor text,
  notes           text,
  drive_link      text,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_authenticated"
  ON public.contacts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "meetings_authenticated"
  ON public.meetings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "content_items_authenticated"
  ON public.content_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ─── Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS contacts_stage_idx      ON public.contacts(stage);
CREATE INDEX IF NOT EXISTS contacts_plan_id_idx    ON public.contacts(plan_id);
CREATE INDEX IF NOT EXISTS meetings_date_idx       ON public.meetings(meeting_date);
CREATE INDEX IF NOT EXISTS meetings_contact_id_idx ON public.meetings(contact_id);
CREATE INDEX IF NOT EXISTS meetings_plan_id_idx    ON public.meetings(plan_id);
CREATE INDEX IF NOT EXISTS content_status_idx      ON public.content_items(status);
CREATE INDEX IF NOT EXISTS content_plan_id_idx     ON public.content_items(plan_id);
