create extension if not exists pg_trgm;

-- Searchable biodata imported from the controlled Google Sheet.
-- This table intentionally contains no signup-user mobile number.
create table if not exists public.biodata_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null unique
    check (profile_id ~ '^[GB][1-9][0-9]*$'),
  full_name text not null,
  gender text check (gender in ('Girl', 'Boy')),
  pdf_file_id text,
  pdf_url text,
  pdf_name text,
  date_of_birth date,
  height_text text,
  height_cm numeric(6, 2)
    check (height_cm is null or height_cm between 100 and 250),
  income_text text,
  income_lpa numeric(10, 2)
    check (income_lpa is null or income_lpa >= 0),
  family_district text,
  posting_district text,
  caste text,
  education text,
  occupation_category text
    check (
      occupation_category is null
      or occupation_category in (
        'Engineering',
        'Healthcare',
        'Finance',
        'Business',
        'Management',
        'Government',
        'Teaching',
        'Legal',
        'Marketing',
        'Not Working',
        'Other'
      )
    ),
  manglik boolean,
  approved boolean not null default true,
  source_sheet_id text not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists biodata_profiles_approved_idx
  on public.biodata_profiles (approved);

create index if not exists biodata_profiles_dob_idx
  on public.biodata_profiles (date_of_birth);

create index if not exists biodata_profiles_height_idx
  on public.biodata_profiles (height_cm);

create index if not exists biodata_profiles_income_idx
  on public.biodata_profiles (income_lpa);

create index if not exists biodata_profiles_occupation_idx
  on public.biodata_profiles (occupation_category);

create index if not exists biodata_profiles_education_idx
  on public.biodata_profiles (education);

create index if not exists biodata_profiles_caste_idx
  on public.biodata_profiles (caste);

create index if not exists biodata_profiles_family_district_idx
  on public.biodata_profiles (family_district);

create index if not exists biodata_profiles_posting_district_idx
  on public.biodata_profiles (posting_district);

create index if not exists biodata_profiles_caste_search_idx
  on public.biodata_profiles using gin (caste gin_trgm_ops);

create index if not exists biodata_profiles_family_district_search_idx
  on public.biodata_profiles using gin (family_district gin_trgm_ops);

create index if not exists biodata_profiles_posting_district_search_idx
  on public.biodata_profiles using gin (posting_district gin_trgm_ops);

create or replace function public.set_biodata_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists biodata_profiles_updated_at
  on public.biodata_profiles;

create trigger biodata_profiles_updated_at
before update on public.biodata_profiles
for each row
execute function public.set_biodata_updated_at();

-- Website accounts. A row represents the signed-in user, not a biodata person.
create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  mobile_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_updated_at
  on public.user_profiles;

create trigger user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profile_updated_at();

-- Copy only signup metadata into user_profiles. No biodata table is touched.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, mobile_number)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'mobile_number', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Keep both tables inaccessible until explicit RLS policies allow access.
alter table public.biodata_profiles enable row level security;
alter table public.user_profiles enable row level security;

revoke all on table public.biodata_profiles from anon, authenticated;
revoke all on table public.user_profiles from anon, authenticated;

grant select on table public.biodata_profiles to authenticated;
grant select, update on table public.user_profiles to authenticated;
grant all on table public.biodata_profiles to service_role;
grant all on table public.user_profiles to service_role;

drop policy if exists "Authenticated users can read approved biodata"
  on public.biodata_profiles;

create policy "Authenticated users can read approved biodata"
on public.biodata_profiles
for select
to authenticated
using (approved = true);

drop policy if exists "Users can read their own account profile"
  on public.user_profiles;

create policy "Users can read their own account profile"
on public.user_profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can update their own account profile"
  on public.user_profiles;

create policy "Users can update their own account profile"
on public.user_profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
