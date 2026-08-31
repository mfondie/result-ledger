# Result Ledger

A department result-computation app: GPA/CGPA with configurable grading policy
(probation/withdrawal thresholds, resit handling, degree classification),
role-based access (Head of Department, Exams Officer, Course Lecturer), a
submission-lock + approval workflow, and a tamper-resistant audit trail —
all enforced by the database, not just hidden in the interface.

## Status

This is a working v1 of the full feature set: real password login, role
permissions, semester/course/student management, score entry, GPA/CGPA/
probation/withdrawal/classification, submission locking, approval, the
audit trail, superadmin user management, a dashboard (pass rate/average
GPA/grade distribution), printable documents (transcript, semester sheet,
broadsheet, statement), notifications (email-a-result, overdue-course
flagging), a data-integrity checker, and bulk CSV/Excel import for both
students and scores.

It has been verified to build cleanly (`npm run build`) but has **not**
been run against a live Supabase project yet — that's the next step (see
below). Realtime multi-user sync (so two people editing at once see each
other's changes instantly) isn't wired up either; right now the app
re-fetches after each change, which is correct but not live-updating.

## Setup

1. Read **`SUPABASE_SETUP.md`** first — it walks through creating your
   Supabase project, running `supabase/schema.sql`, deploying the
   `admin-create-user` edge function, and bootstrapping your first
   superadmin account.
2. Copy `.env.example` to `.env` and fill in your project's URL and anon key.
3. `npm install`
4. `npm run dev` — or `npm run build && npm run preview` for a production build.

## Project layout

```
src/
  lib/
    supabaseClient.js   — the Supabase client singleton
    api.js              — every database read/write and edge function call
    grading.js          — pure GPA/CGPA/policy logic (no Supabase dependency)
    permissions.js      — role-check helpers (UI-level; real enforcement is
                          the RLS policies in supabase/schema.sql)
  components/           — one file per screen
supabase/
  schema.sql            — tables, Row Level Security policies, audit triggers
  functions/
    admin-create-user/  — the one server-side piece: account creation
```
