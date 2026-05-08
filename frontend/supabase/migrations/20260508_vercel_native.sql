create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  oauth_provider text,
  is_verified boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id text not null,
  label text not null,
  masked text not null,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  last_validated timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, provider_id, label)
);

create table if not exists public.research_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null,
  selected_models jsonb not null default '[]'::jsonb,
  options jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  error text,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.model_responses (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.research_queries (id) on delete cascade,
  provider_id text not null,
  model_id text not null,
  status text not null,
  text text,
  latency_ms integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  error text,
  error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.syntheses (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null unique references public.research_queries (id) on delete cascade,
  summary text not null default '',
  consensus jsonb not null default '[]'::jsonb,
  disagreements jsonb not null default '[]'::jsonb,
  unique_insights jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  financial_synthesis jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists provider_keys_set_updated_at on public.provider_keys;
create trigger provider_keys_set_updated_at before update on public.provider_keys
for each row execute function public.set_updated_at();

drop trigger if exists research_queries_set_updated_at on public.research_queries;
create trigger research_queries_set_updated_at before update on public.research_queries
for each row execute function public.set_updated_at();

drop trigger if exists model_responses_set_updated_at on public.model_responses;
create trigger model_responses_set_updated_at before update on public.model_responses
for each row execute function public.set_updated_at();

drop trigger if exists syntheses_set_updated_at on public.syntheses;
create trigger syntheses_set_updated_at before update on public.syntheses
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.provider_keys enable row level security;
alter table public.research_queries enable row level security;
alter table public.model_responses enable row level security;
alter table public.syntheses enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

drop policy if exists "provider_keys_own_all" on public.provider_keys;
create policy "provider_keys_own_all" on public.provider_keys
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "research_queries_own_all" on public.research_queries;
create policy "research_queries_own_all" on public.research_queries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "model_responses_own_all" on public.model_responses;
create policy "model_responses_own_all" on public.model_responses
for all using (
  exists (
    select 1 from public.research_queries q
    where q.id = model_responses.query_id and q.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.research_queries q
    where q.id = model_responses.query_id and q.user_id = auth.uid()
  )
);

drop policy if exists "syntheses_own_all" on public.syntheses;
create policy "syntheses_own_all" on public.syntheses
for all using (
  exists (
    select 1 from public.research_queries q
    where q.id = syntheses.query_id and q.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.research_queries q
    where q.id = syntheses.query_id and q.user_id = auth.uid()
  )
);
