-- Avtopark foundation: organizations, staff roles, core business tables,
-- row level security (tenant isolation), audit log and rate limiting.
--
-- Security model in one paragraph:
-- Every business row carries organization_id. Row Level Security lets a logged-in
-- user touch only rows of organizations they are a member of. Foreign keys between
-- business tables include organization_id, so a row can never point at another
-- company's customer, car or booking. Things an operator may not do (change prices,
-- deposits, blacklist, delete) are blocked in the database, not only in the UI.

create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.org_role as enum ('owner', 'manager', 'operator');
create type public.vehicle_class as enum ('economy', 'compact', 'suv', 'offroad', 'van', 'premium');
create type public.transmission as enum ('automatic', 'manual');
create type public.fuel_type as enum ('petrol', 'diesel', 'hybrid', 'electric', 'lpg');
create type public.booking_status as enum ('request', 'confirmed', 'cancelled');
create type public.booking_source as enum ('desk', 'online');
create type public.deposit_status as enum ('none', 'held', 'returned', 'withheld');
create type public.fine_violation as enum ('speeding', 'parking', 'lane', 'red_light', 'other');
create type public.fine_status as enum ('new', 'assigned', 'paid');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Platform admins (Giorgi). They create companies. They do NOT get access to
-- companies' customers, cars or bookings.
-- ---------------------------------------------------------------------------

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Organizations, profiles, memberships
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  legal_name text check (char_length(legal_name) <= 200),
  legal_id text check (char_length(legal_id) <= 40),
  legal_address text check (char_length(legal_address) <= 300),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 200),
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  -- Copy of the login email so colleagues can see who is who. Kept in sync by triggers.
  email text not null default '',
  created_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

-- Role lookups used by every policy. SECURITY DEFINER so they can read
-- memberships without recursing into memberships' own policies.
create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create function private.org_role(org uuid) returns public.org_role
language sql stable security definer set search_path = '' as $$
  select role from public.memberships
  where organization_id = org and user_id = (select auth.uid());
$$;

create function private.is_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.org_role(org) is not null;
$$;

create function private.is_manager(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.org_role(org) in ('owner', 'manager'), false);
$$;

-- True when the statement comes from a logged-in app user (PostgREST role
-- "authenticated"), false for the service role, migrations and the seed script.
create function private.is_end_user() returns boolean
language sql stable set search_path = '' as $$
  select current_user = 'authenticated';
$$;

revoke all on all functions in schema private from public;
grant execute on function private.is_platform_admin(), private.org_role(uuid),
  private.is_member(uuid), private.is_manager(uuid), private.is_end_user()
  to authenticated;

-- Profile row for every new auth user.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, full_name, email)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''), coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, '') where user_id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- A company must always keep at least one owner.
create function private.keep_one_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.organizations where id = old.organization_id)
     and not exists (
       select 1 from public.memberships
       where organization_id = old.organization_id and role = 'owner' and user_id <> old.user_id
     ) then
    raise exception 'organization must keep at least one owner' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger memberships_keep_one_owner before update or delete on public.memberships
  for each row execute function private.keep_one_owner();

-- ---------------------------------------------------------------------------
-- Settings and locations
-- ---------------------------------------------------------------------------

