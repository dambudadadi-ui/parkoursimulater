-- =========================================================
-- DUNGEON PARKOUR DATABASE
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- PROFILES
-- =========================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique,
    money integer not null default 0,
    stage integer not null default 1,
    dungeon integer not null default 0,
    inventory jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists profiles_leaderboard_idx
on public.profiles(stage desc, money desc);

-- =========================================================
-- ENABLE RLS
-- =========================================================

alter table public.profiles enable row level security;

-- Everyone can see leaderboard profiles.
create policy "Leaderboard is publicly readable"
on public.profiles
for select
to anon, authenticated
using (true);

-- A user can create their own profile.
create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

-- Users can update only themselves.
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Users cannot delete profiles from the client.
revoke delete on public.profiles from anon, authenticated;

-- =========================================================
-- NEW USER PROFILE TRIGGER
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    requested_username text;
begin

    requested_username :=
        coalesce(
            new.raw_user_meta_data ->> 'username',
            'PLAYER_' || substr(replace(new.id::text, '-', ''), 1, 8)
        );

    insert into public.profiles (
        id,
        username
    )
    values (
        new.id,
        requested_username
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- =========================================================
-- UPDATED_AT
-- =========================================================

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;

create trigger profiles_updated_at
before update on public.profiles
for each row
execute procedure public.update_updated_at();

-- =========================================================
-- REALTIME
-- =========================================================

alter table public.profiles replica identity full;

do $$
begin
    alter publication supabase_realtime add table public.profiles;
exception
    when duplicate_object then
        null;
end;
$$;
