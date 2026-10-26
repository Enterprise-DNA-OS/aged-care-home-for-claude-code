-- Aged Care Home for Claude Code: the schema.
-- What an Australian or New Zealand residential aged care provider keeps for its homes: the homes
-- and their care minutes targets, staff and their registrations, residents and their rooms,
-- assessments and care plan reviews, progress notes, weights, wounds, incidents with their SIRS
-- and Section 31 clocks, restrictive practices with consent and behaviour support plans, hospital
-- transfers, appointments, wellbeing activities, medication changes, shifts for care minutes and
-- registered nurse cover, and quality indicator submissions. Plain Postgres. Runs the same on
-- PGlite. Medication charting stays in the home's electronic medication chart; this records the
-- changes residents and families are told about.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- homes and people

create table if not exists homes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  jurisdiction text not null check (jurisdiction in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT', 'NZ')),
  beds int not null check (beds > 0),
  -- Australia: the home's own care minutes targets per resident per day, set by the department.
  -- New Zealand homes leave these empty.
  care_minutes_target numeric(6,1),
  rn_minutes_target numeric(6,1),
  manager text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  role text not null check (role in ('RN', 'EN', 'PCW', 'HCA', 'lifestyle', 'allied', 'manager', 'other')),
  home_id uuid references homes(id),
  -- Nursing registration (Ahpra in Australia, an annual practising certificate in New Zealand).
  registration_no text,
  registration_expires_on date,
  -- Police certificate or worker screening clearance.
  screening_expires_on date,
  interrai_trained boolean not null default false,
  started_on date,
  left_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists residents (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id),
  code text not null unique,
  first_name text not null,
  last_name text not null,
  born_on date,
  room text,
  admitted_on date not null,
  status text not null default 'permanent' check (status in ('permanent', 'respite', 'in-hospital', 'discharged', 'deceased')),
  left_on date,
  -- Australia: the AN-ACC class. New Zealand: rest home, hospital, dementia or psychogeriatric.
  care_level text,
  gp text,
  representative text,
  representative_email text,
  -- The resident's consent for a copy of their monthly care statement to go to the representative.
  statement_to_representative boolean not null default false,
  advance_care_plan boolean not null default false,
  -- Regular medicines on the medication chart at the last census (for the polypharmacy indicator).
  regular_medicines int,
  antipsychotic boolean not null default false,
  alerts text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- clinical records

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  kind text not null check (kind in ('interrai', 'an-acc', 'falls-risk', 'pressure-risk', 'pain', 'nutrition', 'cognition', 'continence', 'behaviour')),
  done_on date not null,
  done_by uuid references staff(id),
  score text,
  outcome text,
  next_due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, kind, done_on)
);

create table if not exists care_plan_reviews (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  reviewed_on date not null,
  reviewed_by uuid references staff(id),
  case_conference boolean not null default false,
  representative_attended boolean not null default false,
  summary text,
  next_due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, reviewed_on)
);

create table if not exists progress_notes (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  written_at timestamptz not null default now(),
  written_by uuid references staff(id),
  kind text not null default 'note' check (kind in ('note', 'handover', 'gp', 'family', 'clinical', 'behaviour')),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, written_at, body)
);

create table if not exists weights (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  weighed_on date not null,
  kg numeric(5,1) not null check (kg > 0),
  planned_loss boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, weighed_on)
);

create table if not exists wounds (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  kind text not null check (kind in ('pressure-injury', 'skin-tear', 'ulcer', 'surgical', 'other')),
  -- Pressure injury stage: 1, 2, 3, 4, unstageable, deep-tissue.
  stage text check (stage in ('1', '2', '3', '4', 'unstageable', 'deep-tissue')),
  site text not null,
  found_on date not null,
  acquired_here boolean not null default true,
  next_dressing_on date,
  healed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, site, found_on)
);

create table if not exists medication_changes (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  changed_on date not null,
  medicine text not null,
  change text not null check (change in ('started', 'ceased', 'dose-changed')),
  detail text,
  prescriber text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, changed_on, medicine)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  seen_on date not null,
  with_whom text not null,
  reason text,
  offsite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, seen_on, with_whom)
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  done_on date not null,
  domain text not null check (domain in ('physical', 'social', 'emotional', 'cognitive', 'spiritual')),
  activity text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, done_on, activity)
);

create table if not exists hospital_transfers (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  left_on date not null,
  kind text not null check (kind in ('emergency-department', 'admitted')),
  reason text,
  returned_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, left_on)
);

-- ---------------------------------------------------------------- incidents and restrictive practices

