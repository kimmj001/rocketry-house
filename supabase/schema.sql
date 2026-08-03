create extension if not exists "uuid-ossp";

create table profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique,
  display_name text not null,
  bio text,
  avatar_url text,
  creator_rating numeric default 0,
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default uuid_generate_v4(),
  owner_profile_id uuid references profiles(id),
  original_project_id uuid references projects(id),
  slug text unique not null,
  title text not null,
  description text not null,
  price_cents integer not null default 0,
  difficulty text not null,
  motor_class text,
  predicted_altitude_m integer,
  actual_altitude_m integer,
  verification_status text not null default 'Unverified',
  tags text[] default '{}',
  has_web_cad boolean default false,
  has_flight_log boolean default false,
  has_telemetry boolean default false,
  has_thrust_data boolean default false,
  has_stl_step boolean default false,
  verified_flight boolean default false,
  fork_count integer default 0,
  download_count integer default 0,
  royalty_percent numeric default 2,
  public_reference_name text,
  public_reference_url text,
  moderation_status text default 'approved',
  selected_motor_id uuid,
  selected_motor_version_id uuid,
  motor_mount_position numeric,
  rocket_simulation_result_json jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table motors (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references profiles(id),
  name text not null,
  description text,
  visibility text not null default 'private',
  license text,
  price integer default 0,
  motor_type text not null default 'Solid Rocket Motor',
  estimated_class text,
  total_impulse numeric,
  average_thrust numeric,
  peak_thrust numeric,
  burn_time numeric,
  propellant_profile_name text,
  verification_status text default 'Estimate only',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table motor_versions (
  id uuid primary key default uuid_generate_v4(),
  motor_id uuid references motors(id) on delete cascade,
  version_number integer not null,
  parameters_json jsonb not null,
  simulation_result_json jsonb default '{}',
  notes text,
  created_at timestamptz default now()
);

create table motor_parameters (
  id uuid primary key default uuid_generate_v4(),
  motor_id uuid references motors(id) on delete cascade,
  parameters_json jsonb not null,
  created_at timestamptz default now()
);

create table motor_simulation_results (
  id uuid primary key default uuid_generate_v4(),
  motor_id uuid references motors(id) on delete cascade,
  thrust_curve_json jsonb default '[]',
  pressure_curve_json jsonb default '[]',
  impulse_curve_json jsonb default '[]',
  burn_profile_json jsonb default '{}',
  warnings_json jsonb default '[]',
  created_at timestamptz default now()
);

create table motor_files (
  id uuid primary key default uuid_generate_v4(),
  motor_id uuid references motors(id) on delete cascade,
  file_type text not null,
  file_url text,
  original_filename text,
  uploaded_at timestamptz default now()
);

create table motor_marketplace_listings (
  id uuid primary key default uuid_generate_v4(),
  motor_id uuid references motors(id) on delete cascade,
  price integer not null default 0,
  platform_fee_percent numeric default 5,
  status text default 'draft',
  created_at timestamptz default now()
);

alter table projects
  add constraint projects_selected_motor_id_fkey foreign key (selected_motor_id) references motors(id),
  add constraint projects_selected_motor_version_id_fkey foreign key (selected_motor_version_id) references motor_versions(id);

create table project_versions (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  version_name text not null,
  design_json jsonb not null,
  ork_like_xml text,
  created_at timestamptz default now()
);

create table rocket_components (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  component_type text not null,
  name text not null,
  length numeric,
  diameter numeric,
  wall_thickness numeric,
  material text,
  mass numeric,
  position numeric,
  parameters jsonb default '{}'
);

create table project_files (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  filename text not null,
  storage_path text,
  file_type text not null,
  size_bytes bigint,
  moderation_status text default 'pending',
  created_at timestamptz default now()
);

create table purchases (
  id uuid primary key default uuid_generate_v4(),
  buyer_profile_id uuid references profiles(id),
  project_id uuid references projects(id),
  amount_cents integer not null,
  provider text default 'mock',
  provider_payment_id text,
  created_at timestamptz default now()
);

create table forks (
  id uuid primary key default uuid_generate_v4(),
  original_project_id uuid references projects(id),
  fork_project_id uuid references projects(id),
  creator_profile_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table royalties (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id),
  original_project_id uuid references projects(id),
  platform_fee_percent numeric default 5,
  original_creator_percent numeric default 2,
  fork_creator_percent numeric generated always as (100 - platform_fee_percent - original_creator_percent) stored
);

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  profile_id uuid references profiles(id),
  rating integer check (rating between 1 and 5),
  body text,
  created_at timestamptz default now()
);

create table discussions (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  profile_id uuid references profiles(id),
  discussion_type text not null,
  title text not null,
  created_at timestamptz default now()
);

create table discussion_comments (
  id uuid primary key default uuid_generate_v4(),
  discussion_id uuid references discussions(id) on delete cascade,
  profile_id uuid references profiles(id),
  body text not null,
  created_at timestamptz default now()
);

create table flight_logs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  launch_date date,
  location text,
  motor text,
  claimed_altitude_m integer,
  media_proof_required boolean default true,
  notes text
);

create table telemetry_files (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  project_file_id uuid references project_files(id),
  recognized_columns jsonb default '{}',
  mapped_columns jsonb default '{}',
  preview_rows jsonb default '[]'
);

create table thrust_data_files (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  project_file_id uuid references project_files(id),
  motor_name text,
  impulse_ns numeric,
  preview_points jsonb default '[]'
);

