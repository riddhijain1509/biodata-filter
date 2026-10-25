-- Run this migration in Supabase SQL Editor.
-- This is a registration record, not an authentication account.
create table if not exists public.visitor_signups (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 80),
  phone_number text not null check (phone_number ~ '^\+[0-9]{8,15}$'),
  created_at timestamptz not null default now()
);

alter table public.visitor_signups enable row level security;
revoke all on table public.visitor_signups from anon, authenticated;
grant insert on table public.visitor_signups to anon;

drop policy if exists "Visitors can submit their details" on public.visitor_signups;
create policy "Visitors can submit their details"
on public.visitor_signups
for insert
to anon
with check (
  char_length(trim(first_name)) between 1 and 80
  and char_length(trim(last_name)) between 1 and 80
  and phone_number ~ '^\+[0-9]{8,15}$'
);

-- Allow the read-only website to show approved profiles without login.
grant select on table public.biodata_profiles to anon;
drop policy if exists "Public visitors can read approved biodata" on public.biodata_profiles;
create policy "Public visitors can read approved biodata"
on public.biodata_profiles
for select
to anon
using (approved = true);