create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id),
  resident_id uuid references residents(id),
  reference text not null unique,
  occurred_at timestamptz not null,
  -- The clock starts when the provider becomes aware, not when it happened.
  aware_at timestamptz not null,
  kind text not null check (kind in ('fall', 'behaviour', 'medication', 'skin', 'absence', 'death', 'complaint', 'other')),
  injury text not null default 'none' check (injury in ('none', 'minor', 'needs-treatment')),
  -- Australia: the Serious Incident Response Scheme type and priority, when it is reportable.
  sirs_type text check (sirs_type in ('unreasonable-force', 'unlawful-sexual-contact', 'psychological-abuse', 'unexpected-death', 'stealing-or-financial-coercion', 'neglect', 'restrictive-practice', 'unexplained-absence')),
  sirs_priority int check (sirs_priority in (1, 2)),
  -- New Zealand: a Section 31 notification to HealthCERT is required.
  s31_required boolean not null default false,
  reported_at timestamptz,
  report_reference text,
  police_notified_at timestamptz,
  open_disclosure_on date,
  gp_notified_on date,
  description text not null,
  actions text,
  closed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists restrictive_practices (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  kind text not null check (kind in ('chemical', 'environmental', 'mechanical', 'physical', 'seclusion')),
  description text not null,
  started_on date not null,
  ended_on date,
  consent_from text,
  consent_on date,
  prescriber text,
  behaviour_support_plan_on date,
  review_due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, kind, started_on)
);

-- ---------------------------------------------------------------- workforce

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id),
  staff_id uuid not null references staff(id),
  role text not null check (role in ('RN', 'EN', 'PCW', 'HCA', 'lifestyle', 'allied', 'manager', 'other')),
  starts_at timestamp not null,
  ends_at timestamp not null,
  break_minutes int not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (home_id, staff_id, starts_at),
  check (ends_at > starts_at)
);

