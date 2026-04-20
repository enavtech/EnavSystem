create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subtitle text,
  accent_color text default '#2D4A6B',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  title text not null,
  department text,
  priority text not null default 'בינונית',
  status text not null default 'לא התחיל',
  deadline date,
  note text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_plan_id_idx on public.tasks(plan_id);

create table public.task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  content text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index task_steps_task_id_idx on public.task_steps(task_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_name text not null default 'אורח',
  body text not null,
  created_at timestamptz not null default now()
);
create index comments_task_id_idx on public.comments(task_id);

alter table public.plans enable row level security;
alter table public.tasks enable row level security;
alter table public.task_steps enable row level security;
alter table public.comments enable row level security;

create policy "open all plans" on public.plans for all using (true) with check (true);
create policy "open all tasks" on public.tasks for all using (true) with check (true);
create policy "open all steps" on public.task_steps for all using (true) with check (true);
create policy "open all comments" on public.comments for all using (true) with check (true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.plans;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_steps;
alter publication supabase_realtime add table public.comments;

alter table public.plans replica identity full;
alter table public.tasks replica identity full;
alter table public.task_steps replica identity full;
alter table public.comments replica identity full;