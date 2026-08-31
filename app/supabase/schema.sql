-- ============================================================================
-- Result Ledger — Supabase schema
-- Run this once in your Supabase project's SQL editor (Database > SQL Editor).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'New Department',
  institution text default '',
  programme text default '',
  bands jsonb not null default '[
    {"letter":"A","min":70,"max":100,"point":5},
    {"letter":"B","min":60,"max":69,"point":4},
    {"letter":"C","min":50,"max":59,"point":3},
    {"letter":"D","min":45,"max":49,"point":2},
    {"letter":"E","min":40,"max":44,"point":1}
  ]'::jsonb,
  policy jsonb not null default '{
    "probationCgpa":1.5,
    "withdrawalCgpa":1.0,
    "withdrawalConsecutiveSemesters":2,
    "maxCreditLoad":24,
    "excludeElectivesFromGPA":false,
    "resitPolicy":"all",
    "classifications":[
      {"label":"First Class","min":4.5},
      {"label":"Second Class Upper","min":3.5},
      {"label":"Second Class Lower","min":2.4},
      {"label":"Third Class","min":1.5},
      {"label":"Pass","min":1.0}
    ]
  }'::jsonb,
  created_at timestamptz not null default now()
);

-- One row per authenticated user, created ONLY by the admin-create-user
-- edge function (service role) — never directly by client code.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('hod','exams_officer','lecturer')),
  is_superadmin boolean not null default false,
  department_id uuid references departments(id) on delete set null,
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  matric text default '',
  email text default '',
  created_at timestamptz not null default now()
);

