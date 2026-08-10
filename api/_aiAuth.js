// Shared gate for the four AI endpoints (interview draft/follow-up, photo
// scan, translate). All of them spend the operator's OpenAI credits, so
// none of them may be an open relay for anyone who finds the URL.
//
// Two tiers, deliberately:
//   - A signed-in member of a real family: allowed, uncapped. Their own
//     browser session already sends a bearer token (see lib/apiFetch.js),
//     so this costs the client nothing.
//   - No valid session (i.e. an anonymous public-demo visitor): still
//     allowed, because the AI interview is the demo's headline feature and
//     gating it behind signup would gut the demo — but counted against a
//     shared daily ceiling so the worst case is bounded and cheap.
import { createClient } from "@supabase/supabase-js";

// Shared across all anonymous callers per day, not per-IP: an IP cap is
// trivially defeated by rotating IPs, and the thing actually being
// protected is a total spend, not fairness between strangers.
const ANON_DAILY_LIMIT = 50;

function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Returns nothing on success; throws with a client-safe message otherwise.
export async function allowAiRequest(req) {
  const supabase = serviceClient();
  // Without a service key configured there's no way to verify a session or
  // count anonymous use — fail closed rather than leave the key wide open.
  if (!supabase) throw new Error("AI features aren't configured on this deployment yet.");

  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      // A real account still has to belong to a family — an account with no
      // membership has no reason to be drafting biographies.
      const { data: member } = await supabase
        .from("family_members").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      if (member) return;
    }
    // A present-but-invalid/expired token falls through to the anonymous
    // path rather than erroring, so a stale session doesn't hard-break the
    // demo for someone who simply hasn't reloaded.
  }

  const { data: allowed, error } = await supabase.rpc("consume_anon_ai_call", { p_limit: ANON_DAILY_LIMIT });
  if (error) throw new Error("Couldn't check AI usage for today — please try again.");
  if (!allowed) {
    throw new Error("The demo's AI features have hit today's shared limit. Sign in with your family's account to keep using them, or try again tomorrow.");
  }
}
