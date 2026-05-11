ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;
ALTER TABLE public.shoot_videos ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS lead_stages jsonb;
ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS goal_id uuid;

CREATE TABLE IF NOT EXISTS public.team_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  period_type text NOT NULL DEFAULT 'monthly',
  period_start date NOT NULL,
  period_end date NOT NULL,
  parent_id uuid,
  status text NOT NULL DEFAULT 'active',
  progress int NOT NULL DEFAULT 0,
  color text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open all team_goals" ON public.team_goals;
CREATE POLICY "open all team_goals" ON public.team_goals FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS team_goals_set_updated ON public.team_goals;
CREATE TRIGGER team_goals_set_updated BEFORE UPDATE ON public.team_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  status text NOT NULL DEFAULT 'todo',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open all content_items" ON public.content_items;
CREATE POLICY "open all content_items" ON public.content_items FOR ALL USING (true) WITH CHECK (true);