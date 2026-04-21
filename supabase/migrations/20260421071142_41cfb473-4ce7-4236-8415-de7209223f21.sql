-- Add share token + admin password to plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS share_token text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Generate tokens for existing rows
UPDATE public.plans
SET share_token = encode(gen_random_bytes(16), 'hex')
WHERE share_token IS NULL;

ALTER TABLE public.plans ALTER COLUMN share_token SET NOT NULL;
ALTER TABLE public.plans ALTER COLUMN share_token SET DEFAULT encode(gen_random_bytes(16), 'hex');
CREATE UNIQUE INDEX IF NOT EXISTS plans_share_token_key ON public.plans(share_token);

-- App settings for admin password (single-row config)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  admin_password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can READ whether admin password is set (without seeing the hash via a view)
CREATE OR REPLACE VIEW public.app_settings_public
WITH (security_invoker = on) AS
SELECT id, (admin_password_hash IS NOT NULL) AS admin_password_set, updated_at
FROM public.app_settings;

-- Lock down direct base table access (no SELECT/INSERT/UPDATE/DELETE for anon)
DROP POLICY IF EXISTS "no direct access app_settings" ON public.app_settings;
CREATE POLICY "no direct access app_settings"
  ON public.app_settings FOR ALL USING (false) WITH CHECK (false);

-- Activity log for dashboard
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  task_id uuid,
  actor_name text NOT NULL DEFAULT 'אורח',
  action text NOT NULL, -- created|updated|completed|reopened|deleted|commented|step_added|step_done
  entity text NOT NULL DEFAULT 'task', -- task|step|comment|plan
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_plan_idx ON public.activity_log(plan_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open all activity" ON public.activity_log;
CREATE POLICY "open all activity"
  ON public.activity_log FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;