-- Real RLS: replace all open (true) policies with meaningful security
--
-- Security model:
--   plans:        write = authenticated admin only; read = open (needed for share links)
--   tasks:        delete = authenticated; insert/update/read = open (clients interact with tasks)
--   task_steps:   delete = authenticated; insert/update/read = open
--   comments:     delete = authenticated; insert/read = open (clients comment)
--   activity_log: read = authenticated; insert = open (client actions log too)
--   admin-only (internal_tasks, team_members, kanban_statuses, team_goals, app_settings):
--                 ALL = authenticated

-- ─── Drop ALL existing policies ────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ─── plans ──────────────────────────────────────────────────────────────────
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_select"  ON public.plans FOR SELECT USING (true);
CREATE POLICY "plans_insert"  ON public.plans FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "plans_update"  ON public.plans FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "plans_delete"  ON public.plans FOR DELETE USING (auth.role() = 'authenticated');

-- ─── tasks ──────────────────────────────────────────────────────────────────
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select"  ON public.tasks FOR SELECT USING (true);
CREATE POLICY "tasks_insert"  ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "tasks_update"  ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "tasks_delete"  ON public.tasks FOR DELETE USING (auth.role() = 'authenticated');

-- ─── task_steps ─────────────────────────────────────────────────────────────
ALTER TABLE public.task_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_steps_select" ON public.task_steps FOR SELECT USING (true);
CREATE POLICY "task_steps_insert" ON public.task_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "task_steps_update" ON public.task_steps FOR UPDATE USING (true);
CREATE POLICY "task_steps_delete" ON public.task_steps FOR DELETE USING (auth.role() = 'authenticated');

-- ─── comments ───────────────────────────────────────────────────────────────
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON public.comments FOR INSERT WITH CHECK (true);
CREATE POLICY "comments_update" ON public.comments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "comments_delete" ON public.comments FOR DELETE USING (auth.role() = 'authenticated');

-- ─── activity_log ───────────────────────────────────────────────────────────
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_log_select" ON public.activity_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "activity_log_insert" ON public.activity_log FOR INSERT WITH CHECK (true);
CREATE POLICY "activity_log_update" ON public.activity_log FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "activity_log_delete" ON public.activity_log FOR DELETE USING (auth.role() = 'authenticated');

-- ─── internal_tasks (admin only) ────────────────────────────────────────────
ALTER TABLE public.internal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal_tasks_auth" ON public.internal_tasks
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ─── team_members (admin only) ──────────────────────────────────────────────
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_members_auth" ON public.team_members
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ─── kanban_statuses (admin only) ───────────────────────────────────────────
ALTER TABLE public.kanban_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kanban_statuses_auth" ON public.kanban_statuses
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ─── team_goals (admin only) ────────────────────────────────────────────────
-- (RLS was already enabled in previous migration; policies were dropped above)
CREATE POLICY "team_goals_auth" ON public.team_goals
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ─── app_settings (admin only) ──────────────────────────────────────────────
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_auth" ON public.app_settings
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
-- NOTE: server functions use service role key → bypass RLS → still work fine
