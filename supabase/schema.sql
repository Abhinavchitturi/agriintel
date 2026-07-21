-- AgriIntel Supabase Schema
-- Run this in the Supabase SQL editor after creating your project

-- Enable UUID extension (already enabled by default)
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- PROFILES  (extends auth.users)
-- ─────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  name        text not null,
  plan        text not null default 'free' check (plan in ('free', 'pro')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name, plan)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'free'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
-- USAGE  (per-user, per-plan counter)
-- ─────────────────────────────────────────
create table if not exists public.usage (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  plan          text not null check (plan in ('free', 'pro')),
  count         integer not null default 0,
  window_start  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, plan)
);

-- ─────────────────────────────────────────
-- CHAT SESSIONS
-- ─────────────────────────────────────────
create table if not exists public.chat_sessions (
  id          text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  preview     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────
create table if not exists public.messages (
  id          text primary key,
  session_id  text not null references public.chat_sessions(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.usage          enable row level security;
alter table public.chat_sessions  enable row level security;
alter table public.messages       enable row level security;

-- Profiles: users can read/update only their own row
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Usage: full CRUD on own rows
create policy "usage_all_own" on public.usage
  for all using (auth.uid() = user_id);

-- Chat sessions: full CRUD on own rows
create policy "sessions_all_own" on public.chat_sessions
  for all using (auth.uid() = user_id);

-- Messages: full CRUD on own rows
create policy "messages_all_own" on public.messages
  for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
create index if not exists idx_usage_user_plan      on public.usage(user_id, plan);
create index if not exists idx_sessions_user        on public.chat_sessions(user_id, updated_at desc);
create index if not exists idx_messages_session     on public.messages(session_id, created_at asc);
