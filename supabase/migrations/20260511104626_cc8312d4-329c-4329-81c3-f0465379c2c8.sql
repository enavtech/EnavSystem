ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS logo_url text;

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text, email text,
  business_name text,
  source text NOT NULL DEFAULT 'ידני',
  stage text NOT NULL DEFAULT 'ליד חדש',
  assigned_to text,
  plan_id uuid,
  notes text,
  industry text, business_type text, service_type text, city text,
  website text, employees_count int,
  initial_revenue text, monthly_fee text, monthly_ad_budget text,
  business_goals text,
  id_number text, tax_id text,
  instagram_handle text, facebook_url text, tiktok_handle text,
  client_status text, client_since date,
  contract_signed_date date, contract_end_date date,
  meta_lead_id text, form_name text, ad_name text, campaign_name text,
  lead_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open all contacts" ON public.contacts;
CREATE POLICY "open all contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  plan_id uuid,
  type text NOT NULL DEFAULT 'ייעוץ',
  title text NOT NULL,
  meeting_date date NOT NULL,
  meeting_time time,
  duration_minutes int DEFAULT 60,
  status text NOT NULL DEFAULT 'מתוכנן',
  attendees text[] NOT NULL DEFAULT '{}',
  location text,
  notes text,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open all meetings" ON public.meetings;
CREATE POLICY "open all meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.shoot_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  shoot_date date,
  creative_brief text,
  status text NOT NULL DEFAULT 'מתוכנן',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shoot_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open all shoot_days" ON public.shoot_days;
CREATE POLICY "open all shoot_days" ON public.shoot_days FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.shoot_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_day_id uuid NOT NULL REFERENCES public.shoot_days(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'סרטון חדש',
  content_type text NOT NULL DEFAULT 'רילס',
  edit_status text NOT NULL DEFAULT 'לא התחיל',
  assigned_editor text,
  drive_link text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shoot_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open all shoot_videos" ON public.shoot_videos;
CREATE POLICY "open all shoot_videos" ON public.shoot_videos FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  type text NOT NULL,
  content text,
  created_by text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open all activities" ON public.activities;
CREATE POLICY "open all activities" ON public.activities FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS contacts_set_updated ON public.contacts;
CREATE TRIGGER contacts_set_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS meetings_set_updated ON public.meetings;
CREATE TRIGGER meetings_set_updated BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS shoot_days_set_updated ON public.shoot_days;
CREATE TRIGGER shoot_days_set_updated BEFORE UPDATE ON public.shoot_days FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS shoot_videos_set_updated ON public.shoot_videos;
CREATE TRIGGER shoot_videos_set_updated BEFORE UPDATE ON public.shoot_videos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();