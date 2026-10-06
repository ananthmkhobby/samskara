// Shared helpers for the WhatsApp webhook — identity resolution and request
// validation. Mirrors api/_memberAuth.js's serviceClient() rather than
// inventing a second way to get a service-role Supabase client.
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

// Found during local testing: an individual Supabase REST call occasionally
// hangs indefinitely — neither resolving nor rejecting — rather than
// failing fast, which left the webhook stuck forever with no log line at
// all (confirmed via per-stage timing checkpoints: the stuck call moved
// around between runs, so this isn't one specific query, it's generic
// local-network flakiness that can hit any outbound call). supabase-js
// doesn't impose a request timeout of its own, so every call made through
// this client gets one via a custom fetch — any single stuck call now
// fails after 8s instead of hanging the whole request.
function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Not configured on this deployment — missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchWithTimeout },
  });
}

// Twilio signs every webhook request with the account's auth token. The URL
// used in that signature must be the exact public URL Twilio was configured
// to call — built from APP_URL (an env var we control), never from
// req.headers.host, which a caller could spoof.
export function validateTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const appUrl = process.env.APP_URL;
  if (!authToken || !appUrl) throw new Error("WhatsApp isn't configured on this deployment yet.");
  const signature = req.headers["x-twilio-signature"];
  if (!signature) return false;
  const url = `${appUrl}/api/whatsapp-webhook`;
  return twilio.validateRequest(authToken, signature, url, req.body || {});
}

// A WhatsApp "From" field looks like "whatsapp:+919xxxxxxxxx" — normalize to
// a bare E.164 number so it matches whatsapp_connections.phone_number.
export function normalizePhoneNumber(whatsappFrom) {
  return String(whatsappFrom || "").replace(/^whatsapp:/, "").trim();
}

let restClient = null;
function twilioRestClient() {
  if (!restClient) restClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return restClient;
}

// Replies are sent via Twilio's REST API rather than returned as inline
// TwiML from the webhook response — a trial account's "Try out WhatsApp"
// flow (what a brand-new Twilio account gets today in place of the old
// Sandbox) doesn't support direct TwiML in the response at all, while the
// REST API send works identically across trial, Sandbox, and a full paid
// account. One code path, no WHATSAPP_ENV branching needed.
export async function sendWhatsAppMessage(phoneNumber, body) {
  if (!body) return;
  await twilioRestClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${phoneNumber}`,
    body,
  });
}

// A business-initiated message (one the family member hasn't replied to
// recently) must be a Meta-approved Content Template, not free-form body
// text — WhatsApp rejects a plain `body` send outside the 24h customer
// service window. Used for "ask the family to identify this photo."
// `contentVariables` keys must match the numbering the template was built
// with in the Twilio Content Template Builder.
export async function sendWhatsAppTemplate(phoneNumber, contentSid, contentVariables) {
  await twilioRestClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${phoneNumber}`,
    contentSid,
    contentVariables: JSON.stringify(contentVariables),
  });
}

// Resolves a phone number to its linked Samskara user + active family +
// role, or null if the number has never been linked. A login can belong to
// more than one family (married-in members, multi_family_membership
// migration) — this picks whichever family matches the user's stored
// `active_family_id` preference, the exact same precedence the app's own
// current_family_id() SQL function uses, falling back to their earliest
// membership. The previous version assumed one-login-one-family (true when
// it was written, but stale the moment multi-family membership shipped
// earlier) and broke outright for anyone in two: `.maybeSingle()` on
// family_members throws once more than one row comes back. Also returns
// every membership, so the conversation engine can offer "which family
// should this go to" when there's more than one.
export async function resolveIdentity(supabase, phoneNumber) {
  const { data: connection, error: connErr } = await supabase
    .from("whatsapp_connections").select("user_id").eq("phone_number", phoneNumber).maybeSingle();
  if (connErr) throw new Error(connErr.message);
  if (!connection) return null;

  const { data: memberRows, error: memberErr } = await supabase
    .from("family_members")
    .select("family_id, role, display_name, person_id, created_at, families(name)")
    .eq("user_id", connection.user_id)
    .order("created_at", { ascending: true });
  if (memberErr) throw new Error(memberErr.message);
  if (!memberRows?.length) return null;

  const { data: prefs } = await supabase
    .from("user_preferences").select("active_family_id").eq("user_id", connection.user_id).maybeSingle();

  const active = (prefs?.active_family_id && memberRows.find((m) => m.family_id === prefs.active_family_id)) || memberRows[0];

  // display_name is set via the Admin roster ("Set display name"), which not
  // every member gets around to — fall back to the tree name of the person
  // they're linked to (set via "Set which person this is") before the
  // generic placeholder, so contributions aren't attributed to "A family
  // member" when a real name is one join away.
  let displayName = active.display_name;
  if (!displayName && active.person_id) {
    const { data: person } = await supabase
      .from("people").select("name").eq("family_id", active.family_id).eq("id", active.person_id).maybeSingle();
    displayName = person?.name || null;
  }

  return {
    userId: connection.user_id,
    familyId: active.family_id,
    role: active.role,
    displayName: displayName || "A family member",
    memberships: memberRows.map((m) => ({ familyId: m.family_id, familyName: m.families?.name || "Family", role: m.role })),
  };
}
