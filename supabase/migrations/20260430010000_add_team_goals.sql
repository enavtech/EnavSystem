-- Team goals: hierarchical quarterly / monthly / weekly planning
CREATE TABLE IF NOT EXISTS public.team_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  period_type text NOT NULL CHECK (period_type IN ('quarterly', 'monthly', 'weekly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  parent_id uuid REFERENCES public.team_goals(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  color text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link internal tasks to goals
ALTER TABLE public.internal_tasks
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.team_goals(id) ON DELETE SET NULL;

-- RLS (open policy, consistent with rest of project at time of creation)
ALTER TABLE public.team_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all team_goals" ON public.team_goals;
CREATE POLICY "allow all team_goals" ON public.team_goals
  FOR ALL USING (true) WITH CHECK (true);
