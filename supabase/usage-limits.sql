-- Rocketry House usage counters and plan limits.
-- Apply this in Supabase SQL editor after the base schema.

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  account_id text not null,
  account_type text not null check (account_type in ('personal', 'team', 'organization')),
  subscription_tier text not null default 'standard' check (subscription_tier in ('standard', 'pro')),
  usage_period text not null,
  projects_created_count integer not null default 0,
  cfd_runs_used integer not null default 0,
  dm_sent_count integer not null default 0,
  member_teams_count integer not null default 0,
  broadcast_count integer not null default 0,
  active_event_pages_count integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (account_id, usage_period)
);

alter table public.usage_counters enable row level security;

drop policy if exists "Users can read their own usage counters" on public.usage_counters;
create policy "Users can read their own usage counters"
on public.usage_counters for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create their own usage counters" on public.usage_counters;
create policy "Users can create their own usage counters"
on public.usage_counters for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their own usage counters" on public.usage_counters;
create policy "Users can update their own usage counters"
on public.usage_counters for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.touch_usage_counter_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists usage_counters_touch_updated_at on public.usage_counters;
create trigger usage_counters_touch_updated_at
before update on public.usage_counters
for each row execute function public.touch_usage_counter_updated_at();