create table if not exists qi_submissions (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id),
  quarter_start date not null,
  submitted_on date not null,
  submitted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (home_id, quarter_start)
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id),
  resident_id uuid references residents(id),
  body text not null,
  author text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['homes', 'staff', 'residents', 'assessments', 'care_plan_reviews', 'progress_notes', 'weights', 'wounds',
    'medication_changes', 'appointments', 'activities', 'hospital_transfers', 'incidents', 'restrictive_practices', 'shifts', 'qi_submissions', 'notes'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

create index if not exists residents_home on residents(home_id);
create index if not exists incidents_home on incidents(home_id, occurred_at);
create index if not exists shifts_home_day on shifts(home_id, starts_at);
create index if not exists weights_resident on weights(resident_id, weighed_on);

-- ---------------------------------------------------------------- views

-- Each resident with the home, how long they have been here, the latest interRAI and care plan review.
create or replace view resident_status as
select r.id as resident_id, r.code, r.first_name || ' ' || r.last_name as name, h.code as home, h.jurisdiction, r.room, r.status,
  r.care_level, r.admitted_on, current_date - r.admitted_on as days_here, r.representative,
  (select max(a.done_on) from assessments a where a.resident_id = r.id and a.kind = 'interrai') as last_interrai_on,
  (select max(c.reviewed_on) from care_plan_reviews c where c.resident_id = r.id) as last_care_plan_on,
  (select max(c.next_due_on) from care_plan_reviews c where c.resident_id = r.id and c.reviewed_on = (select max(c2.reviewed_on) from care_plan_reviews c2 where c2.resident_id = r.id)) as care_plan_due_on,
  (select w.kg from weights w where w.resident_id = r.id order by w.weighed_on desc limit 1) as latest_kg,
  r.regular_medicines, r.antipsychotic, r.alerts
from residents r join homes h on h.id = r.home_id
where r.status in ('permanent', 'respite', 'in-hospital');

-- Every reportable incident with its deadline. SIRS: Priority 1 within 24 hours of becoming aware,
-- Priority 2 within 30 days. Section 31 has no fixed hours in this view: the CLI flags it after a set wait.
create or replace view incident_clock as
select i.id as incident_id, i.reference, h.code as home, h.jurisdiction, r.code as resident, i.kind, i.injury, i.sirs_type, i.sirs_priority, i.s31_required,
  i.occurred_at, i.aware_at, i.reported_at, i.report_reference, i.open_disclosure_on, i.closed_on,
  case when i.sirs_priority = 1 then i.aware_at + interval '24 hours' when i.sirs_priority = 2 then i.aware_at + interval '30 days' end as report_due_at,
  case when i.sirs_priority is null then false
       when i.reported_at is not null then i.reported_at > i.aware_at + case when i.sirs_priority = 1 then interval '24 hours' else interval '30 days' end
       else now() > i.aware_at + case when i.sirs_priority = 1 then interval '24 hours' else interval '30 days' end end as report_late,
  i.description
from incidents i join homes h on h.id = i.home_id left join residents r on r.id = i.resident_id;

-- Direct care minutes per home per day, against the residents in the home that day.
-- Registered, enrolled and personal care workers count. Enrolled nurse minutes can count toward
-- the registered nurse target, up to 10% of it.
create or replace view care_minutes_daily as
with days as (
  select h.id as home_id, d::date as day
  from homes h cross join generate_series(current_date - 91, current_date - 1, interval '1 day') d
), worked as (
  select home_id, starts_at::date as day,
    sum(case when role = 'RN' then extract(epoch from ends_at - starts_at) / 60 - break_minutes else 0 end) as rn,
    sum(case when role = 'EN' then extract(epoch from ends_at - starts_at) / 60 - break_minutes else 0 end) as en,
    sum(case when role in ('PCW', 'HCA') then extract(epoch from ends_at - starts_at) / 60 - break_minutes else 0 end) as pcw
  from shifts group by home_id, starts_at::date
), occupied as (
  select d.home_id, d.day, count(r.id) as residents
  from days d left join residents r on r.home_id = d.home_id and r.admitted_on <= d.day and (r.left_on is null or r.left_on > d.day)
  group by d.home_id, d.day
)
select h.code as home, h.jurisdiction, o.day, o.residents,
  coalesce(w.rn, 0) as rn_minutes, coalesce(w.en, 0) as en_minutes, coalesce(w.pcw, 0) as pcw_minutes,
  coalesce(w.rn, 0) + coalesce(w.en, 0) + coalesce(w.pcw, 0) as total_minutes,
  h.care_minutes_target, h.rn_minutes_target
from occupied o join homes h on h.id = o.home_id left join worked w on w.home_id = o.home_id and w.day = o.day;

-- Weight now against about three months ago (the unplanned weight loss indicator compares the
-- start and end of the quarter; 5% or more is significant).
create or replace view weight_trend as
select r.id as resident_id, r.code, r.first_name || ' ' || r.last_name as name, h.code as home,
  latest.weighed_on as latest_on, latest.kg as latest_kg, earlier.weighed_on as earlier_on, earlier.kg as earlier_kg,
  round((latest.kg - earlier.kg) / earlier.kg * 100, 1) as change_pct, latest.planned_loss
from residents r join homes h on h.id = r.home_id
join lateral (select * from weights w where w.resident_id = r.id order by w.weighed_on desc limit 1) latest on true
left join lateral (select * from weights w where w.resident_id = r.id and w.weighed_on <= latest.weighed_on - 80 order by w.weighed_on desc limit 1) earlier on true
where r.status in ('permanent', 'respite', 'in-hospital');

-- Restrictive practices in use, with what is missing.
create or replace view restrictive_status as
select p.id as practice_id, r.code as resident, r.first_name || ' ' || r.last_name as name, h.code as home, h.jurisdiction, p.kind, p.description,
  p.started_on, p.consent_from, p.consent_on, p.behaviour_support_plan_on, p.review_due_on, p.prescriber,
  p.consent_on is null as no_consent, p.behaviour_support_plan_on is null as no_plan,
  p.review_due_on is not null and p.review_due_on < current_date as review_overdue
from restrictive_practices p join residents r on r.id = p.resident_id join homes h on h.id = r.home_id
where p.ended_on is null and r.status in ('permanent', 'respite', 'in-hospital');

-- Open wounds.
create or replace view wound_status as
select w.id as wound_id, r.code as resident, r.first_name || ' ' || r.last_name as name, h.code as home, w.kind, w.stage, w.site,
  w.found_on, current_date - w.found_on as days_open, w.acquired_here, w.next_dressing_on,
  w.next_dressing_on is not null and w.next_dressing_on < current_date as dressing_overdue
from wounds w join residents r on r.id = w.resident_id join homes h on h.id = r.home_id
where w.healed_on is null and r.status in ('permanent', 'respite', 'in-hospital');

-- Staff with registration and screening dates.
create or replace view staff_checks as
select s.code, s.full_name, s.role, h.code as home, s.registration_no, s.registration_expires_on, s.screening_expires_on,
  s.registration_expires_on - current_date as registration_days_left, s.screening_expires_on - current_date as screening_days_left,
  (select max(sh.starts_at)::date from shifts sh where sh.staff_id = s.id) as last_shift_on
from staff s left join homes h on h.id = s.home_id
where s.left_on is null;