create table public.organization_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  extra_driver_per_day numeric(10, 2) not null default 15 check (extra_driver_per_day >= 0),
  child_seat_per_day numeric(10, 2) not null default 10 check (child_seat_per_day >= 0),
  full_insurance_per_day numeric(10, 2) not null default 25 check (full_insurance_per_day >= 0),
  hotel_delivery_fee numeric(10, 2) not null default 30 check (hotel_delivery_fee >= 0),
  fuel_fee_per_eighth numeric(10, 2) not null default 25 check (fuel_fee_per_eighth >= 0),
  cleaning_fee_dirty numeric(10, 2) not null default 30 check (cleaning_fee_dirty >= 0),
  cleaning_fee_very_dirty numeric(10, 2) not null default 80 check (cleaning_fee_very_dirty >= 0),
  deposit_economy numeric(10, 2) not null default 300 check (deposit_economy >= 0),
  deposit_compact numeric(10, 2) not null default 300 check (deposit_compact >= 0),
  deposit_suv numeric(10, 2) not null default 500 check (deposit_suv >= 0),
  deposit_offroad numeric(10, 2) not null default 800 check (deposit_offroad >= 0),
  deposit_van numeric(10, 2) not null default 500 check (deposit_van >= 0),
  deposit_premium numeric(10, 2) not null default 1000 check (deposit_premium >= 0),
  -- Approximate GEL per 1 unit, for showing prices in other currencies on the public site.
  usd_rate numeric(10, 4) not null default 2.70 check (usd_rate > 0),
  eur_rate numeric(10, 4) not null default 2.95 check (eur_rate > 0),
  -- Texts per language: {"ka": "...", "en": "..."}
  cancellation_policy jsonb not null default '{}'::jsonb check (jsonb_typeof(cancellation_policy) = 'object'),
  contract_terms jsonb not null default '{}'::jsonb check (jsonb_typeof(contract_terms) = 'object'),
  updated_at timestamptz not null default now()
);
create trigger organization_settings_updated_at before update on public.organization_settings
  for each row execute function private.set_updated_at();

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name_ka text not null check (char_length(name_ka) between 1 and 120),
  name_en text not null check (char_length(name_en) between 1 and 120),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index locations_org_idx on public.locations (organization_id);

-- Booking numbers (B-1041, B-1042, ...) count per company.
create table public.booking_counters (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  last_number integer not null default 1040
);

-- New company: default settings, counter and the usual Georgian pickup points.
create function private.handle_new_organization() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.organization_settings (organization_id) values (new.id);
  insert into public.booking_counters (organization_id) values (new.id);
  insert into public.locations (organization_id, name_ka, name_en, sort_order) values
    (new.id, 'თბილისის აეროპორტი', 'Tbilisi Airport', 1),
    (new.id, 'ქუთაისის აეროპორტი', 'Kutaisi Airport', 2),
    (new.id, 'ბათუმის აეროპორტი', 'Batumi Airport', 3),
    (new.id, 'ოფისი, თბილისი', 'Tbilisi office', 4);
  return new;
end $$;
create trigger on_organization_created after insert on public.organizations
  for each row execute function private.handle_new_organization();

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plate text not null check (plate ~ '^[A-Z]{2}-[0-9]{3}-[A-Z]{2}$'),
  make text not null check (char_length(make) between 1 and 60),
  model text not null check (char_length(model) between 1 and 60),
  year smallint not null check (year between 1980 and 2100),
  vehicle_class public.vehicle_class not null,
  transmission public.transmission not null,
  fuel_type public.fuel_type not null,
  color text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  daily_rate numeric(10, 2) not null check (daily_rate > 0),
  deposit numeric(10, 2) not null check (deposit >= 0),
  odometer_km integer not null default 0 check (odometer_km >= 0),
  last_oil_change_km integer not null default 0 check (last_oil_change_km >= 0),
  oil_interval_km integer not null default 10000 check (oil_interval_km between 1000 and 100000),
  insurance_valid_until date,
  inspection_valid_until date,
  in_service boolean not null default false,
  photo_path text,
  -- Current known damage marks: [{"x": 44, "y": 70, "type": "scratch"}, ...]
  known_damages jsonb not null default '[]'::jsonb check (jsonb_typeof(known_damages) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plate),
  unique (organization_id, id)
);
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function private.set_updated_at();

