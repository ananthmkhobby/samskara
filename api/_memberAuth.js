// Shared helper for the two member-login endpoints below. Both need the
// same thing: confirm who's calling (via the bearer token their own
// browser session already holds) and that they're actually a Head/Admin of
// the family they claim to be acting for — never trust a role or family id
// the client just asserts in the request body.
import { createClient } from "@supabase/supabase-js";

export function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Not configured on this deployment — missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Throws with a message safe to send straight back to the client on
// failure. Returns the caller's own family_members row for familyId on success.
export async function requireModerator(supabase, req, familyId) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) throw new Error("Not signed in.");
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) throw new Error("Your session has expired — please reload and sign in again.");
  const { data: member, error: memberErr } = await supabase
    .from("family_members")
    .select("id, role")
    .eq("user_id", user.id)
    .eq("family_id", familyId)
    .maybeSingle();
  if (memberErr) throw new Error(memberErr.message);
  if (!member || (member.role !== "head" && member.role !== "admin")) {
    throw new Error("Only a Head or Admin can do this.");
  }
  return member;
}

export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@members.samskara.app`;
}
