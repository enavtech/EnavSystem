-- Team members (simple name list)
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#2D4A6B',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all team_members"
ON public.team_members FOR ALL
USING (true) WITH CHECK (true);

-- Internal tasks (admin-only via app gating)
CREATE TABLE public.internal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  due_date date,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  client_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all internal_tasks"
ON public.internal_tasks FOR ALL
USING (true) WITH CHECK (true);

CREATE INDEX idx_internal_tasks_plan ON public.internal_tasks(plan_id);
CREATE INDEX idx_internal_tasks_client_task ON public.internal_tasks(client_task_id);
CREATE INDEX idx_internal_tasks_assignee ON public.internal_tasks(assignee_id);
CREATE INDEX idx_internal_tasks_status ON public.internal_tasks(status);

CREATE TRIGGER trg_internal_tasks_updated
BEFORE UPDATE ON public.internal_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-set completed_at when status moves to/away from done
CREATE OR REPLACE FUNCTION public.set_internal_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at = now();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_internal_completed_at
BEFORE INSERT OR UPDATE ON public.internal_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_internal_completed_at();