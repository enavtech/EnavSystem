ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS status_colors jsonb NOT NULL DEFAULT '{
    "לא התחיל": "#94a3b8",
    "בתהליך": "#f59e0b",
    "מעוכב": "#dc2626",
    "הושלם": "#16a34a"
  }'::jsonb;