-- Operators may edit a car (odometer, service flag, ...) but not its price or deposit.
create function private.guard_vehicle_prices() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.is_end_user() and not private.is_manager(new.organization_id)
     and (new.daily_rate is distinct from old.daily_rate or new.deposit is distinct from old.deposit) then
    raise exception 'only managers can change prices and deposits' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger vehicles_guard_prices before update on public.vehicles
  for each row execute function private.guard_vehicle_prices();

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 200),
  country char(2) check (country ~ '^[A-Z]{2}$'),
  license_verified boolean not null default false,
  passport_verified boolean not null default false,
  -- Paths inside the private documents bucket (added in the Customers phase).
  license_path text,
  passport_path text,
  blacklisted boolean not null default false,
  blacklist_reason text check (char_length(blacklist_reason) <= 500),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (not blacklisted or char_length(coalesce(blacklist_reason, '')) > 0)
);
create index customers_org_idx on public.customers (organization_id);
create trigger customers_updated_at before update on public.customers
  for each row execute function private.set_updated_at();

create function private.guard_customer_blacklist() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.is_end_user() and not private.is_manager(new.organization_id) then
    if tg_op = 'INSERT' and new.blacklisted then
      raise exception 'only managers can blacklist customers' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.blacklisted is distinct from old.blacklisted
                             or new.blacklist_reason is distinct from old.blacklist_reason) then
      raise exception 'only managers can blacklist customers' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger customers_guard_blacklist before insert or update on public.customers
  for each row execute function private.guard_customer_blacklist();

-- ---------------------------------------------------------------------------
-- Bookings and booking segments
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number integer not null,
  customer_id uuid not null,
  -- A booking occupies [pickup_date, return_date): the car is free again on return_date.
  pickup_date date not null,
  return_date date not null,
  pickup_location_id uuid,
  -- Copied from the car / settings when the booking is made, so later price
  -- changes never change existing bookings.
  daily_rate numeric(10, 2) not null check (daily_rate > 0),
  extra_prices jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_prices) = 'object'),
  extra_driver boolean not null default false,
  child_seats smallint not null default 0 check (child_seats between 0 and 2),
  full_insurance boolean not null default false,
  hotel_delivery boolean not null default false,
  hotel_address text check (char_length(hotel_address) <= 300),
  status public.booking_status not null default 'confirmed',
  source public.booking_source not null default 'desk',
  deposit_amount numeric(10, 2) not null default 0 check (deposit_amount >= 0),
  deposit_status public.deposit_status not null default 'none',
  deposit_withheld numeric(10, 2) not null default 0 check (deposit_withheld >= 0),
  note text check (char_length(note) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number),
  unique (organization_id, id),
  check (return_date > pickup_date),
  check (deposit_withheld <= deposit_amount),
  foreign key (organization_id, customer_id) references public.customers (organization_id, id),
  foreign key (organization_id, pickup_location_id) references public.locations (organization_id, id)
);
create index bookings_org_dates_idx on public.bookings (organization_id, pickup_date, return_date);
create index bookings_customer_idx on public.bookings (organization_id, customer_id);
create trigger bookings_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();

create function private.assign_booking_number() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.number is null then
    update public.booking_counters
       set last_number = last_number + 1
     where organization_id = new.organization_id
    returning last_number into new.number;
  end if;
  return new;
end $$;
create trigger bookings_assign_number before insert on public.bookings
  for each row execute function private.assign_booking_number();

-- Rate and deposit are manager-only once a booking exists.
create function private.guard_booking_money() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.is_end_user() and not private.is_manager(new.organization_id)
     and (new.daily_rate is distinct from old.daily_rate
          or new.deposit_amount is distinct from old.deposit_amount
          or new.extra_prices is distinct from old.extra_prices) then
    raise exception 'only managers can change booking prices and deposits' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger bookings_guard_money before update on public.bookings
  for each row execute function private.guard_booking_money();

-- Which car the customer has on which dates. A normal booking has one segment;
-- a car replacement splits it into several. Availability always uses segments.
create table public.booking_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  booking_id uuid not null,
  vehicle_id uuid not null,
  start_date date not null,
  end_date date not null,
  -- False only for cancelled bookings. Requests from the website block too.
  blocks boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_date > start_date),
  foreign key (organization_id, booking_id) references public.bookings (organization_id, id) on delete cascade,
  foreign key (organization_id, vehicle_id) references public.vehicles (organization_id, id),
  -- No double booking, enforced by the database itself. '[)' means the return day
  -- is free, so a car returned on the 10th can go out again on the 10th.
  constraint booking_segments_no_overlap exclude using gist (
    vehicle_id with =,
    daterange(start_date, end_date, '[)') with &&
  ) where (blocks)
);
create index booking_segments_booking_idx on public.booking_segments (booking_id);
create index booking_segments_vehicle_idx on public.booking_segments (organization_id, vehicle_id, start_date);

