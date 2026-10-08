// Vercel serverless function — logs real ad-click landings (tagged with
// UTM params) for cross-referencing against what an ad platform's own
// dashboard reports, plus geolocation and a hashed-IP fraud signal. Two
// actions in one endpoint, same budget-conscious pattern as
// password-reset-requests.js: action:"track" is public/unauthenticated (an
// ad click lands before anyone has a session), action:"list" is gated by
// the same shared secret as provision-family.js.
import crypto from "node:crypto";
import { serviceClient } from "./_memberAuth.js";

const MAX_FIELD_LEN = 300;
function clip(v) {
  if (typeof v !== "string") return null;
  return v.trim().slice(0, MAX_FIELD_LEN) || null;
}

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

async function handleTrack(req, res) {
  const { utmSource, utmMedium, utmCampaign, utmTerm, utmContent, landingPath } = req.body || {};
  // Only ever log genuinely tagged ad traffic, never every random visit.
  if (!clip(utmSource)) {
    res.status(200).json({ ok: true });
    return;
  }

  const supabase = serviceClient();
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim() || req.headers["x-real-ip"] || null;
  const city = req.headers["x-vercel-ip-city"];

  try {
    const { error } = await supabase.from("ad_click_log").insert({
      utm_source: clip(utmSource),
      utm_medium: clip(utmMedium),
      utm_campaign: clip(utmCampaign),
      utm_term: clip(utmTerm),
      utm_content: clip(utmContent),
      landing_path: clip(landingPath),
      referrer: clip(req.headers.referer),
      user_agent: clip(req.headers["user-agent"]),
      country: clip(req.headers["x-vercel-ip-country"]),
      region: clip(req.headers["x-vercel-ip-country-region"]),
      city: city ? clip(decodeURIComponent(city)) : null,
      latitude: clip(req.headers["x-vercel-ip-latitude"]),
      longitude: clip(req.headers["x-vercel-ip-longitude"]),
      ip_hash: hashIp(ip),
    });
    if (error) throw new Error(error.message);
    res.status(200).json({ ok: true });
  } catch (err) {
    // Never let a logging failure be visible or disruptive — this is a
    // fire-and-forget beacon from the client's point of view.
    console.error("ad_click_log insert failed:", err.message);
    res.status(200).json({ ok: true });
  }
}

async function handleList(req, res) {
  const secret = process.env.ADMIN_PROVISION_SECRET;
  if (!secret) {
    res.status(500).json({ error: "This isn't configured on this deployment yet." });
    return;
  }
  if (req.body?.adminSecret !== secret) {
    res.status(401).json({ error: "Incorrect admin secret." });
    return;
  }
  const supabase = serviceClient();
  try {
    const { data, error } = await supabase
      .from("ad_click_log")
      .select("id, utm_source, utm_medium, utm_campaign, referrer, country, region, city, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    res.status(200).json({ clicks: data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't load clicks." });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { action } = req.body || {};
  if (action === "track") {
    await handleTrack(req, res);
  } else if (action === "list") {
    await handleList(req, res);
  } else {
    res.status(400).json({ error: "Unknown action." });
  }
}
