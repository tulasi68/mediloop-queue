create extension if not exists pgcrypto;

create table if not exists clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);

create table if not exists doctors (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  qualification text,
  department text,
  room text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  external_patient_id text not null,
  name text not null,
  phone text,
  date_of_birth date,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_patients_clinic_external
  on patients (clinic_id, external_patient_id);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  doctor_id uuid not null references doctors(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  external_visit_id text,
  window_start timestamptz not null,
  window_end timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  check (window_end > window_start)
);

create unique index if not exists uq_appointments_doctor_external_visit
  on appointments (clinic_id, doctor_id, external_visit_id)
  where external_visit_id is not null;

create table if not exists queue_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  doctor_id uuid not null references doctors(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  appointment_id uuid references appointments(id) on delete set null,
  external_visit_id text,
  token text not null,
  patient_type text not null check (patient_type in ('scheduled', 'walk_in')),
  status text not null default 'registered',
  check_in_at timestamptz,
  priority_reason text,
  priority_confirmed_by uuid references doctors(id) on delete set null,
  priority_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (clinic_id, doctor_id, token)
);

create unique index if not exists uq_queue_entries_doctor_external_visit
  on queue_entries (clinic_id, doctor_id, external_visit_id)
  where external_visit_id is not null;

create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(),
  queue_entry_id uuid not null unique references queue_entries(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  actor_id text
);

create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  queue_entry_id uuid not null unique references queue_entries(id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_seconds integer,
  actor_id text,
  check (completed_at is null or completed_at >= started_at),
  check (duration_seconds is null or duration_seconds >= 0)
);

create table if not exists queue_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  queue_entry_id uuid references queue_entries(id) on delete set null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  actor_id text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_queue_entries_doctor_status
  on queue_entries (clinic_id, doctor_id, status, created_at);

create index if not exists idx_queue_events_clinic_time
  on queue_events (clinic_id, occurred_at desc);

create index if not exists idx_appointments_clinic_window
  on appointments (clinic_id, window_start, window_end);

-- Upgrade existing installations created before external integration fields existed.
alter table patients add column if not exists external_patient_id text;
alter table appointments add column if not exists external_visit_id text;
alter table queue_entries add column if not exists external_visit_id text;

create unique index if not exists uq_patients_clinic_external_v2
  on patients (clinic_id, external_patient_id)
  where external_patient_id is not null;

create unique index if not exists uq_appointments_doctor_external_visit_v2
  on appointments (clinic_id, doctor_id, external_visit_id)
  where external_visit_id is not null;

create unique index if not exists uq_queue_entries_doctor_external_visit_v2
  on queue_entries (clinic_id, doctor_id, external_visit_id)
  where external_visit_id is not null;
