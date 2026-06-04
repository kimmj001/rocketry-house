-- Rocketry House durable app data layer
-- Run after supabase/schema.sql. This table preserves MVP UI data that is
-- not yet mapped to a specialized domain table.

create extension if not exists "uuid-ossp";

create table if not exists user_data_records (
  id uuid primary key default uuid_generate_v4(),
  owner_key text not null,
  collection text not null,
  record_key text not null,
  payload jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(owner_key, collection, record_key)
);

create index if not exists user_data_records_owner_collection_idx
  on user_data_records(owner_key, collection, updated_at desc);

alter table user_data_records enable row level security;

drop policy if exists "Rocketry House MVP can read app records" on user_data_records;
drop policy if exists "Rocketry House MVP can insert app records" on user_data_records;
drop policy if exists "Rocketry House MVP can update app records" on user_data_records;
drop policy if exists "Rocketry House MVP can delete app records" on user_data_records;

-- MVP policy: the app stores records under a non-secret owner_key so anonymous
-- mock-mode users can still persist data during early testing. For production,
-- replace this with auth.uid()-scoped policies after profiles are fully wired.
create policy "Rocketry House MVP can read app records"
  on user_data_records for select
  using (true);

create policy "Rocketry House MVP can insert app records"
  on user_data_records for insert
  with check (true);

create policy "Rocketry House MVP can update app records"
  on user_data_records for update
  using (true)
  with check (true);

create policy "Rocketry House MVP can delete app records"
  on user_data_records for delete
  using (true);

insert into storage.buckets (id, name, public)
values ('rocketry-house-files', 'rocketry-house-files', true)
on conflict (id) do nothing;

drop policy if exists "Rocketry House MVP can read uploaded files" on storage.objects;
drop policy if exists "Rocketry House MVP can upload files" on storage.objects;
drop policy if exists "Rocketry House MVP can update files" on storage.objects;
drop policy if exists "Rocketry House MVP can delete files" on storage.objects;

create policy "Rocketry House MVP can read uploaded files"
  on storage.objects for select
  using (bucket_id = 'rocketry-house-files');

create policy "Rocketry House MVP can upload files"
  on storage.objects for insert
  with check (bucket_id = 'rocketry-house-files');

create policy "Rocketry House MVP can update files"
  on storage.objects for update
  using (bucket_id = 'rocketry-house-files')
  with check (bucket_id = 'rocketry-house-files');

create policy "Rocketry House MVP can delete files"
  on storage.objects for delete
  using (bucket_id = 'rocketry-house-files');