create table verification_events (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  event_type text not null,
  evidence_file_id uuid references project_files(id),
  reviewer_profile_id uuid references profiles(id),
  notes text,
  created_at timestamptz default now()
);

create table moderation_reports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id),
  project_file_id uuid references project_files(id),
  reporter_profile_id uuid references profiles(id),
  reason text not null,
  banned_content_tags text[] default '{}',
  admin_review_status text default 'queued',
  created_at timestamptz default now()
);

create table ranking_events (
  id uuid primary key default uuid_generate_v4(),
  event_type text not null,
  actor_profile_id uuid references profiles(id),
  project_id uuid references projects(id),
  motor_id uuid references motors(id),
  metadata_json jsonb default '{}',
  weight numeric default 1,
  created_at timestamptz default now()
);

create table project_ranking_snapshots (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  evidence_quality numeric not null default 0,
  engineering_performance numeric not null default 0,
  simulation_accuracy numeric not null default 0,
  community_quality numeric not null default 0,
  reuse_impact numeric not null default 0,
  safety_reliability numeric not null default 0,
  penalties numeric not null default 0,
  score numeric not null default 0,
  computed_from_json jsonb default '{}',
  computed_at timestamptz default now()
);

create table account_ranking_snapshots (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade,
  account_type text not null default 'personal',
  portfolio_score numeric not null default 0,
  verified_launch_count integer not null default 0,
  helpful_answer_count integer not null default 0,
  published_motor_count integer not null default 0,
  verified_motor_dataset_count integer not null default 0,
  score numeric not null default 0,
  computed_from_json jsonb default '{}',
  computed_at timestamptz default now()
);

alter table profiles enable row level security;

-- Durable MVP app data layer.
-- Community posts/comments, profile drafts, purchases, saved motors, upload drafts,
-- and other UI records are stored here until each flow graduates to a dedicated
-- normalized table.
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
drop policy if exists "Users can read own app records and public archives" on user_data_records;
drop policy if exists "Users can insert own app records and public archives" on user_data_records;
drop policy if exists "Users can update own app records and public archives" on user_data_records;
drop policy if exists "Users can delete own app records" on user_data_records;

create policy "Users can read own app records and public archives"
  on user_data_records for select
  using (
    owner_key = ('user:' || auth.uid()::text)
    or (owner_key = 'public:community' and collection in ('community_posts', 'community_comments'))
    or (owner_key = 'public:projects' and collection in ('projects', 'rocket_projects'))
  );

create policy "Users can insert own app records and public archives"
  on user_data_records for insert
  with check (
    auth.uid() is not null
    and (
      owner_key = ('user:' || auth.uid()::text)
      or (owner_key = 'public:community' and collection in ('community_posts', 'community_comments'))
      or (owner_key = 'public:projects' and collection in ('projects', 'rocket_projects'))
    )
  );

create policy "Users can update own app records and public archives"
  on user_data_records for update
  using (
    auth.uid() is not null
    and (
      owner_key = ('user:' || auth.uid()::text)
      or (owner_key = 'public:community' and collection in ('community_posts', 'community_comments'))
      or (owner_key = 'public:projects' and collection in ('projects', 'rocket_projects'))
    )
  )
  with check (
    auth.uid() is not null
    and (
      owner_key = ('user:' || auth.uid()::text)
      or (owner_key = 'public:community' and collection in ('community_posts', 'community_comments'))
      or (owner_key = 'public:projects' and collection in ('projects', 'rocket_projects'))
    )
  );

create policy "Users can delete own app records"
  on user_data_records for delete
  using (auth.uid() is not null and owner_key = ('user:' || auth.uid()::text));

insert into storage.buckets (id, name, public)
values ('rocketry-house-files', 'rocketry-house-files', false)
on conflict (id) do nothing;

update storage.buckets set public = false where id = 'rocketry-house-files';

drop policy if exists "Rocketry House MVP can read uploaded files" on storage.objects;
drop policy if exists "Rocketry House MVP can upload files" on storage.objects;
drop policy if exists "Rocketry House MVP can update files" on storage.objects;
drop policy if exists "Rocketry House MVP can delete files" on storage.objects;
drop policy if exists "Users can read own uploaded files" on storage.objects;
drop policy if exists "Users can upload own files" on storage.objects;
drop policy if exists "Users can update own files" on storage.objects;
drop policy if exists "Users can delete own files" on storage.objects;
drop policy if exists "Users can update own uploaded files" on storage.objects;
drop policy if exists "Users can delete own uploaded files" on storage.objects;

create policy "Users can read own uploaded files"
  on storage.objects for select
  using (bucket_id = 'rocketry-house-files' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own files"
  on storage.objects for insert
  with check (bucket_id = 'rocketry-house-files' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update own uploaded files"
  on storage.objects for update
  using (bucket_id = 'rocketry-house-files' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'rocketry-house-files' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own uploaded files"
  on storage.objects for delete
  using (bucket_id = 'rocketry-house-files' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
alter table projects enable row level security;
alter table project_files enable row level security;
alter table purchases enable row level security;
alter table motors enable row level security;
alter table motor_versions enable row level security;
alter table motor_parameters enable row level security;
alter table motor_simulation_results enable row level security;
alter table motor_files enable row level security;
alter table motor_marketplace_listings enable row level security;
alter table ranking_events enable row level security;
alter table project_ranking_snapshots enable row level security;
alter table account_ranking_snapshots enable row level security;
