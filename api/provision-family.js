// Vercel serverless function — the actual account-creation logic behind
// /superadmin. Runs server-side only: holds the Supabase service-role key,
// which must never reach the browser bundle (it bypasses all RLS).
//
// Also now the home for the "manage a family's subscription plan" actions
// (search a family, change its plan_tier/module_flags/plan_limit_overrides,
// list/resolve plan_upgrade_requests) — folded into this one file rather
// than new api/*.js files, since this project is already at exactly 12/12
// Vercel Hobby serverless functions (hit and documented earlier this
// session adding the blog feature). `action` selects the branch; omitting
// it keeps today's "provision a new family" behavior as the default, for
// backward compatibility with the existing SuperAdminView form.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

function generatePassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[/+=]/g, "").slice(0, 12);
}

function serviceClientOrNull(res) {
  const secret = process.env.ADMIN_PROVISION_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  if (!secret || !serviceKey || !url) {
    res.status(500).json({ error: "Not configured on this deployment yet — missing ADMIN_PROVISION_SECRET or SUPABASE_SERVICE_ROLE_KEY." });
    return null;
  }
  return { secret, supabase: createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  const ctx = serviceClientOrNull(res);
  if (!ctx) return;
  if (body.adminSecret !== ctx.secret) {
    res.status(401).json({ error: "Incorrect admin secret." });
    return;
  }

  switch (body.action) {
    case "search-families": return searchFamilies(res, ctx.supabase, body);
    case "update-plan": return updatePlan(res, ctx.supabase, body);
    case "list-upgrade-requests": return listUpgradeRequests(res, ctx.supabase, body);
    case "resolve-upgrade-request": return resolveUpgradeRequest(res, ctx.supabase, body);
    default: return provision(res, ctx.supabase, body);
  }
}

async function provision(res, supabase, { familyName, headEmail, headName, moduleFlags }) {
  if (!familyName?.trim() || !headEmail?.trim()) {
    res.status(400).json({ error: "Family name and head email are required." });
    return;
  }

  const password = generatePassword();

  try {
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: headEmail.trim(),
      password,
      email_confirm: true, // no email-sending is configured — skip confirmation entirely
    });
    if (userError) throw new Error(`Creating account failed: ${userError.message}`);

    // moduleFlags is only ever a set of explicit `false`s (disabled) —
    // omitting a key, or the whole object, means that module stays
    // enabled. See src/data/session.js's isModuleEnabled(). plan_tier
    // isn't set here — it defaults to 'starter' via the column default,
    // same as any self-registered family.
    const { data: family, error: familyError } = await supabase
      .from("families")
      .insert({ name: familyName.trim(), module_flags: moduleFlags || {} })
      .select()
      .single();
    if (familyError) throw new Error(`Creating family failed: ${familyError.message}`);

    const { error: memberError } = await supabase
      .from("family_members")
      .insert({ family_id: family.id, user_id: userData.user.id, role: "head", display_name: headName?.trim() || null });
    if (memberError) throw new Error(`Linking head to family failed: ${memberError.message}`);

    res.status(200).json({ familyId: family.id, familyName: familyName.trim(), headEmail: headEmail.trim(), password });
  } catch (err) {
    res.status(500).json({ error: err.message || "Provisioning failed." });
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
