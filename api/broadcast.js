// Vercel serverless function — the superadmin-wide recurring push
// broadcast: compose one message, send it to every subscribed person
// across every family, on an editable days-based frequency. Split out of
// api/provision-family.js (2026-10-28), where it was folded in purely to
// stay under Vercel's Hobby-plan 12-function cap — "send a platform
// announcement" and "create a new family" were never actually the same
// feature. vercel.json's `crons` entry points here now.
import { createClient } from "@supabase/supabase-js";
import { requireAdminSecret } from "./_adminAuth.js";
import { setVapid, sendToUserIds } from "./_push.js";

export default async function handler(req, res) {
  // Vercel Cron hits this once a day as a plain GET, authenticated by the
  // CRON_SECRET env var Vercel itself auto-sends as a bearer token — not
  // the adminSecret the browser-facing actions below use, since cron has
  // no way to carry a POST body secret.
  if (req.method === "GET") {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    return runScheduledBroadcast(res);
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabase = requireAdminSecret(req, res);
  if (!supabase) return;

  const { action } = req.body || {};
  if (action === "get-broadcast") return getBroadcast(res, supabase);
  if (action === "set-broadcast") return setBroadcast(res, supabase, req.body);
  if (action === "send-broadcast-now") return sendBroadcastNow(res, supabase);
  res.status(400).json({ error: "Unknown action." });
}

async function getBroadcast(res, supabase) {
  try {
    const { data, error } = await supabase.from("superadmin_broadcast").select("*").eq("id", true).single();
    if (error) throw new Error(error.message);
    res.status(200).json({ broadcast: data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't load the broadcast config." });
  }
}

async function setBroadcast(res, supabase, { title, body, url, frequencyDays, enabled }) {
  if (enabled && (!title?.trim() || !body?.trim())) {
    res.status(400).json({ error: "Title and message are required to enable this." });
    return;
  }
  const days = Number(frequencyDays);
  if (!Number.isInteger(days) || days < 1) {
    res.status(400).json({ error: "Frequency must be a whole number of days, 1 or more." });
    return;
  }
  try {
    const { data, error } = await supabase
      .from("superadmin_broadcast")
      .update({
        title: title?.trim() || "", body: body?.trim() || "", url: url?.trim() || "/",
        frequency_days: days, enabled: !!enabled, updated_at: new Date().toISOString(),
      })
      .eq("id", true)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    res.status(200).json({ broadcast: data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't save that." });
  }
}

// Manual "send it right now" — bypasses the frequency gate (unlike the
// cron path below), but still goes through the same send + last_sent_at
// bookkeeping, so the next scheduled send correctly counts from now,
// rather than double-sending shortly after a manual trigger.
async function sendBroadcastNow(res, supabase) {
  try {
    setVapid();
    const { data: cfg, error: cfgErr } = await supabase.from("superadmin_broadcast").select("*").eq("id", true).single();
    if (cfgErr) throw new Error(cfgErr.message);
    if (!cfg.title?.trim() || !cfg.body?.trim()) {
      res.status(400).json({ error: "Set a title and message first." });
      return;
    }
    const result = await sendAppWide(supabase, cfg);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't send that." });
  }
}

// The cron-triggered path — runs once a day (vercel.json), only actually
// sends when the config is enabled AND the configured interval has
// elapsed since last_sent_at. A no-op response on an off day is expected,
// not an error.
async function runScheduledBroadcast(res) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  if (!serviceKey || !url) {
    res.status(500).json({ error: "Missing Supabase service config." });
    return;
  }
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: cfg, error: cfgErr } = await supabase.from("superadmin_broadcast").select("*").eq("id", true).single();
    if (cfgErr) throw new Error(cfgErr.message);
    if (!cfg.enabled || !cfg.title?.trim() || !cfg.body?.trim()) {
      res.status(200).json({ sent: false, reason: "disabled or unconfigured" });
      return;
    }
    const dueAt = cfg.last_sent_at ? new Date(cfg.last_sent_at).getTime() + cfg.frequency_days * 86400000 : 0;
    if (Date.now() < dueAt) {
      res.status(200).json({ sent: false, reason: "not due yet", dueAt: new Date(dueAt).toISOString() });
      return;
    }
    setVapid();
    const result = await sendAppWide(supabase, cfg);
    res.status(200).json({ sent: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message || "Scheduled broadcast failed." });
  }
}

// Shared by both the manual and cron send paths: every user with at least
// one push subscription, across every family — this is the one place in
// the app that deliberately doesn't scope by family_id, since it's an
// app-wide platform announcement, not a per-family notification.
async function sendAppWide(supabase, cfg) {
  const { data: subs, error: subsErr } = await supabase.from("push_subscriptions").select("user_id");
  if (subsErr) throw new Error(subsErr.message);
  const userIds = [...new Set((subs || []).map((s) => s.user_id))];
  if (!userIds.length) {
    await supabase.from("superadmin_broadcast").update({ last_sent_at: new Date().toISOString() }).eq("id", true);
    return { sent: 0, total: 0, removedDead: 0, recipients: 0 };
  }
  const result = await sendToUserIds(supabase, userIds, { title: cfg.title, body: cfg.body, url: cfg.url || "/" });
  await supabase.from("superadmin_broadcast").update({ last_sent_at: new Date().toISOString() }).eq("id", true);
  return result;
}
