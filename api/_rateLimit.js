// Shared helper for the handful of intentionally-public, unauthenticated
// endpoints that need abuse protection without a bearer token to key off
// of — see supabase/migrations/20261031120000_rate_limits.sql for the
// actual counter. IP-hashed (same one-way sha256 pattern track-click.js's
// own ad_click_log already uses), never stored or logged in the clear.
import crypto from "node:crypto";

export function clientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim();
  return first || req.headers["x-real-ip"] || null;
}

function hashIp(ip) {
  if (!ip) return "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex");
}

// Returns true if this call is allowed, false if the bucket is over its
// limit for the current window. `supabase` must be a service-role client
// (consume_rate_limit() is revoked from anon/authenticated). Fails OPEN on
// an unexpected DB error — a rate limiter that itself breaks the endpoint
// on every transient hiccup is worse than the abuse it's guarding against,
// and none of the three call sites guard anything higher-stakes than log
// spam or a bounded brute-force window.
export async function checkRateLimit(supabase, { name, req, windowSeconds, limit }) {
  const bucket = `${name}:${hashIp(clientIp(req))}`;
  const { data: allowed, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket: bucket, p_window_seconds: windowSeconds, p_limit: limit,
  });
  if (error) {
    console.error(`consume_rate_limit failed for ${name}:`, error.message);
    return true;
  }
  return allowed;
}
