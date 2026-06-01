-- InterviewOS initial schema.
-- Run this in Supabase SQL editor or through the Supabase CLI.
-- The app can use anonymous Supabase users for the demo, then keep the same
-- tables when email or OAuth sign-in is added later.

create extension if not exists pgcrypto;

create type public.interview_mode as enum (
  'System Design',
  'Behavioral',
  'Coding Explanation'
);

create type public.interview_difficulty as enum (
  'Entry',
  'Mid',
  'Senior'
);

create type public.session_status as enum (
  'active',
  'evaluated'
);

create type public.message_role as enum (
  'coach',
  'candidate',
  'system'
);

create type public.rubric_area as enum (
  'Structure',
  'Technical depth',
  'Tradeoffs',
  'Communication clarity',
  'Completeness'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_role text not null default '',
  target_company text not null default '',
  focus_areas text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interview_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode public.interview_mode not null,
  difficulty public.interview_difficulty not null,
  prompt text not null,
  status public.session_status not null default 'active',
  duration_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interview_messages (
  id text primary key,
  session_id text not null references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.evaluations (
  id text primary key,
  session_id text not null unique references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  overall_score integer not null check (overall_score between 0 and 100),
  strengths text[] not null default '{}',
  improvement_areas text[] not null default '{}',
  suggested_next_drill text not null,
  follow_up_questions text[] not null default '{}',
  weak_area_tags public.rubric_area[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rubric_scores (
  id bigint generated always as identity primary key,
  evaluation_id text not null references public.evaluations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  area public.rubric_area not null,
  score numeric(3, 1) not null check (score between 0 and 5),
  max_score numeric(3, 1) not null default 5 check (max_score = 5),
  rationale text not null,
  unique (evaluation_id, area)
);

create table public.practice_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  mode public.interview_mode,
  target_area public.rubric_area,
  target_sessions_per_week integer not null default 3,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index interview_sessions_user_created_idx
  on public.interview_sessions (user_id, created_at desc);

create index interview_messages_session_created_idx
  on public.interview_messages (session_id, created_at);

create index evaluations_user_created_idx
  on public.evaluations (user_id, created_at desc);

create index rubric_scores_user_area_idx
  on public.rubric_scores (user_id, area);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger interview_sessions_set_updated_at
  before update on public.interview_sessions
  for each row execute function public.set_updated_at();

create trigger evaluations_set_updated_at
  before update on public.evaluations
  for each row execute function public.set_updated_at();

create trigger practice_goals_set_updated_at
  before update on public.practice_goals
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_messages enable row level security;
alter table public.evaluations enable row level security;
alter table public.rubric_scores enable row level security;
alter table public.practice_goals enable row level security;

create policy "Profiles are owned by the current user"
  on public.profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Sessions are owned by the current user"
  on public.interview_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Messages are owned by the current user"
  on public.interview_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Evaluations are owned by the current user"
  on public.evaluations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Rubric scores are owned by the current user"
  on public.rubric_scores
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Practice goals are owned by the current user"
  on public.practice_goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
