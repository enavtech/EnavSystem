
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'status_change',
  title text NOT NULL,
  body text,
  task_id uuid,
  status_key text,
  old_status_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_created_at ON public.notifications (created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all notifications" ON public.notifications
  FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.notify_internal_task_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_label text;
  old_label text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT label INTO new_label FROM public.kanban_statuses WHERE status_key = NEW.status LIMIT 1;
    SELECT label INTO old_label FROM public.kanban_statuses WHERE status_key = OLD.status LIMIT 1;
    INSERT INTO public.notifications (type, title, body, task_id, status_key, old_status_key)
    VALUES (
      'status_change',
      NEW.title,
      'עברה מ"' || COALESCE(old_label, OLD.status) || '" ל"' || COALESCE(new_label, NEW.status) || '"',
      NEW.id,
      NEW.status,
      OLD.status
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_internal_task_status ON public.internal_tasks;
CREATE TRIGGER trg_notify_internal_task_status
AFTER UPDATE ON public.internal_tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_internal_task_status_change();
