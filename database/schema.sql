create extension if not exists pg_trgm;

create table if not exists biodata_profiles (
  id uuid primary key default gen_random_uuid(),
  source_row_id text unique,
  profile_id text,
  full_name text not null,
  gender text,
  date_of_birth date,
  birth_year int,
  age int,
  birth_time text,
  birth_place text,
  height_text text,
  height_cm numeric,
  gotra text,
  gotra_normalized text,
  surname text,
  surname_normalized text,
  religion text,
  caste text,
  manglik text,
  marital_status text,
  current_city text,
  district text,
  state text,
  education_raw text,
  education_level text,
  education_stream text,
  education_tags text[],
  profession_raw text,
  profession_category text,
  company_business text,
  family_details text,
  contact_person text,
  contact_number text,
  email text,
  address text,
  pdf_file_id text,
  pdf_url text,
  pdf_name text,
  consent boolean default false,
  approved boolean default false,
  search_text text,
  submitted_at timestamptz,
  synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists biodata_profiles_approved_idx
  on biodata_profiles (approved);

create index if not exists biodata_profiles_birth_year_idx
  on biodata_profiles (birth_year);

create index if not exists biodata_profiles_gotra_idx
  on biodata_profiles (gotra_normalized);

create index if not exists biodata_profiles_education_stream_idx
  on biodata_profiles (education_stream);

create index if not exists biodata_profiles_profession_idx
  on biodata_profiles (profession_category);

create index if not exists biodata_profiles_search_trgm_idx
  on biodata_profiles using gin (search_text gin_trgm_ops);

alter table biodata_profiles enable row level security;

drop policy if exists "Approved biodata profiles are publicly readable" on biodata_profiles;

create policy "Approved biodata profiles are publicly readable"
on biodata_profiles
for select
using (approved = true);

grant select on table biodata_profiles to anon;

create or replace function set_biodata_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists biodata_profiles_updated_at on biodata_profiles;

create trigger biodata_profiles_updated_at
before update on biodata_profiles
for each row
execute procedure set_biodata_profiles_updated_at();