create function private.sync_segment_blocking() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    update public.booking_segments
       set blocks = (new.status <> 'cancelled')
     where booking_id = new.id;
  end if;
  return new;
end $$;
create trigger bookings_sync_segments after update of status on public.bookings
  for each row execute function private.sync_segment_blocking();

-- ---------------------------------------------------------------------------
-- Fines
-- ---------------------------------------------------------------------------

create table public.fines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null,
  occurred_at timestamptz not null,
  violation public.fine_violation not null,
  place text check (char_length(place) <= 300),
  amount numeric(10, 2) not null check (amount > 0),
  status public.fine_status not null default 'new',
  booking_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, vehicle_id) references public.vehicles (organization_id, id),
  foreign key (organization_id, booking_id) references public.bookings (organization_id, id)
);
create index fines_org_idx on public.fines (organization_id, occurred_at desc);
create trigger fines_updated_at before update on public.fines
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log: who changed money, fines and blacklist, and when.
-- Written only by triggers; managers can read their own company's log.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  -- Only the columns that changed: {"column": {"old": ..., "new": ...}}
  changes jsonb not null,
  created_at timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (organization_id, created_at desc);

create function private.write_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  diff jsonb := '{}'::jsonb;
  k text;
begin
  for k in select jsonb_object_keys(old_row || new_row) loop
    if k not in ('updated_at', 'created_at')
       and (old_row -> k) is distinct from (new_row -> k) then
      diff := diff || jsonb_build_object(k, jsonb_build_object('old', old_row -> k, 'new', new_row -> k));
    end if;
  end loop;
  if diff <> '{}'::jsonb then
    insert into public.audit_log (organization_id, actor_id, table_name, record_id, action, changes)
    values (coalesce(new_row ->> 'organization_id', old_row ->> 'organization_id')::uuid,
            auth.uid(), tg_table_name,
            coalesce(new_row ->> 'id', old_row ->> 'id')::uuid, tg_op, diff);
  end if;
  return null;
end $$;

create trigger bookings_audit after insert or update or delete on public.bookings
  for each row execute function private.write_audit();
create trigger fines_audit after insert or update or delete on public.fines
  for each row execute function private.write_audit();
create trigger customers_blacklist_audit after update of blacklisted, blacklist_reason on public.customers
  for each row execute function private.write_audit();
create trigger vehicles_price_audit after update of daily_rate, deposit on public.vehicles
  for each row execute function private.write_audit();

-- ---------------------------------------------------------------------------
-- Rate limiting for login, password reset and (later) the public booking form.
-- Only the server (service role) may call it.
-- ---------------------------------------------------------------------------

create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create function public.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into private.rate_limits as r (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;
  return n <= p_max;
end $$;
revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- Used by the server when inviting someone who may already have an account.
create function public.find_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.platform_admins enable row level security;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.organization_settings enable row level security;
alter table public.locations enable row level security;
alter table public.booking_counters enable row level security;
alter table public.vehicles enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_segments enable row level security;
alter table public.fines enable row level security;
alter table public.audit_log enable row level security;

-- Nothing is visible without logging in.
revoke all on all tables in schema public from anon;
-- Counters and the audit log are written only by triggers.
revoke insert, update, delete on public.booking_counters, public.audit_log, public.platform_admins from authenticated;

create policy "own admin row" on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy "members and platform admins read" on public.organizations for select to authenticated
  using (private.is_member(id) or private.is_platform_admin());
create policy "managers update" on public.organizations for update to authenticated
  using (private.is_manager(id)) with check (private.is_manager(id));

create policy "read self and colleagues" on public.profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.memberships m
      where m.user_id = profiles.user_id and private.is_member(m.organization_id)
    )
    or private.is_platform_admin()
  );
