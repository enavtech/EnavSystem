ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS sort_order DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_internal_tasks_status_sort ON public.internal_tasks (status, sort_order);
-- Initialize sort_order based on creation time so existing tasks keep a stable order within each status
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at) AS rn
  FROM public.internal_tasks
  WHERE sort_order = 0
)
UPDATE public.internal_tasks t
SET sort_order = r.rn * 1000
FROM ranked r
WHERE t.id = r.id;