create table semesters (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  label text not null default 'New Semester',
  session text default '',
  level text default '',
  term text default '',
  is_final boolean not null default false,
  approval_status text not null default 'draft' check (approval_status in ('draft','published')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references semesters(id) on delete cascade,
  code text not null,
  title text default '',
  credit int not null default 3,
  type text not null default 'compulsory' check (type in ('compulsory','elective')),
  grade_entry_mode text not null default 'score' check (grade_entry_mode in ('score','letter')),
  lecturer_id uuid references profiles(id),
  due_date date,
  locked boolean not null default false,
  submitted_by uuid references profiles(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  value text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (course_id, student_id)
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  actor_id uuid references profiles(id),
  actor_name text,
  role text,
  type text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Helper functions (security definer so they can read profiles regardless
-- of the caller's own row-level access, which keeps the policies below simple)
-- ----------------------------------------------------------------------------

create or replace function current_profile()
returns profiles
language sql security definer stable
as $$
  select * from profiles where id = auth.uid();
$$;

create or replace function is_superadmin()
returns boolean
language sql security definer stable
as $$
  select coalesce((select is_superadmin from profiles where id = auth.uid()), false);
$$;

create or replace function is_dept_admin(dept uuid)
returns boolean
language sql security definer stable
as $$
  select is_superadmin() or exists (
    select 1 from profiles
    where id = auth.uid()
      and department_id = dept
      and role in ('hod','exams_officer')
  );
$$;

create or replace function in_department(dept uuid)
returns boolean
language sql security definer stable
as $$
  select is_superadmin() or exists (
    select 1 from profiles where id = auth.uid() and department_id = dept
  );
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table departments enable row level security;
alter table profiles enable row level security;
alter table students enable row level security;
alter table semesters enable row level security;
alter table courses enable row level security;
alter table scores enable row level security;
alter table audit_log enable row level security;

-- departments
create policy "dept: select own or superadmin" on departments
  for select using (in_department(id));
create policy "dept: update by dept admin" on departments
  for update using (is_dept_admin(id));
create policy "dept: insert by superadmin" on departments
  for insert with check (is_superadmin());

-- profiles — no insert/update/delete policy for client roles at all.
-- Rows are created and edited only by the admin-create-user edge function
-- using the service role key, which bypasses RLS entirely.
create policy "profiles: select own row" on profiles
  for select using (id = auth.uid());
create policy "profiles: select same department if admin" on profiles
  for select using (is_dept_admin(department_id));

-- students
create policy "students: select in department" on students
  for select using (in_department(department_id));
create policy "students: write by dept admin" on students
  for all using (is_dept_admin(department_id)) with check (is_dept_admin(department_id));

-- semesters
create policy "semesters: select in department" on semesters
  for select using (in_department(department_id));
create policy "semesters: write by dept admin" on semesters
  for all using (is_dept_admin(department_id)) with check (is_dept_admin(department_id));

-- courses
create policy "courses: select in department" on courses
  for select using (
    in_department((select department_id from semesters where id = semester_id))
  );
create policy "courses: write by dept admin" on courses
  for all using (
    is_dept_admin((select department_id from semesters where id = semester_id))
  ) with check (
    is_dept_admin((select department_id from semesters where id = semester_id))
  );
-- a lecturer may update ONLY their own assigned course row (e.g. to submit it)
create policy "courses: lecturer updates own course" on courses
  for update using (lecturer_id = auth.uid())
  with check (lecturer_id = auth.uid());

-- scores
create policy "scores: select in department" on scores
  for select using (
    in_department((
      select s.department_id from courses c
      join semesters s on s.id = c.semester_id
      where c.id = course_id
    ))
  );
create policy "scores: write by dept admin" on scores
  for all using (
    is_dept_admin((
      select s.department_id from courses c
      join semesters s on s.id = c.semester_id
      where c.id = course_id
    ))
  ) with check (
    is_dept_admin((
      select s.department_id from courses c
      join semesters s on s.id = c.semester_id
      where c.id = course_id
    ))
  );
-- a lecturer may write scores only for their own, unlocked course
create policy "scores: lecturer writes own unlocked course" on scores
  for all using (
    exists (
      select 1 from courses
      where id = course_id and lecturer_id = auth.uid() and locked = false
    )
  ) with check (
    exists (
      select 1 from courses
      where id = course_id and lecturer_id = auth.uid() and locked = false
    )
  );

-- audit_log — read-only to clients; only triggers (security definer) insert rows
create policy "audit: select by dept admin" on audit_log
  for select using (is_dept_admin(department_id));

-- ----------------------------------------------------------------------------
-- Audit triggers — the server logs these events itself, so a client can
-- never forge or skip an audit entry, and can never edit who/when a
-- submission or approval happened.
-- ----------------------------------------------------------------------------

create or replace function log_score_change()
returns trigger
language plpgsql security definer
as $$
declare
  dept uuid;
  course_code text;
  sem_label text;
  student_name text;
  actor profiles;
begin
  select s.department_id, c.code, sem.label
    into dept, course_code, sem_label
    from courses c join semesters sem on sem.id = c.semester_id
    join departments s on s.id = sem.department_id
    where c.id = new.course_id;

  select name into student_name from students where id = new.student_id;
  actor := current_profile();

  insert into audit_log (department_id, actor_id, actor_name, role, type, detail)
  values (
    dept, actor.id, coalesce(actor.name, 'Unknown'), coalesce(actor.role, 'unknown'),
    'score_change',
    format('%s — %s (%s): %s -> %s',
      coalesce(student_name, 'Unknown student'), course_code, sem_label,
      coalesce(old.value, '—'), coalesce(new.value, '—'))
  );

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_log_score_change
  before insert or update on scores
  for each row execute function log_score_change();

create or replace function log_course_submission()
returns trigger
language plpgsql security definer
as $$
declare
  dept uuid;
  sem_label text;
  actor profiles;
begin
  if new.locked = old.locked then
    return new;
  end if;

  select s.department_id, sem.label into dept, sem_label
    from semesters sem join departments s on s.id = sem.department_id
    where sem.id = new.semester_id;

  actor := current_profile();

  if new.locked then
    new.submitted_by := auth.uid();
    new.submitted_at := now();
    insert into audit_log (department_id, actor_id, actor_name, role, type, detail)
    values (dept, actor.id, coalesce(actor.name,'Unknown'), coalesce(actor.role,'unknown'),
      'course_submitted', format('%s (%s) submitted and locked', new.code, sem_label));
  else
    new.submitted_by := null;
    new.submitted_at := null;
    insert into audit_log (department_id, actor_id, actor_name, role, type, detail)
    values (dept, actor.id, coalesce(actor.name,'Unknown'), coalesce(actor.role,'unknown'),
      'course_reopened', format('%s (%s) reopened by %s', new.code, sem_label, coalesce(actor.name,'Unknown')));
  end if;

  return new;
end;
$$;

create trigger trg_log_course_submission
  before update on courses
  for each row execute function log_course_submission();

create or replace function log_semester_approval()
returns trigger
language plpgsql security definer
as $$
declare
  actor profiles;
begin
  if new.approval_status = old.approval_status then
    return new;
  end if;

  actor := current_profile();

  if new.approval_status = 'published' then
    new.approved_by := auth.uid();
    new.approved_at := now();
    insert into audit_log (department_id, actor_id, actor_name, role, type, detail)
    values (new.department_id, actor.id, coalesce(actor.name,'Unknown'), coalesce(actor.role,'unknown'),
      'semester_approved', format('%s approved and published by %s', new.label, coalesce(actor.name,'Unknown')));
  else
    new.approved_by := null;
    new.approved_at := null;
    insert into audit_log (department_id, actor_id, actor_name, role, type, detail)
    values (new.department_id, actor.id, coalesce(actor.name,'Unknown'), coalesce(actor.role,'unknown'),
      'semester_revoked', format('%s reverted to draft by %s', new.label, coalesce(actor.name,'Unknown')));
  end if;

  return new;
end;
$$;

create trigger trg_log_semester_approval
  before update on semesters
  for each row execute function log_semester_approval();

-- ============================================================================
-- After running this file, create your first superadmin manually (see
-- SUPABASE_SETUP.md) — every account after that is created through the app
-- by that superadmin, via the admin-create-user edge function.
-- ============================================================================
