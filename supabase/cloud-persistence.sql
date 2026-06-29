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
drop policy if exists "Users can read own app records and public community" on user_data_records;
drop policy if exists "Users can insert own app records and public community" on user_data_records;
drop policy if exists "Users can update own app records and public community" on user_data_records;
drop policy if exists "Users can read own app records and public archives" on user_data_records;
drop policy if exists "Users can insert own app records and public archives" on user_data_records;
drop policy if exists "Users can update own app records and public archives" on user_data_records;
drop policy if exists "Users can delete own app records" on user_data_records;

create policy "Users can read own app records and public archives"
  on user_data_records for select
  using (
    owner_key = ('user:' || auth.uid()::text)
    or (
      owner_key = 'public:community'
      and collection in ('community_posts', 'community_comments')
    )
    or (
      owner_key = 'public:projects'
      and collection in ('projects', 'rocket_projects')
    )
  );

create policy "Users can insert own app records and public archives"
  on user_data_records for insert
  with check (
    auth.uid() is not null
    and (
      owner_key = ('user:' || auth.uid()::text)
      or (
        owner_key = 'public:community'
        and collection in ('community_posts', 'community_comments')
      )
      or (
        owner_key = 'public:projects'
        and collection in ('projects', 'rocket_projects')
      )
    )
  );

create policy "Users can update own app records and public archives"
  on user_data_records for update
  using (
    auth.uid() is not null
    and (
      owner_key = ('user:' || auth.uid()::text)
      or (
        owner_key = 'public:community'
        and collection in ('community_posts', 'community_comments')
      )
      or (
        owner_key = 'public:projects'
        and collection in ('projects', 'rocket_projects')
      )
    )
  )
  with check (
    auth.uid() is not null
    and (
      owner_key = ('user:' || auth.uid()::text)
      or (
        owner_key = 'public:community'
        and collection in ('community_posts', 'community_comments')
      )
      or (
        owner_key = 'public:projects'
        and collection in ('projects', 'rocket_projects')
      )
    )
  );

create policy "Users can delete own app records"
  on user_data_records for delete
  using (
    auth.uid() is not null
    and owner_key = ('user:' || auth.uid()::text)
  );

insert into storage.buckets (id, name, public)
values ('rocketry-house-files', 'rocketry-house-files', false)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id = 'rocketry-house-files';

drop policy if exists "Rocketry House MVP can read uploaded files" on storage.objects;
drop policy if exists "Rocketry House MVP can upload files" on storage.objects;
drop policy if exists "Rocketry House MVP can update files" on storage.objects;
drop policy if exists "Rocketry House MVP can delete files" on storage.objects;
drop policy if exists "Users can read own uploaded files" on storage.objects;
drop policy if exists "Users can upload own files" on storage.objects;
drop policy if exists "Users can update own uploaded files" on storage.objects;
drop policy if exists "Users can delete own uploaded files" on storage.objects;

create policy "Users can read own uploaded files"
  on storage.objects for select
  using (
    bucket_id = 'rocketry-house-files'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload own files"
  on storage.objects for insert
  with check (
    bucket_id = 'rocketry-house-files'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own uploaded files"
  on storage.objects for update
  using (
    bucket_id = 'rocketry-house-files'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'rocketry-house-files'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own uploaded files"
  on storage.objects for delete
  using (
    bucket_id = 'rocketry-house-files'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
