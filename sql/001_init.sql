-- =============================================================================
-- Migration: 001_init.sql
-- Description: Initial schema for the trading app backend.
--              Run this in the Supabase SQL Editor (Dashboard > SQL Editor).
-- =============================================================================


-- ─── profiles ─────────────────────────────────────────────────────────────────
-- Extends auth.users with username and avatar fields.
-- id must match the corresponding auth.users.id.

create table if not exists public.profiles (
  id              uuid        primary key references auth.users (id) on delete cascade,
  username        text        not null unique,
  email           text        not null unique,
  is_verified     boolean     not null default false,
  avatar_body     text        not null default '0',
  avatar_hairstyle text       not null default '0',
  avatar_head     text        not null default '0',
  avatar_top      text        not null default '0',
  avatar_bottom   text        not null default '0',
  avatar_shoes    text        not null default '0',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Enforce lowercase storage at DB level.
alter table public.profiles
  add constraint profiles_username_lowercase check (username = lower(username)),
  add constraint profiles_email_lowercase    check (email    = lower(email));

-- ─── updated_at auto-trigger ──────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute procedure public.set_updated_at();


-- ─── email_verification_tokens ───────────────────────────────────────────────
-- Stores SHA-256 hashes of one-time email verification tokens.
-- Raw tokens are never stored in the database.

create table if not exists public.email_verification_tokens (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  token_hash  text        not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);


-- ─── password_reset_tokens ────────────────────────────────────────────────────
-- Stores SHA-256 hashes of one-time password reset tokens.
-- Raw tokens are never stored in the database.

create table if not exists public.password_reset_tokens (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  token_hash  text        not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);


-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists idx_profiles_username
  on public.profiles (username);

create index if not exists idx_profiles_email
  on public.profiles (email);

create index if not exists idx_email_verification_tokens_user_id
  on public.email_verification_tokens (user_id);

create index if not exists idx_email_verification_tokens_hash
  on public.email_verification_tokens (token_hash);

create index if not exists idx_password_reset_tokens_user_id
  on public.password_reset_tokens (user_id);

create index if not exists idx_password_reset_tokens_hash
  on public.password_reset_tokens (token_hash);


-- ─── Row Level Security ───────────────────────────────────────────────────────
-- The backend always uses the service role key which bypasses RLS.
-- These policies protect against accidental direct DB access.

alter table public.profiles                  enable row level security;
alter table public.email_verification_tokens enable row level security;
alter table public.password_reset_tokens     enable row level security;

-- Users can read and update their own profile via authenticated JWT.
create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- Token tables are service-role-only: no direct client access.
-- (No policies = no access for non-service-role callers.)


-- =============================================================================
-- Run this separately if the profiles table was already created without
-- the is_verified column (i.e. you ran the migration before this change).
-- =============================================================================
-- alter table public.profiles
--   add column if not exists is_verified boolean not null default false;

-- =============================================================================
-- Run this separately to switch avatar columns from integer to text.
-- =============================================================================
-- alter table public.profiles
--   alter column avatar_body type text using avatar_body::text,
--   alter column avatar_hairstyle type text using avatar_hairstyle::text,
--   alter column avatar_head type text using avatar_head::text,
--   alter column avatar_top type text using avatar_top::text,
--   alter column avatar_bottom type text using avatar_bottom::text,
--   alter column avatar_shoes type text using avatar_shoes::text;
