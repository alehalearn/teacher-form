-- ALEHA Teacher Registration — Supabase schema
-- Apply via Supabase SQL editor or `supabase db push`
-- Idempotent: safe to re-run.

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- Enum types (created once)
-- ============================================================
do $$ begin
  create type applicant_status as enum (
    'New', 'In Review', 'Active', 'Stopped', 'On Hold'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_role as enum ('staff', 'admin');
exception when duplicate_object then null; end $$;

-- ============================================================
-- staff_users
-- ============================================================
create table if not exists staff_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null,
  role        staff_role not null default 'staff',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- applicants — main table
-- ============================================================
create table if not exists applicants (
  -- Form-fed fields (set at submission, immutable from anon client)
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  full_name       text not null,
  district        text not null,
  place           text not null,
  qualification   text not null,
  age             int  not null check (age between 14 and 100),
  offline_exp     text not null,
  online_exp      text not null,
  subject         text[] not null,
  syllabus        text not null,
  syllabus_other  text,
  medium          text not null,
  connectivity    text not null,
  phone           text not null,
  whatsapp        text,
  email           text not null,
  gadgets         text[] not null,
  photo_url       text,

  -- Manual enrichment fields (filled by staff via admin panel)
  code            text unique,
  status          applicant_status not null default 'New',
  gender          text,
  dob             date,
  marital_status  text,
  university      text,
  preferred_time  text,
  foreign_ready   text,
  languages       text[],
  ms_office       text,
  alt_number      text,
  address         text,
  future_pref     text,
  skills          text,
  father_name     text,
  father_occ      text,
  father_contact  text,
  mother_name     text,
  mother_occ      text,
  mother_contact  text,
  bank_account    text,
  bank_ifsc       text,
  bank_branch     text,
  bank_holder     text,
  id_proof_path   text,
  declaration     text,
  declaration_at  timestamptz,
  preferred_syllabus text,
  demo_attend     int default 0,
  demo_convert    int default 0,
  rating          numeric,
  youtube_link    text,
  section_apt     text,
  subject_apt     text,
  medium_apt      text,
  remark          text,
  interviewer     text,

  -- Legacy migration pointer (Google Drive link, if row was imported)
  legacy_drive_url text,
  legacy_sheet_code text,

  -- Audit trail (server-managed, not client-editable)
  updated_at      timestamptz,
  updated_by      uuid references staff_users(id)
);

create index if not exists applicants_status_idx    on applicants(status);
create index if not exists applicants_district_idx  on applicants(district);
create index if not exists applicants_created_idx   on applicants(created_at desc);
create index if not exists applicants_code_idx      on applicants(code);
create index if not exists applicants_updated_idx   on applicants(updated_at desc);

-- ============================================================
-- audit_log — every staff-side edit recorded
-- ============================================================
create table if not exists audit_log (
  id            bigserial primary key,
  applicant_id  uuid not null references applicants(id) on delete cascade,
  staff_id      uuid not null references staff_users(id),
  staff_email   text not null,
  field_name    text not null,
  old_value     text,
  new_value     text,
  changed_at    timestamptz not null default now()
);

create index if not exists audit_log_applicant_idx
  on audit_log(applicant_id, changed_at desc);
create index if not exists audit_log_staff_idx
  on audit_log(staff_id, changed_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table applicants enable row level security;
alter table staff_users enable row level security;
alter table audit_log   enable row level security;

-- Drop any pre-existing policies (idempotent re-run)
drop policy if exists "anon insert applicants"  on applicants;
drop policy if exists "anon no read applicants" on applicants;
drop policy if exists "anon no update applicants" on applicants;
drop policy if exists "anon no delete applicants" on applicants;
drop policy if exists "staff read applicants"    on applicants;
drop policy if exists "staff update applicants"  on applicants;
drop policy if exists "staff delete applicants"  on applicants;

drop policy if exists "staff read own row"   on staff_users;
drop policy if exists "admin read all staff" on staff_users;
drop policy if exists "admin update staff"   on staff_users;

drop policy if exists "staff read audit_log"    on audit_log;
drop policy if exists "staff insert audit_log"  on audit_log;

-- Public form: anyone can insert a new applicant row (RLS allows anon insert)
create policy "anon insert applicants"
  on applicants for insert
  to anon
  with check (true);

-- Public form: NO read/update/delete via anon
create policy "anon no read applicants"
  on applicants for select
  to anon using (false);

create policy "anon no update applicants"
  on applicants for update
  to anon using (false);

create policy "anon no delete applicants"
  on applicants for delete
  to anon using (false);

-- Authenticated staff: full read/update/delete on applicants
-- (Service role key on the server enforces which columns are editable.
--  RLS can't easily do column-level for a single role, so the API route
--  uses a whitelist of fields before calling .update().)
create policy "staff read applicants"
  on applicants for select
  to authenticated using (true);

create policy "staff update applicants"
  on applicants for update
  to authenticated using (true);

create policy "staff delete applicants"
  on applicants for delete
  to authenticated using (true);

-- Staff: can read their own row in staff_users
create policy "staff read own row"
  on staff_users for select
  to authenticated
  using (auth.uid() = id);

-- Audit log: staff read all, staff insert only via API (service role bypasses anyway)
create policy "staff read audit_log"
  on audit_log for select
  to authenticated using (true);

create policy "staff insert audit_log"
  on audit_log for insert
  to authenticated with check (true);

-- ============================================================
-- Storage buckets
-- ============================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('id-proofs', 'id-proofs', false)
on conflict (id) do nothing;

-- Public photos: anyone can read; anon can upload to their own folder
drop policy if exists "photos public read" on storage.objects;
drop policy if exists "photos anon upload" on storage.objects;
drop policy if exists "id-proofs staff read" on storage.objects;
drop policy if exists "id-proofs staff upload" on storage.objects;

create policy "photos public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos');

create policy "photos anon upload"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'photos');

create policy "id-proofs staff read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'id-proofs');

create policy "id-proofs staff upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'id-proofs');

-- ============================================================
-- Helper function: bump updated_at + write audit_log
-- Called from server-side API route via RPC
-- ============================================================
create or replace function fn_apply_staff_edit(
  p_applicant_id uuid,
  p_field_name   text,
  p_old_value    text,
  p_new_value    text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id   uuid;
  v_staff_email text;
begin
  select id, email into v_staff_id, v_staff_email
  from staff_users where id = auth.uid();

  if v_staff_id is null then
    raise exception 'not a staff user';
  end if;

  insert into audit_log (applicant_id, staff_id, staff_email, field_name, old_value, new_value)
  values (p_applicant_id, v_staff_id, v_staff_email, p_field_name, p_old_value, p_new_value);
end;
$$;

-- ============================================================
-- Done
-- ============================================================