create policy "update self" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- People may change their name, not the email copy.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "members and platform admins read" on public.memberships for select to authenticated
  using (private.is_member(organization_id) or private.is_platform_admin());
-- Managers manage staff; only owners can create, change or remove owners.
create policy "managers add staff" on public.memberships for insert to authenticated
  with check (private.is_manager(organization_id)
              and (role <> 'owner' or private.org_role(organization_id) = 'owner'));
create policy "managers change staff" on public.memberships for update to authenticated
  using (private.is_manager(organization_id)
         and (role <> 'owner' or private.org_role(organization_id) = 'owner'))
  with check (private.is_manager(organization_id)
              and (role <> 'owner' or private.org_role(organization_id) = 'owner'));
create policy "managers remove staff" on public.memberships for delete to authenticated
  using (private.is_manager(organization_id)
         and (role <> 'owner' or private.org_role(organization_id) = 'owner')
         and user_id <> (select auth.uid()));

create policy "members read" on public.organization_settings for select to authenticated
  using (private.is_member(organization_id));
create policy "managers update" on public.organization_settings for update to authenticated
  using (private.is_manager(organization_id)) with check (private.is_manager(organization_id));

create policy "members read" on public.locations for select to authenticated
  using (private.is_member(organization_id));
create policy "managers insert" on public.locations for insert to authenticated
  with check (private.is_manager(organization_id));
create policy "managers update" on public.locations for update to authenticated
  using (private.is_manager(organization_id)) with check (private.is_manager(organization_id));
create policy "managers delete" on public.locations for delete to authenticated
  using (private.is_manager(organization_id));

create policy "members read" on public.vehicles for select to authenticated
  using (private.is_member(organization_id));
create policy "managers insert" on public.vehicles for insert to authenticated
  with check (private.is_manager(organization_id));
create policy "members update" on public.vehicles for update to authenticated
  using (private.is_member(organization_id)) with check (private.is_member(organization_id));
create policy "managers delete" on public.vehicles for delete to authenticated
  using (private.is_manager(organization_id));

create policy "members read" on public.customers for select to authenticated
  using (private.is_member(organization_id));
create policy "members insert" on public.customers for insert to authenticated
  with check (private.is_member(organization_id));
create policy "members update" on public.customers for update to authenticated
  using (private.is_member(organization_id)) with check (private.is_member(organization_id));
create policy "managers delete" on public.customers for delete to authenticated
  using (private.is_manager(organization_id));

create policy "members read" on public.bookings for select to authenticated
  using (private.is_member(organization_id));
create policy "members insert" on public.bookings for insert to authenticated
  with check (private.is_member(organization_id));
create policy "members update" on public.bookings for update to authenticated
  using (private.is_member(organization_id)) with check (private.is_member(organization_id));
create policy "managers delete" on public.bookings for delete to authenticated
  using (private.is_manager(organization_id));

create policy "members read" on public.booking_segments for select to authenticated
  using (private.is_member(organization_id));
create policy "members insert" on public.booking_segments for insert to authenticated
  with check (private.is_member(organization_id));
create policy "members update" on public.booking_segments for update to authenticated
  using (private.is_member(organization_id)) with check (private.is_member(organization_id));
create policy "managers delete" on public.booking_segments for delete to authenticated
  using (private.is_manager(organization_id));

create policy "members read" on public.fines for select to authenticated
  using (private.is_member(organization_id));
create policy "members insert" on public.fines for insert to authenticated
  with check (private.is_member(organization_id));
create policy "members update" on public.fines for update to authenticated
  using (private.is_member(organization_id)) with check (private.is_member(organization_id));
create policy "managers delete" on public.fines for delete to authenticated
  using (private.is_manager(organization_id));

create policy "managers read" on public.audit_log for select to authenticated
  using (private.is_manager(organization_id));
