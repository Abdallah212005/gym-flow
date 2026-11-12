create table if not exists public.gyms (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  owner_name text not null,
  owner_email text not null,
  subscription_status text not null default 'pending'
    check (subscription_status in ('pending', 'active', 'expired', 'suspended')),
  subscription_starts_at timestamptz,
  subscription_ends_at timestamptz,
  created_at timestamptz not null default now(),
  subscription_updated_at timestamptz
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  username text,
  gym_id text references public.gyms(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'employee')),
  permissions jsonb not null default '[]'::jsonb check (jsonb_typeof(permissions) = 'array'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create unique index if not exists user_profiles_username_unique
  on public.user_profiles (lower(username)) where username is not null;
create index if not exists user_profiles_gym_id_idx on public.user_profiles (gym_id);

create table if not exists public.gym_records (
  id text primary key,
  gym_id text not null references public.gyms(id) on delete cascade,
  collection_name text not null check (collection_name in ('members', 'plans', 'attendance', 'payments', 'staff', 'expenses', 'reports')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  phone_normalized text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gym_records_collection_created_idx
  on public.gym_records (gym_id, collection_name, created_at desc);
create unique index if not exists gym_records_member_phone_unique
  on public.gym_records (gym_id, phone_normalized)
  where collection_name = 'members' and phone_normalized is not null;
create unique index if not exists gym_records_plan_name_unique
  on public.gym_records (gym_id, lower(payload->>'name'))
  where collection_name = 'plans';

create table if not exists public.support_sessions (
  id uuid primary key,
  admin_uid uuid not null references auth.users(id) on delete cascade,
  admin_email text not null,
  gym_id text not null references public.gyms(id) on delete cascade,
  gym_name text not null,
  active boolean not null default true,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  last_activity_at timestamptz not null,
  ended_at timestamptz,
  end_reason text
);
create index if not exists support_sessions_started_idx on public.support_sessions (started_at desc);
create index if not exists support_sessions_admin_active_idx on public.support_sessions (admin_uid, active);

create table if not exists public.support_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.support_sessions(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  admin_uid uuid not null references auth.users(id) on delete cascade,
  admin_email text not null,
  gym_id text not null references public.gyms(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists support_events_session_created_idx on public.support_events (session_id, created_at desc);

alter table public.gyms enable row level security;
alter table public.user_profiles enable row level security;
alter table public.gym_records enable row level security;
alter table public.support_sessions enable row level security;
alter table public.support_events enable row level security;

create or replace function public.gymflow_register_gym(p_gym jsonb, p_profile jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.gyms (
    id, name, owner_name, owner_email, subscription_status,
    subscription_starts_at, subscription_ends_at, created_at
  ) values (
    p_gym->>'id', p_gym->>'name', p_gym->>'owner_name', p_gym->>'owner_email',
    'pending', null, null, coalesce((p_gym->>'created_at')::timestamptz, now())
  );
  insert into public.user_profiles (
    id, email, display_name, username, gym_id, role, permissions, created_at
  ) values (
    (p_profile->>'id')::uuid, p_profile->>'email', p_profile->>'display_name',
    lower(p_profile->>'username'), p_gym->>'id', 'owner', '["*"]'::jsonb,
    coalesce((p_profile->>'created_at')::timestamptz, now())
  );
end;
$$;

create or replace function public.gymflow_create_team_user(p_profile jsonb, p_staff jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles (
    id, email, display_name, username, gym_id, role, permissions, created_at, created_by
  ) values (
    (p_profile->>'id')::uuid, p_profile->>'email', p_profile->>'display_name',
    lower(p_profile->>'username'), p_profile->>'gym_id', p_profile->>'role',
    p_profile->'permissions', (p_profile->>'created_at')::timestamptz,
    (p_profile->>'created_by')::uuid
  );
  insert into public.gym_records (id, gym_id, collection_name, payload, created_at)
  values (
    p_staff->>'id', p_staff->>'gym_id', 'staff', p_staff->'payload',
    (p_staff->>'created_at')::timestamptz
  );
end;
$$;

create or replace function public.gymflow_create_member(
  p_gym_id text,
  p_member jsonb,
  p_phone_normalized text,
  p_payment jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.gym_records (
    id, gym_id, collection_name, payload, phone_normalized, created_at, updated_at
  ) values (
    p_member->>'id', p_gym_id, 'members', p_member, p_phone_normalized,
    (p_member->>'createdAt')::timestamptz, coalesce((p_member->>'updatedAt')::timestamptz, now())
  );
  if p_payment is not null then
    insert into public.gym_records (id, gym_id, collection_name, payload, created_at)
    values (
      p_payment->>'id', p_gym_id, 'payments', p_payment,
      (p_payment->>'createdAt')::timestamptz
    );
  end if;
end;
$$;

create or replace function public.gymflow_commit_member_change(
  p_gym_id text,
  p_member_id text,
  p_expected_updated_at timestamptz,
  p_member jsonb,
  p_payment jsonb default null,
  p_attendance jsonb default null,
  p_delete boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_updated_at timestamptz;
begin
  select updated_at into current_updated_at
  from public.gym_records
  where gym_id = p_gym_id and collection_name = 'members' and id = p_member_id
  for update;
  if not found then
    raise exception using message = 'MEMBER_NOT_FOUND', errcode = 'P0002';
  end if;
  if current_updated_at is distinct from p_expected_updated_at then
    raise exception using message = 'MEMBER_CONFLICT', errcode = '40001';
  end if;

  if p_delete then
    delete from public.gym_records
    where gym_id = p_gym_id and collection_name = 'members' and id = p_member_id;
    return;
  end if;

  update public.gym_records
  set payload = p_member,
      updated_at = coalesce((p_member->>'updatedAt')::timestamptz, now()),
      phone_normalized = coalesce(nullif(p_member->>'phoneNormalized', ''), public.gym_records.phone_normalized)
  where gym_id = p_gym_id and collection_name = 'members' and id = p_member_id;

  if p_payment is not null then
    insert into public.gym_records (id, gym_id, collection_name, payload, created_at)
    values (
      p_payment->>'id', p_gym_id, 'payments', p_payment,
      (p_payment->>'createdAt')::timestamptz
    );
  end if;
  if p_attendance is not null then
    insert into public.gym_records (id, gym_id, collection_name, payload, created_at)
    values (
      p_attendance->>'id', p_gym_id, 'attendance', p_attendance,
      (p_attendance->>'createdAt')::timestamptz
    );
  end if;
end;
$$;

revoke all on function public.gymflow_register_gym(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.gymflow_create_team_user(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.gymflow_create_member(text, jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function public.gymflow_commit_member_change(text, text, timestamptz, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.gymflow_register_gym(jsonb, jsonb) to service_role;
grant execute on function public.gymflow_create_team_user(jsonb, jsonb) to service_role;
grant execute on function public.gymflow_create_member(text, jsonb, text, jsonb) to service_role;
grant execute on function public.gymflow_commit_member_change(text, text, timestamptz, jsonb, jsonb, jsonb, boolean) to service_role;
grant select, insert, update, delete on public.gyms, public.user_profiles, public.gym_records,
  public.support_sessions, public.support_events to service_role;
grant usage, select on sequence public.support_events_id_seq to service_role;
