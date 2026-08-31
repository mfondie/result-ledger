# Setting up real login for the Result Ledger

This gets you actual password authentication with three roles (HOD, Exams
Officer, Lecturer), enforced by the database itself — not just hidden in the
app's interface. Every step below is done in your web browser, on
supabase.com — no CLI, Docker, or terminal required.

## What you'll need

- A free [Supabase](https://supabase.com) account
- Nothing else. The Supabase CLI is optional (see the note at the end) —
  everything here uses the dashboard's own SQL editor and Edge Function editor.

## 1. Create the project

In the Supabase dashboard: **New project** → pick a name, a database
password (save it somewhere safe — this is different from any app login
password), and a region close to your users. Wait a minute or two while it
provisions.

## 2. Run the schema

Open **SQL Editor** in the left sidebar → **New query**. Paste in the full
contents of `supabase/schema.sql` and click **Run**. This creates every
table, the security rules (Row Level Security policies), and the
audit-logging triggers. Check **Table Editor** afterward — you should see
`departments`, `profiles`, `students`, `semesters`, `courses`, `scores`, and
`audit_log`.

## 3. Deploy the admin-create-user function — via the dashboard editor

1. **Edge Functions** in the sidebar → **Deploy a new function** → **Via Editor**.
2. Name it exactly `admin-create-user`.
3. Replace the placeholder code with the full contents of
   `supabase/functions/admin-create-user/index.ts`.
4. Click **Deploy**.

No secrets need to be set manually — Supabase automatically provides every
Edge Function with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`, which is everything this function uses. The
service role key is what lets it create accounts; treat it like a master
password — it never leaves Supabase's server, and this function is the only
place that touches it.

## 4. Create your first department and superadmin

You need one bootstrap step by hand, because the app's "create a user"
feature requires an existing superadmin to call it — there's no superadmin
yet.

**Table Editor → departments → Insert row** → set `name` to your department's
name → Save. Open the new row and copy its `id`.

**Authentication → Users → Add user** → enter an email and password for
yourself → Create user. Copy that user's `id` too (shown in the users list).

Back in **SQL Editor**, run (with your own values substituted):

```sql
insert into profiles (id, email, name, role, department_id, is_superadmin)
values (
  'paste-the-auth-user-id-here',
  'the-email-you-used',
  'Your Name',
  'hod',
  'paste-the-department-id-here',
  true
);
```

## 5. Connect the app

**Project Settings > API** has two values you need:
- **Project URL**
- **anon / public key** (safe to use in client code — Row Level Security is
  what keeps data safe, not hiding this key)

Copy `.env.example` to `.env` in the app folder and fill these in as
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Then sign in with the
superadmin account from step 4, and use the in-app **Manage users** screen
to create HOD/Exams Officer/Lecturer accounts with passwords from then on.

## Running the app itself

You still need somewhere to run the React app (`npm install && npm run dev`,
or a production build). If you don't have Node.js/a terminal set up locally,
two browser-only options:
- **[StackBlitz](https://stackblitz.com)** or **[CodeSandbox](https://codesandbox.io)** — upload the project folder and it installs and runs entirely in your browser, good for testing.
- **[Netlify](https://app.netlify.com/drop)** or **Vercel** — connect a GitHub repo (or drag-and-drop a built `dist` folder onto Netlify Drop) for real hosting, no terminal needed either.

## Optional: using the CLI instead

If you do have a terminal and prefer it, the CLI path still works:

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy admin-create-user
```

## What's already enforced for you

- Passwords are hashed and checked by Supabase Auth — never touched by app code.
- A lecturer can only write scores for a course where `lecturer_id` matches
  their own account, and only while that course is unlocked — enforced by
  Postgres itself (see `schema.sql`), not just hidden buttons.
- Score changes, course submissions/reopenings, and semester
  approvals/revocations are logged automatically by database triggers —
  the app never has to (and can't be tricked into skipping it).
- Only the `admin-create-user` function, running on Supabase's server with
  the service role key, can create accounts or assign roles.
