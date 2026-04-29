CREATE TABLE public.kanban_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_key text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  position integer NOT NULL DEFAULT 0,
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all kanban_statuses" ON public.kanban_statuses
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_kanban_statuses_updated_at
  BEFORE UPDATE ON public.kanban_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.kanban_statuses (status_key, label, color, position, is_done) VALUES
  ('todo', 'להתחיל', '#94a3b8', 0, false),
  ('in_progress', 'בתהליך', '#f59e0b', 1, false),
  ('blocked', 'חסום', '#dc2626', 2, false),
  ('done', 'הושלם', '#16a34a', 3, true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_statuses;