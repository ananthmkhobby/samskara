// Vercel serverless function — self-service account deletion and data
// export (DPDPA erasure/access rights, see docs/ARCHITECTURE_REVIEW.md
// §6/§9). Deliberately NOT gated by ADMIN_PROVISION_SECRET like the
// superadmin endpoints — authorization here is simply "you are signed in
// as the account in question," proven by the caller's own bearer token,
// same as api/push.js's send_test_push.
//
// action: "export_data" — calls export_my_data() AS the caller (an anon
// client carrying their access token, not the service-role client, so
// auth.uid() inside the security-definer function resolves to them and
// nothing else). Pure read, no account change.
//
// action: "delete_account" — two steps. First, request_account_deletion()
// runs as the caller: blocks if they're a family's only Head/Admin with
// other members still in it (see the migration for the exact rule),
// deletes any solo family outright, and drops their membership in every
// shared family. Only once that succeeds does this call
// supabase.auth.admin.deleteUser() with the service-role client — the one
// step that actually needs admin privileges, and the one step the SQL
// function deliberately never does itself (the Admin API also tears down
// sessions/identities/refresh tokens correctly, which a raw DELETE from
// auth.users would not).
import { createClient } from "@supabase/supabase-js";

function callerClient(token) {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Not configured on this deployment.");
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Not configured on this deployment.");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  const { action } = req.body || {};

  try {
    if (action === "export_data") {
      const asCaller = callerClient(token);
      const { data, error } = await asCaller.rpc("export_my_data");
      if (error) throw new Error(error.message);
      res.status(200).json({ data });
      return;
    }

    if (action === "delete_account") {
      const asCaller = callerClient(token);
      const { data: { user }, error: userErr } = await asCaller.auth.getUser();
      if (userErr || !user) throw new Error("Your session has expired — please reload and sign in again.");

      const { error: prepErr } = await asCaller.rpc("request_account_deletion");
      if (prepErr) throw new Error(prepErr.message);

      const admin = serviceClient();
      const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
      if (deleteErr) throw new Error(deleteErr.message);

      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
