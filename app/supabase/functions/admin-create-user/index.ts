// Supabase Edge Function: admin-create-user
//
// Called by the app when a superadmin creates a new account (HOD, Exams
// Officer, or Lecturer) with a password they choose. This is the one part
// of the system that has to run on a server rather than in the browser,
// because creating a user requires the service role key — a secret that
// must never be shipped to client code. Supabase hosts this function for
// you, so the secret stays server-side.
//
// Deploy with:
//   supabase functions deploy admin-create-user
// After deploying, set the required secret (service role key) with:
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
// (SUPABASE_URL is provided automatically by the Supabase runtime.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ROLES = ["hod", "exams_officer", "lecturer"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerToken = authHeader.replace("Bearer ", "");
    if (!callerToken) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client scoped to the caller's own token — used only to verify who's asking.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerAuth, error: callerErr } = await callerClient.auth.getUser(callerToken);
    if (callerErr || !callerAuth?.user) {
      return json({ error: "Invalid session" }, 401);
    }

    // Admin client — uses the service role key, bypasses RLS. Never expose
    // this key to the browser; it only ever lives in this server function.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", callerAuth.user.id)
      .single();

    if (profileErr || !callerProfile?.is_superadmin) {
      return json({ error: "Only a superadmin can create accounts" }, 403);
    }

    const body = await req.json();
    const { email, password, name, role, department_id } = body;

    if (!email || !password || !name || !role || !department_id) {
      return json({ error: "email, password, name, role, and department_id are all required" }, 400);
    }
    if (password.length < 8) {
      return json({ error: "Password must be at least 8 characters" }, 400);
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` }, 400);
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return json({ error: createErr?.message || "Could not create user" }, 400);
    }

    const { error: insertErr } = await adminClient.from("profiles").insert({
      id: created.user.id,
      email,
      name,
      role,
      department_id,
      is_superadmin: false,
    });
    if (insertErr) {
      // roll back the auth user so we don't leave an orphaned account
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json({ error: insertErr.message }, 400);
    }

    return json({ id: created.user.id, email, name, role }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
