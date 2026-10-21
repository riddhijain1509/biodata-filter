alter table public.biodata_profiles
  add column if not exists education text;

create index if not exists biodata_profiles_education_idx
  on public.biodata_profiles (education);
