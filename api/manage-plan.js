// Vercel serverless function — the "manage a family's subscription plan"
// half of SuperAdminView: search a family, change its plan_tier/
// module_flags/plan_limit_overrides, list/resolve plan_upgrade_requests.
// Split out of api/provision-family.js (2026-10-28), where it was folded
// in purely to stay under Vercel's Hobby-plan 12-function cap — "manage a
// plan" and "create a new family" were never actually the same feature.
import { requireAdminSecret } from "./_adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabase = requireAdminSecret(req, res);
  if (!supabase) return;

  const body = req.body || {};
  switch (body.action) {
    case "search-families": return searchFamilies(res, supabase, body);
    case "update-plan": return updatePlan(res, supabase, body);
    case "list-upgrade-requests": return listUpgradeRequests(res, supabase);
    case "resolve-upgrade-request": return resolveUpgradeRequest(res, supabase, body);
    default: res.status(400).json({ error: "Unknown action." });
  }
}

// Simple name-prefix search — SuperAdminView has no running list of
// families to pick from today, so the plan-management UI needs its own
// small lookup. Service-role, so this deliberately bypasses RLS (the
// secret check above is the real gate, same as every other superadmin
// action).
async function searchFamilies(res, supabase, { query }) {
  try {
    const q = (query || "").trim();
    let builder = supabase.from("families").select("id, name, plan_tier, module_flags, plan_limit_overrides").order("name").limit(20);
    if (q) builder = builder.ilike("name", `%${q}%`);
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    res.status(200).json({ families: data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Search failed." });
  }
}

async function updatePlan(res, supabase, { familyId, planTier, moduleFlags, limitOverrides }) {
  if (!familyId || !planTier) {
    res.status(400).json({ error: "Family and plan are required." });
    return;
  }
  if (!["starter", "rooted", "legacy"].includes(planTier)) {
    res.status(400).json({ error: "Not a recognized plan." });
    return;
  }
  try {
    const { data, error } = await supabase
      .from("families")
      .update({ plan_tier: planTier, module_flags: moduleFlags || {}, plan_limit_overrides: limitOverrides || {} })
      .eq("id", familyId)
      .select("id, name, plan_tier, module_flags, plan_limit_overrides")
      .single();
    if (error) throw new Error(error.message);
    res.status(200).json({ family: data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't update that family's plan." });
  }
}

async function listUpgradeRequests(res, supabase) {
  try {
    const { data, error } = await supabase
      .from("plan_upgrade_requests")
      .select("id, family_id, requested_tier, note, resolved, created_at, families(name)")
      .eq("resolved", false)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    res.status(200).json({
      requests: data.map((r) => ({
        id: r.id, familyId: r.family_id, familyName: r.families?.name || "(unknown family)",
        requestedTier: r.requested_tier, note: r.note, createdAt: r.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't load upgrade requests." });
  }
}

async function resolveUpgradeRequest(res, supabase, { id }) {
  if (!id) { res.status(400).json({ error: "Missing request id." }); return; }
  try {
    const { error } = await supabase.from("plan_upgrade_requests").update({ resolved: true }).eq("id", id);
    if (error) throw new Error(error.message);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't resolve that request." });
  }
}
